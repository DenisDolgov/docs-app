import { Test } from '@nestjs/testing';
import type { Channel, ChannelModel } from 'amqplib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module';
import { RABBITMQ } from '../src/rabbitmq/rabbitmq.constants';
import { RabbitmqService } from '../src/rabbitmq/rabbitmq.service';

const EXCHANGE = 'documents';
const ROUTING_KEY = 'document.created';
const QUEUE = 'documents.q';
const DLX = 'documents.dlx';
const DLQ = 'documents.dlq';
const DEAD_KEY = 'dead';

const waitFor = async (
  predicate: () => boolean | Promise<boolean>,
  timeoutMs = 3000,
) => {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    if (await predicate()) return;

    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  throw new Error('waitFor: условие не выполнено за отведённое время');
};

describe('rabbitmq', () => {
  let connection: ChannelModel;
  let channel: Channel;
  let events: RabbitmqService;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    connection = moduleRef.get(RABBITMQ);
    events = moduleRef.get(RabbitmqService);
    channel = await connection.createChannel();
    close = () => moduleRef.close();

    await channel.assertExchange(EXCHANGE, 'direct', { durable: true });
    await channel.assertExchange(DLX, 'direct', { durable: true });
    await channel.assertQueue(DLQ, { durable: true });
    await channel.bindQueue(DLQ, DLX, DEAD_KEY);
    await channel.assertQueue(QUEUE, {
      durable: true,
      deadLetterExchange: DLX,
      deadLetterRoutingKey: DEAD_KEY,
    });
    await channel.bindQueue(QUEUE, EXCHANGE, ROUTING_KEY);
    await channel.purgeQueue(QUEUE);
    await channel.purgeQueue(DLQ);
  });

  afterAll(async () => {
    await channel.deleteQueue(QUEUE);
    await channel.deleteQueue(DLQ);
    await channel.deleteExchange(EXCHANGE);
    await channel.deleteExchange(DLX);
    await channel.close();
    await close();
  });

  it('публикует сообщение и маршрутизирует его в очередь', async () => {
    await events.publish(EXCHANGE, ROUTING_KEY, { id: 'doc-1' });

    await waitFor(
      async () => (await channel.checkQueue(QUEUE)).messageCount === 1,
    );

    const message = await channel.get(QUEUE, { noAck: false });

    if (!message) throw new Error('сообщение не найдено в очереди');
    expect(JSON.parse(message.content.toString())).toEqual({ id: 'doc-1' });
    channel.ack(message);
  });

  it('подтверждает сообщение после успешного обработчика', async () => {
    const handled: unknown[] = [];
    const tag = await events.consume(QUEUE, (payload) => {
      handled.push(payload);
    });

    await events.publish(EXCHANGE, ROUTING_KEY, { id: 'doc-2' });

    await waitFor(() => handled.length === 1);
    await waitFor(
      async () => (await channel.checkQueue(QUEUE)).messageCount === 0,
    );

    await events.cancel(tag);

    expect(handled).toEqual([{ id: 'doc-2' }]);
  });

  it('уводит сообщение в DLQ, когда обработчик падает', async () => {
    const tag = await events.consume(QUEUE, () => {
      throw new Error('обработчик упал');
    });

    await events.publish(EXCHANGE, ROUTING_KEY, { id: 'doc-3' });

    await waitFor(
      async () => (await channel.checkQueue(DLQ)).messageCount === 1,
    );
    await events.cancel(tag);

    const dead = await channel.get(DLQ, { noAck: false });

    if (!dead) throw new Error('сообщение не найдено в DLQ');
    expect(JSON.parse(dead.content.toString())).toEqual({ id: 'doc-3' });
    expect(dead.properties.headers?.['x-first-death-reason']).toBe('rejected');
    channel.ack(dead);
  });
});
