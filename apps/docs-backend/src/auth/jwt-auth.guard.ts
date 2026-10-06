import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { type Request } from 'express';

import { UNAUTHORIZED_ERROR } from './errors';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromRequest(req);

    if (!token) {
      throw new UnauthorizedException(UNAUTHORIZED_ERROR);
    }

    try {
      req.user = await this.jwtService.verifyAsync<{
        sub: string;
        email: string;
      }>(token);
    } catch {
      throw new UnauthorizedException(UNAUTHORIZED_ERROR);
    }

    return true;
  }

  private extractTokenFromRequest(req: Request) {
    const [type, token] = req.headers.authorization?.split(' ') ?? [];

    if (type === 'Bearer') return token;

    return null;
  }
}
