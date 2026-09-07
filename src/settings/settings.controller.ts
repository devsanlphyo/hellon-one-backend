import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Logger,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { SettingsService } from './settings.service';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

@Controller('settings')
export class SettingsController {
  private readonly logger = new Logger(SettingsController.name);

  constructor(private readonly settingsService: SettingsService) {}

  /**
   * GET /settings
   * Public — all users (including unauthenticated) can fetch the global
   * settings (logo URL) so the app branding loads for everyone.
   */
  @Get()
  async getSettings() {
    const settings = await this.settingsService.getSettings();
    return { isSuccess: true, data: settings };
  }

  /**
   * POST /settings/logo
   * Admin-only. Accepts multipart/form-data with field name "logo".
   * Validates mime type and file size, stores in public/uploads/.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('logo')
  @UseInterceptors(
    FileInterceptor('logo', {
      storage: diskStorage({
        destination: join(process.cwd(), 'public', 'uploads'),
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname);
          const uniqueName = `logo-${uuidv4()}${ext}`;
          cb(null, uniqueName);
        },
      }),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              `Unsupported file type "${file.mimetype}". Allowed: JPEG, PNG, WEBP, SVG.`,
            ),
            false,
          );
        }
      },
    }),
  )
  async uploadLogo(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded. Field name must be "logo".');
    }

    // Build a publicly-accessible URL for the uploaded file
    const protocol = req.protocol;
    const host = req.get('host');
    const logoUrl = `${protocol}://${host}/uploads/${file.filename}`;

    this.logger.log(`Logo uploaded: ${file.filename} (${file.size} bytes)`);

    const settings = await this.settingsService.updateLogoUrl(logoUrl);
    return {
      isSuccess: true,
      message: 'Logo uploaded and applied successfully',
      data: settings,
    };
  }

  /**
   * DELETE /settings/logo
   * Admin-only. Removes the current logo (reverts to default icon).
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete('logo')
  async removeLogo() {
    const settings = await this.settingsService.clearLogoUrl();
    return {
      isSuccess: true,
      message: 'Logo removed. Default icon will be used.',
      data: settings,
    };
  }
}
