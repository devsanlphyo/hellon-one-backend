import { UserRole } from '../entities/user.entity';

export type JwtPayload = {
  sub: string;
  fullName: string;
  email: string;
  role: UserRole;
};

