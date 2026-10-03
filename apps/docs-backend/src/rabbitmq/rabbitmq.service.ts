import { Buffer } from 'node:buffer';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Channel, ChannelModel } from 'amqplib';

import { RABBITMQ } from './rabbitmq.constants';

@Injectable()
export class RabbitmqService {
  private readonly logger = new Logger(RabbitmqService.name);
  private readonly channelsMap: Map<string, Channel> = new Map();

  constructor(@Inject(RABBITMQ) private readonly connection: ChannelModel) {}

  public async publish(exchange: string, routingKey: string, payload: unknown) {
    const channel = await this.connection.createConfirmChannel();

    try {
      channel.publish(
        exchange,
        routingKey,
        Buffer.from(JSON.stringify(payload)),
        {
          persistent: true,
        },
      );

      await channel.waitForConfirms();
    } finally {
      await channel.close();
    }
  }

  public async consume(
    queue: string,
    handler: (payload: unknown) => Promise<void> | void,
  ) {
    const channel = await this.connection.createChannel();

    try {
      await channel.prefetch(1);

      const { consumerTag } = await channel.consume(
        queue,
        async (msg) => {
          if (!msg) return;

          try {
            await handler(JSON.parse(msg.content.toString()));
            channel.ack(msg);
          } catch (error: unknown) {
            this.logger.error(error);
            channel.nack(msg, false, false);
          }
        },
        { noAck: false },
      );

      this.channelsMap.set(consumerTag, channel);

      return consumerTag;
    } catch (error) {
      await channel.close();
      throw error;
    }
  }

  public async cancel(tag: string) {
    const channel = this.channelsMap.get(tag);

    if (!channel) return;

    this.channelsMap.delete(tag);
    try {
      await channel.cancel(tag);
    } finally {
      await channel.close();
    }
  }
}
