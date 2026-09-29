import { Controller, Get } from '@nestjs/common';

// biome-ignore lint/style/useImportType: убрать правило для backend
import { HealthService } from './health.service';

@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  getHealth() {
    return this.healthService.getHealth();
  }
}
