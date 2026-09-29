import * as process from 'node:process';
import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthService {
  getHealth() {
    return {
      status: 'ok',
      uptime: process.uptime(),
    };
  }
}
