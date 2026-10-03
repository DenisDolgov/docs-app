import { Inject, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChannelModel, connect } from 'amqplib';

import { RABBITMQ } from './rabbitmq.constants';
import { RabbitmqService } from './rabbitmq.service';

@Module({
  providers: [
    {
      inject: [ConfigService],
      provide: RABBITMQ,
      useFactory: async (configService: ConfigService) =>
        connect(configService.getOrThrow<string>('RABBITMQ_URL')),
    },
    RabbitmqService,
  ],
  exports: [RABBITMQ, RabbitmqService],
})
export class RabbitmqModule implements OnModuleDestroy {
  constructor(@Inject(RABBITMQ) private readonly connection: ChannelModel) {}

  async onModuleDestroy() {
    await this.connection.close();
  }
}
