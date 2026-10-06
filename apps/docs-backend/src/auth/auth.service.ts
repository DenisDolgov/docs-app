import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';

import { isUniqueViolation } from '../database/sql-errors';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import {
  INVALID_EMAIL_OR_PASSWORD_ERROR,
  USER_EMAIL_ALREADY_EXISTS_ERROR,
} from './errors';
import { UserRepository } from './user.repository';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  private dummyHash!: string;

  constructor(
    private readonly userRepository: UserRepository,
    private readonly jwtService: JwtService,
  ) {}

  async onModuleInit() {
    this.dummyHash = await argon2.hash('dummy');
  }

  public async register({ email, password }: RegisterDto) {
    const normalizedEmail = this.normalizeEmail(email);
    const existing = await this.userRepository.findByEmail(normalizedEmail);

    if (existing) {
      throw new ConflictException(USER_EMAIL_ALREADY_EXISTS_ERROR);
    }

    const passwordHash = await argon2.hash(password);

    try {
      return await this.userRepository.create({
        email: normalizedEmail,
        passwordHash,
      });
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(USER_EMAIL_ALREADY_EXISTS_ERROR);
      }

      this.logger.error(error);
      throw new InternalServerErrorException();
    }
  }

  public async login({ email, password }: LoginDto) {
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.userRepository.findByEmail(normalizedEmail);

    if (!user) {
      await argon2.verify(this.dummyHash, password);
      throw new UnauthorizedException(INVALID_EMAIL_OR_PASSWORD_ERROR);
    }

    const isVerify = await argon2.verify(user.passwordHash, password);

    if (!isVerify)
      throw new UnauthorizedException(INVALID_EMAIL_OR_PASSWORD_ERROR);

    return this.jwtService.sign({
      sub: user.id,
      email: user.email,
    });
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }
}
