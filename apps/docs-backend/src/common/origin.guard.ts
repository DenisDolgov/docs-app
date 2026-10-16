import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const FORBIDDEN_ORIGIN_ERROR = 'Запрос с недопустимого origin';

// SameSite=Strict не спасает от недоверенного поддомена общего registrable
// domain, поэтому все изменяющие запросы дополнительно сверяем с app-origin
// Запросы без Origin (curl, server-to-server) кук браузера не несут
@Injectable()
export class OriginGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();

    if (SAFE_METHODS.has(req.method)) return true;

    const origin = req.headers.origin;

    if (!origin) return true;

    const allowedOrigin = this.configService.get<string>('CORS_ORIGIN');

    if (origin !== allowedOrigin) {
      throw new ForbiddenException(FORBIDDEN_ORIGIN_ERROR);
    }

    return true;
  }
}
