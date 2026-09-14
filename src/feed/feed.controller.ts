import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import * as fs from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { AddCommentDto } from './dto/add-comment.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { QueryFeedDto } from './dto/query-feed.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { FeedService } from './feed.service';

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
];

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB per media item

const feedMulterOptions = {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      const uploadPath = join(process.cwd(), 'public', 'uploads', 'feed');
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      cb(null, uploadPath);
    },
    filename: (_req, file, cb) => {
      const ext = extname(file.originalname).toLowerCase();
      const uniqueName = `feed-${uuidv4()}${ext}`;
      cb(null, uniqueName);
    },
  }),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
  },
  fileFilter: (_req: any, file: any, cb: any) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype.toLowerCase())) {
      return cb(
        new BadRequestException(
          `Invalid file format (${file.mimetype}). Supported formats: JPEG, PNG, WebP, GIF.`,
        ),
        false,
      );
    }
    cb(null, true);
  },
};

@Controller('feed')
@UseGuards(JwtAuthGuard)
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  /**
   * Flow 1 & Flow 2: Get Feed items
   */
  @Get()
  async getFeed(@Req() req: any, @Query() query: QueryFeedDto) {
    return this.feedService.getFeed(req.user, query);
  }

  /**
   * Flow 3 & Flow 4: Create Post with optional media attachments
   */
  @Post()
  @UseInterceptors(FilesInterceptor('files', 10, feedMulterOptions))
  async createPost(
    @Req() req: any,
    @Body() dto: CreatePostDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.feedService.createPost(req.user, dto, files);
  }

  /**
   * Get single post
   */
  @Get(':id')
  async getPostById(@Req() req: any, @Param('id') id: string) {
    return this.feedService.getPostById(id, req.user);
  }

  /**
   * Flow 7 & Flow 8: Edit Post
   * Decision Gate: Own Post?
   */
  @Patch(':id')
  async updatePost(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdatePostDto,
  ) {
    return this.feedService.updatePost(req.user, id, dto);
  }

  /**
   * Flow 5 & Flow 6: Delete Post
   * Flow 5: Own Post? check for campus staff
   * Flow 6: Moderation deletion without restriction for Admin / Director
   */
  @Delete(':id')
  async deletePost(@Req() req: any, @Param('id') id: string) {
    return this.feedService.deletePost(req.user, id);
  }

  /**
   * Toggle reaction
   */
  @Post(':id/react')
  async toggleReaction(@Req() req: any, @Param('id') id: string) {
    return this.feedService.toggleReaction(req.user, id);
  }

  /**
   * Add comment
   */
  @Post(':id/comments')
  async addComment(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: AddCommentDto,
  ) {
    return this.feedService.addComment(req.user, id, dto);
  }

  /**
   * Delete comment
   */
  @Delete('comments/:commentId')
  async deleteComment(@Req() req: any, @Param('commentId') commentId: string) {
    return this.feedService.deleteComment(req.user, commentId);
  }
}
