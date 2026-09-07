import {
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Roles } from './decorators/roles.decorator';
import { DevicesService } from './devices.service';
import { RolesGuard } from './guards/roles.guard';
import { JwtAuthGuard } from './jwt/jwt-auth.guard';

@Controller('admin/devices')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Get()
  findAll(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.devicesService.findAll({ status, search, page, limit });
  }

  @Get('pending-count')
  getPendingCount() {
    return this.devicesService.getPendingCount();
  }

  @Patch(':id/approve')
  async approve(@Param('id') id: string, @Req() req: any) {
    const adminId = req.user.sub;
    const device = await this.devicesService.approve(id, adminId);
    return {
      isSuccess: true,
      message: 'Device approved successfully',
      data: device,
    };
  }

  @Patch(':id/reject')
  async reject(@Param('id') id: string, @Req() req: any) {
    const adminId = req.user.sub;
    const device = await this.devicesService.reject(id, adminId);
    return {
      isSuccess: true,
      message: 'Device rejected',
      data: device,
    };
  }

  @Patch(':id/revoke')
  async revoke(@Param('id') id: string, @Req() req: any) {
    const adminId = req.user.sub;
    const device = await this.devicesService.revoke(id, adminId);
    return {
      isSuccess: true,
      message: 'Device revoked',
      data: device,
    };
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.devicesService.delete(id);
  }
}
