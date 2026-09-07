import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole, UserStatus } from './entities/user.entity';
import { JwtPayload } from './types/jwt-payload.type';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async onApplicationBootstrap() {
    await this.seedDefaultUsers();
  }

  async seedDefaultUsers() {
    const defaultUsers = [
      {
        fullName: 'Alexander Wright',
        email: 'admin@school.edu',
        password: 'password123',
        role: 'admin' as UserRole,
        status: 'active' as UserStatus,
      },
      {
        fullName: 'Victoria Vance',
        email: 'admin2@school.edu',
        password: 'password123',
        role: 'admin' as UserRole,
        status: 'active' as UserStatus,
      },
      {
        fullName: 'Eleanor Vance',
        email: 'director@school.edu',
        password: 'password123',
        role: 'director' as UserRole,
        status: 'active' as UserStatus,
      },
      {
        fullName: 'William Sterling',
        email: 'william.sterling@school.edu',
        password: 'password123',
        role: 'director' as UserRole,
        status: 'active' as UserStatus,
      },
      {
        fullName: 'Marcus Holloway',
        email: 'headmaster@school.edu',
        password: 'password123',
        role: 'headmaster' as UserRole,
        status: 'active' as UserStatus,
      },
      {
        fullName: 'Katherine Thorne',
        email: 'katherine.thorne@school.edu',
        password: 'password123',
        role: 'headmaster' as UserRole,
        status: 'active' as UserStatus,
      },
      {
        fullName: 'Samuel Jackson',
        email: 'samuel.jackson@school.edu',
        password: 'password123',
        role: 'headmaster' as UserRole,
        status: 'active' as UserStatus,
      },
      {
        fullName: 'Sarah Jenkins',
        email: 'teacher@school.edu',
        password: 'password123',
        role: 'teacher' as UserRole,
        status: 'active' as UserStatus,
      },
      {
        fullName: 'David Chen',
        email: 'david.chen@school.edu',
        password: 'password123',
        role: 'teacher' as UserRole,
        status: 'suspend' as UserStatus,
      },
      {
        fullName: 'Maria Rodriguez',
        email: 'maria.rodriguez@school.edu',
        password: 'password123',
        role: 'teacher' as UserRole,
        status: 'active' as UserStatus,
      },
      {
        fullName: 'Daniel Kim',
        email: 'daniel.kim@school.edu',
        password: 'password123',
        role: 'teacher' as UserRole,
        status: 'active' as UserStatus,
      },
      {
        fullName: 'Emily Watson',
        email: 'emily.watson@school.edu',
        password: 'password123',
        role: 'teacher' as UserRole,
        status: 'active' as UserStatus,
      },
      {
        fullName: 'Hassan Ali',
        email: 'hassan.ali@school.edu',
        password: 'password123',
        role: 'teacher' as UserRole,
        status: 'suspend' as UserStatus,
      },
      {
        fullName: 'Olivia Morgan',
        email: 'olivia.morgan@school.edu',
        password: 'password123',
        role: 'teacher' as UserRole,
        status: 'active' as UserStatus,
      },
      {
        fullName: 'Lucas Bennett',
        email: 'lucas.bennett@school.edu',
        password: 'password123',
        role: 'teacher' as UserRole,
        status: 'active' as UserStatus,
      },
      {
        fullName: 'Chloe Bennett',
        email: 'officer@school.edu',
        password: 'password123',
        role: 'officer' as UserRole,
        status: 'active' as UserStatus,
      },
      {
        fullName: 'Robert Taylor',
        email: 'robert.taylor@school.edu',
        password: 'password123',
        role: 'officer' as UserRole,
        status: 'suspend' as UserStatus,
      },
      {
        fullName: 'Benjamin Hayes',
        email: 'benjamin.hayes@school.edu',
        password: 'password123',
        role: 'officer' as UserRole,
        status: 'active' as UserStatus,
      },
      {
        fullName: 'Victor Franke',
        email: 'victor.franke@school.edu',
        password: 'password123',
        role: 'officer' as UserRole,
        status: 'active' as UserStatus,
      },
      {
        fullName: 'Gabriel Silva',
        email: 'gabriel.silva@school.edu',
        password: 'password123',
        role: 'officer' as UserRole,
        status: 'suspend' as UserStatus,
      },
      {
        fullName: 'Amina Al-Mansoor',
        email: 'assistant@school.edu',
        password: 'password123',
        role: 'assistant' as UserRole,
        status: 'active' as UserStatus,
      },
      {
        fullName: 'James Peterson',
        email: 'james.peterson@school.edu',
        password: 'password123',
        role: 'assistant' as UserRole,
        status: 'suspend' as UserStatus,
      },
      {
        fullName: 'Sofia Patel',
        email: 'sofia.patel@school.edu',
        password: 'password123',
        role: 'assistant' as UserRole,
        status: 'active' as UserStatus,
      },
      {
        fullName: 'Clara Oswald',
        email: 'clara.oswald@school.edu',
        password: 'password123',
        role: 'assistant' as UserRole,
        status: 'active' as UserStatus,
      },
      {
        fullName: 'Natalie Portman',
        email: 'natalie.portman@school.edu',
        password: 'password123',
        role: 'assistant' as UserRole,
        status: 'active' as UserStatus,
      },
    ];

    try {
      let seededCount = 0;
      for (const demoUser of defaultUsers) {
        const exists = await this.userRepository.findOneBy({ email: demoUser.email });
        if (!exists) {
          const hashedPassword = await bcrypt.hash(demoUser.password, 10);
          const user = this.userRepository.create({
            fullName: demoUser.fullName,
            email: demoUser.email,
            password: hashedPassword,
            role: demoUser.role,
            status: demoUser.status,
          });
          await this.userRepository.save(user);
          seededCount++;
        }
      }

      if (seededCount > 0) {
        this.logger.log(`🌱 Database seeded with ${seededCount} default system accounts (password: password123)`);
      }
    } catch (err: any) {
      this.logger.warn(`Could not seed default users: ${err.message}`);
    }
  }


  async login(email: string, password: string) {
    this.logger.log(`Attempting login for email: ${email}`);
    const existingUser = await this.userRepository.findOneBy({ email });
    if (!existingUser) {
      this.logger.warn(`Login failed: user with email ${email} not found`);
      throw new NotFoundException('Invalid email or password');
    }

    if (existingUser.status === 'suspend') {
      this.logger.warn(
        `Login blocked: account ${email} is suspended`,
      );
      throw new UnauthorizedException(
        'Your account has been suspended. Please contact the administrator.',
      );
    }

    let isPasswordValid = false;
    // Check bcrypt hash
    if (existingUser.password.startsWith('$2b$') || existingUser.password.startsWith('$2a$')) {
      isPasswordValid = await bcrypt.compare(password, existingUser.password);
    } else {
      // Backwards-compatibility fallback for pre-existing plaintext records
      isPasswordValid = password === existingUser.password;
      if (isPasswordValid) {
        // Automatically migrate to bcrypt hash
        existingUser.password = await bcrypt.hash(password, 10);
        await this.userRepository.save(existingUser);
        this.logger.log(`Migrated plaintext password for user: ${email} to bcrypt hash`);
      }
    }

    if (!isPasswordValid) {
      this.logger.warn(`Login failed: invalid password for email ${email}`);
      throw new NotFoundException('Invalid email or password');
    }

    const payload: JwtPayload = {
      sub: existingUser.id,
      fullName: existingUser.fullName,
      email: existingUser.email,
      role: existingUser.role,
    };

    this.logger.log(`User logged in successfully: ${email} [Role: ${existingUser.role}]`);

    return {
      isSuccess: true,
      message: 'Login success',
      accessToken: this.jwtService.sign(payload),
      user: {
        id: existingUser.id,
        fullName: existingUser.fullName,
        email: existingUser.email,
        role: existingUser.role,
        status: existingUser.status,
      },
    };
  }

  async register(
    fullName: string,
    email: string,
    password: string,
    role: UserRole,
    status: UserStatus = 'active',
  ) {
    this.logger.log(`Registering new user: ${email} [Role: ${role}, Status: ${status}]`);
    const existingUser = await this.userRepository.findOneBy({ email });
    if (existingUser) {
      this.logger.warn(`Registration failed: email ${email} already in use`);
      throw new BadRequestException('Email is already registered');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User();
    user.fullName = fullName;
    user.email = email;
    user.password = hashedPassword;
    user.role = role;
    user.status = status;

    const savedUser = await this.userRepository.save(user);
    this.logger.log(`User registered successfully: ${savedUser.email} (ID: ${savedUser.id})`);

    return {
      isSuccess: true,
      message: 'User registered successfully',
      user: {
        id: savedUser.id,
        fullName: savedUser.fullName,
        email: savedUser.email,
        role: savedUser.role,
        status: savedUser.status,
        createdAt: savedUser.createdAt,
      },
    };
  }
}


