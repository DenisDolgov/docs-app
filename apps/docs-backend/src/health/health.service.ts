import * as process from 'node:process';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  getHealth() {
    this.logger.log('health check requested');

    return {
      status: 'ok',
      uptime: process.uptime(),
    };
  }
}
