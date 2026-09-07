import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { User } from '../entities/user.entity';
import { UserDevice } from '../entities/user-device.entity';
import { JwtPayload } from '../types/jwt-payload.type';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserDevice)
    private readonly userDeviceRepository: Repository<UserDevice>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: 'your-secret-key',
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload) {
    const user = await this.userRepository.findOneBy({ id: payload.sub });

    if (!user) {
      throw new UnauthorizedException('User account not found');
    }

    if (user.status === 'suspend') {
      throw new UnauthorizedException('User account is suspended');
    }

    // If caller provided x-device-id, verify the device is not revoked
    const deviceId = (req.headers['x-device-id'] as string) || undefined;
    if (deviceId) {
      const device = await this.userDeviceRepository.findOne({
        where: { userId: payload.sub, deviceId },
      });
      if (device && (device.status === 'revoked' || device.status === 'rejected')) {
        throw new UnauthorizedException(
          'Access from this device has been signed out or revoked. Please sign in again.',
        );
      }
    }

    const { password, ...sanitizedUser } = user;
    return sanitizedUser;
  }
}

