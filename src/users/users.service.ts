import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import { join } from 'path';
import { Repository } from 'typeorm';
import { User, UserRole, UserStatus } from '../auth/entities/user.entity';
import { UserDevice } from '../auth/entities/user-device.entity';
import { QueryUserDto } from './dto/query-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserDevice)
    private readonly userDeviceRepository: Repository<UserDevice>,
  ) {}

  async findAll(query: QueryUserDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    this.logger.log(
      `Fetching users list [Page: ${page}, Limit: ${limit}, Search: "${query.search || ''}", Role: "${query.role || 'all'}", Status: "${query.status || 'all'}"]`,
    );

    const queryBuilder = this.userRepository.createQueryBuilder('user');

    if (query.search && query.search.trim() !== '') {
      const search = `%${query.search.trim()}%`;
      queryBuilder.andWhere(
        '(LOWER(user.fullName) LIKE LOWER(:search) OR LOWER(user.email) LIKE LOWER(:search))',
        { search },
      );
    }

    if (query.role && query.role !== 'default' && query.role !== 'all') {
      queryBuilder.andWhere('user.role = :role', { role: query.role });
    }

    if (query.status && query.status !== 'default' && query.status !== 'all') {
      queryBuilder.andWhere('user.status = :status', { status: query.status });
    }

    if (query.schoolId && query.schoolId !== 'default' && query.schoolId !== 'all') {
      if (query.schoolId === 'unassigned' || query.schoolId === 'none') {
        queryBuilder.andWhere('user.schoolId IS NULL');
      } else {
        queryBuilder.andWhere('user.schoolId = :schoolId', { schoolId: query.schoolId });
      }
    }

    if (query.eligibleForSchoolId) {
      queryBuilder.andWhere(
        '(user.schoolId = :eligibleForSchoolId OR user.schoolId IS NULL)',
        { eligibleForSchoolId: query.eligibleForSchoolId },
      );
    }

    queryBuilder
      .leftJoinAndSelect('user.school', 'school')
      .select([
        'user.id',
        'user.fullName',
        'user.email',
        'user.role',
        'user.status',
        'user.avatarUrl',
        'user.schoolId',
        'school.id',
        'school.name',
        'user.createdAt',
        'user.updatedAt',
      ])
      .orderBy('user.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    const [users, total] = await queryBuilder.getManyAndCount();

    this.logger.log(`Fetched ${users.length} users (Total matching: ${total})`);

    return {
      isSuccess: true,
      data: users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findOne(id: string) {
    this.logger.log(`Fetching user by ID: ${id}`);
    const existingUser = await this.userRepository.findOne({
      where: { id },
      relations: { school: true },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        status: true,
        avatarUrl: true,
        schoolId: true,
        school: {
          id: true,
          name: true,
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!existingUser) {
      this.logger.warn(`User lookup failed: user with ID ${id} not found`);
      throw new NotFoundException('User not found');
    }

    return {
      isSuccess: true,
      user: existingUser,
    };
  }

  async update(id: string, dto: UpdateUserDto) {
    this.logger.log(`Updating user ID: ${id}`);
    const user = await this.userRepository.findOneBy({ id });
    if (!user) {
      this.logger.warn(`Update failed: user with ID ${id} not found`);
      throw new NotFoundException('User not found');
    }

    if (dto.email && dto.email !== user.email) {
      const emailTaken = await this.userRepository.findOneBy({ email: dto.email });
      if (emailTaken) {
        this.logger.warn(`Update failed: email ${dto.email} is already in use`);
        throw new BadRequestException('Email is already in use by another account');
      }
      user.email = dto.email;
    }

    if (dto.fullName) {
      user.fullName = dto.fullName;
    }

    if (dto.role) {
      user.role = dto.role as UserRole;
    }

    if (dto.status) {
      user.status = dto.status as UserStatus;
    }

    if (dto.avatarUrl !== undefined) {
      if (user.avatarUrl && user.avatarUrl !== dto.avatarUrl) {
        this.deleteAvatarFile(user.avatarUrl);
      }
      user.avatarUrl = dto.avatarUrl;
    }

    if (dto.password && dto.password.trim() !== '') {
      user.password = await bcrypt.hash(dto.password, 10);
      this.logger.log(`Password reset performed for user ID: ${id}`);
    }

    const updatedUser = await this.userRepository.save(user);
    const { password, ...sanitizedUser } = updatedUser;

    this.logger.log(`User ID ${id} updated successfully [Role: ${user.role}, Status: ${user.status}]`);

    return {
      isSuccess: true,
      message: 'User updated successfully',
      user: sanitizedUser,
    };
  }

  async updateAvatar(id: string, avatarUrl: string | null) {
    this.logger.log(`Updating avatar for user ID: ${id}`);
    const user = await this.userRepository.findOneBy({ id });
    if (!user) {
      this.logger.warn(`Avatar update failed: user with ID ${id} not found`);
      throw new NotFoundException('User not found');
    }

    if (user.avatarUrl && user.avatarUrl !== avatarUrl) {
      this.deleteAvatarFile(user.avatarUrl);
    }

    user.avatarUrl = avatarUrl;
    const updatedUser = await this.userRepository.save(user);
    const { password, ...sanitizedUser } = updatedUser;

    return {
      isSuccess: true,
      message: avatarUrl ? 'Profile image updated successfully' : 'Profile image removed successfully',
      user: sanitizedUser,
    };
  }

  private deleteAvatarFile(avatarUrl: string) {
    try {
      const parts = avatarUrl.split('/uploads/avatars/');
      if (parts.length > 1) {
        const fileName = parts[1];
        const filePath = join(process.cwd(), 'public', 'uploads', 'avatars', fileName);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          this.logger.log(`Removed old avatar file: ${filePath}`);
        }
      }
    } catch (err: any) {
      this.logger.error(`Failed to delete old avatar file: ${err?.message}`);
    }
  }

  async remove(id: string) {
    this.logger.log(`Suspending user ID: ${id}`);
    const user = await this.userRepository.findOneBy({ id });
    if (!user) {
      this.logger.warn(`Suspension failed: user with ID ${id} not found`);
      throw new NotFoundException('User not found');
    }

    user.status = 'suspend';
    await this.userRepository.save(user);

    this.logger.log(`User ID ${id} (${user.email}) successfully suspended`);

    return {
      isSuccess: true,
      message: 'User suspended successfully',
    };
  }

  async getProfile(id: string) {
    const existingUser = await this.userRepository.findOneBy({ id });
    if (!existingUser) {
      this.logger.warn(`Profile lookup failed: user with ID ${id} not found`);
      throw new NotFoundException('User not found');
    }

    const { password, ...profile } = existingUser;
    return {
      isSuccess: true,
      message: 'Fetching user profile success',
      profile,
    };
  }

  async getMyDevices(userId: string) {
    const devices = await this.userDeviceRepository.find({
      where: { userId },
      order: { lastLoginAt: 'DESC', createdAt: 'DESC' },
    });

    // Identify first registered device by earliest createdAt
    let firstDeviceId: string | null = null;
    if (devices.length > 0) {
      const sortedByCreation = [...devices].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      firstDeviceId = sortedByCreation[0].deviceId;
    }

    const enhancedDevices = devices.map((dev) => ({
      ...dev,
      isFirstDevice: dev.deviceId === firstDeviceId,
    }));

    return {
      isSuccess: true,
      devices: enhancedDevices,
      firstDeviceId,
    };
  }

  async signOutOtherDevices(userId: string, callerDeviceId: string) {
    if (!callerDeviceId) {
      throw new BadRequestException('Current device ID is required.');
    }

    // Determine the first registered device for this user
    const firstDevice = await this.userDeviceRepository.findOne({
      where: { userId },
      order: { createdAt: 'ASC' },
    });

    if (!firstDevice) {
      throw new NotFoundException('No registered devices found for this account.');
    }

    // Enforcement: this can ONLY be performed from the first device
    if (firstDevice.deviceId !== callerDeviceId) {
      this.logger.warn(
        `Unauthorized signout attempt: User ${userId} requested signout from device ${callerDeviceId}, but first device is ${firstDevice.deviceId}`,
      );
      throw new ForbiddenException(
        'Only the first registered device can sign out other devices.',
      );
    }

    // Revoke all other devices for this user
    const allDevices = await this.userDeviceRepository.find({
      where: { userId },
    });

    let revokedCount = 0;
    for (const dev of allDevices) {
      if (dev.deviceId !== callerDeviceId && dev.status !== 'revoked') {
        dev.status = 'revoked';
        await this.userDeviceRepository.save(dev);
        revokedCount++;
      }
    }

    this.logger.log(
      `Primary device ${callerDeviceId} signed out ${revokedCount} other device(s) for user ${userId}`,
    );

    return {
      isSuccess: true,
      message: `Successfully signed out ${revokedCount} other device(s).`,
      revokedCount,
    };
  }

  async signOutDevice(
    userId: string,
    callerDeviceId: string,
    targetDeviceId: string,
  ) {
    if (!callerDeviceId) {
      throw new BadRequestException('Current device ID is required.');
    }

    if (!targetDeviceId) {
      throw new BadRequestException('Target device ID is required.');
    }

    if (callerDeviceId === targetDeviceId) {
      throw new BadRequestException(
        'Cannot sign out the current active device with this action. Use regular logout.',
      );
    }

    // Determine the first registered device for this user
    const firstDevice = await this.userDeviceRepository.findOne({
      where: { userId },
      order: { createdAt: 'ASC' },
    });

    if (!firstDevice) {
      throw new NotFoundException('No registered devices found for this account.');
    }

    // Enforcement: this can ONLY be performed from the first device
    if (firstDevice.deviceId !== callerDeviceId) {
      throw new ForbiddenException(
        'Only the first registered device can sign out other devices.',
      );
    }

    const targetDevice = await this.userDeviceRepository.findOne({
      where: { userId, deviceId: targetDeviceId },
    });

    if (!targetDevice) {
      throw new NotFoundException('Target device not found.');
    }

    targetDevice.status = 'revoked';
    await this.userDeviceRepository.save(targetDevice);

    this.logger.log(
      `Primary device ${callerDeviceId} signed out target device ${targetDeviceId} for user ${userId}`,
    );

    return {
      isSuccess: true,
      message: `Device "${targetDevice.deviceName || 'Client'}" has been signed out.`,
    };
  }
}



