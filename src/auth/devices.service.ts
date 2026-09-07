import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeviceStatus, UserDevice } from './entities/user-device.entity';

@Injectable()
export class DevicesService {
  private readonly logger = new Logger(DevicesService.name);

  constructor(
    @InjectRepository(UserDevice)
    private readonly deviceRepository: Repository<UserDevice>,
  ) {}

  async findAll(query: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const qb = this.deviceRepository
      .createQueryBuilder('device')
      .leftJoinAndSelect('device.user', 'user')
      .select([
        'device.id',
        'device.userId',
        'device.deviceId',
        'device.deviceName',
        'device.ipAddress',
        'device.userAgent',
        'device.status',
        'device.lastLoginAt',
        'device.approvedById',
        'device.approvedAt',
        'device.createdAt',
        'device.updatedAt',
        'user.id',
        'user.fullName',
        'user.email',
        'user.role',
        'user.status',
        'user.avatarUrl',
      ]);

    if (query.status && query.status !== 'all') {
      qb.andWhere('device.status = :status', { status: query.status });
    }

    if (query.search && query.search.trim() !== '') {
      const search = `%${query.search.trim()}%`;
      qb.andWhere(
        '(user.fullName ILIKE :search OR user.email ILIKE :search OR device.deviceName ILIKE :search OR device.ipAddress ILIKE :search)',
        { search },
      );
    }

    qb.orderBy('device.createdAt', 'DESC');
    qb.skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      isSuccess: true,
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getPendingCount(): Promise<{ isSuccess: boolean; pendingCount: number }> {
    const count = await this.deviceRepository.count({
      where: { status: 'pending' },
    });
    return { isSuccess: true, pendingCount: count };
  }

  async approve(id: string, adminId: string): Promise<UserDevice> {
    const device = await this.deviceRepository.findOne({ where: { id } });
    if (!device) {
      throw new NotFoundException(`Device with ID ${id} not found`);
    }

    device.status = 'approved';
    device.approvedById = adminId;
    device.approvedAt = new Date();

    this.logger.log(`Device ${id} approved by admin ${adminId}`);
    return this.deviceRepository.save(device);
  }

  async reject(id: string, adminId: string): Promise<UserDevice> {
    const device = await this.deviceRepository.findOne({ where: { id } });
    if (!device) {
      throw new NotFoundException(`Device with ID ${id} not found`);
    }

    device.status = 'rejected';
    device.approvedById = adminId;
    device.approvedAt = new Date();

    this.logger.log(`Device ${id} rejected by admin ${adminId}`);
    return this.deviceRepository.save(device);
  }

  async revoke(id: string, adminId: string): Promise<UserDevice> {
    const device = await this.deviceRepository.findOne({ where: { id } });
    if (!device) {
      throw new NotFoundException(`Device with ID ${id} not found`);
    }

    device.status = 'revoked';
    device.approvedById = adminId;
    device.approvedAt = new Date();

    this.logger.log(`Device ${id} revoked by admin ${adminId}`);
    return this.deviceRepository.save(device);
  }

  async delete(id: string): Promise<{ isSuccess: boolean; message: string }> {
    const device = await this.deviceRepository.findOne({ where: { id } });
    if (!device) {
      throw new NotFoundException(`Device with ID ${id} not found`);
    }

    await this.deviceRepository.remove(device);
    this.logger.log(`Device ${id} removed`);
    return { isSuccess: true, message: 'Device deleted successfully' };
  }
}
