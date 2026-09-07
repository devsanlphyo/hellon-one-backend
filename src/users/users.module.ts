import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import { UserDevice } from '../auth/entities/user-device.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserDevice])],
  providers: [UsersService],
  controllers: [UsersController],
})
export class UsersModule {}
