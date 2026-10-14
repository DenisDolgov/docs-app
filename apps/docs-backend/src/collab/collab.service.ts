import { clearInterval, clearTimeout } from 'node:timers';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

import { COLLAB_EVICT_GRACE, COLLAB_SAVE_INTERVAL } from './collab.constants';
import { CollabConnection } from './collab.models';
import { CollabRepository } from './collab.repository';
import { CollabRoom } from './collab.room';

@Injectable()
export class CollabService implements OnModuleDestroy {
  private readonly logger = new Logger(CollabService.name);
  private readonly rooms = new Map<string, CollabRoom>();
  private readonly loading = new Map<string, Promise<CollabRoom>>();
  private readonly evictTimers = new Map<string, NodeJS.Timeout>();
  private readonly compactTimers = new Map<string, NodeJS.Timeout>();

  constructor(private readonly collabRepository: CollabRepository) {}

  public async getRoom(documentId: string): Promise<CollabRoom> {
    const existingRoom = this.rooms.get(documentId);

    if (existingRoom) return existingRoom;

    const inFlightRoom = this.loading.get(documentId);

    if (inFlightRoom) return inFlightRoom;

    const promise = this.load(documentId).finally(() =>
      this.loading.delete(documentId),
    );
    this.loading.set(documentId, promise);

    return promise;
  }

  private async load(documentId: string): Promise<CollabRoom> {
    const room = new CollabRoom(documentId, this.collabRepository);

    try {
      await room.hydrate();
    } catch (error) {
      this.logger.error({ documentId, err: error }, 'failed to hydrate room');
      throw error;
    }

    this.rooms.set(documentId, room);
    this.scheduleCompact(documentId);

    return room;
  }

  async attach(connection: CollabConnection): Promise<CollabRoom> {
    const room = await this.getRoom(connection.documentId);
    room.attach(connection);
    this.cancelEviction(connection.documentId);
    return room;
  }

  async detach(connection: CollabConnection): Promise<void> {
    const room = this.rooms.get(connection.documentId);
    if (!room) return;

    room.detach(connection);
    if (room.isEmpty) {
      await room.flush();
      this.scheduleEviction(connection.documentId);
    }
  }

  async compact(documentId: string): Promise<void> {
    const room = this.rooms.get(documentId);
    if (!room) return;
    await room.compact();
  }

  private scheduleCompact(documentId: string): void {
    const timer = setInterval(() => {
      void this.compact(documentId).catch((error) =>
        this.logger.error(
          { documentId, err: error },
          'periodic compaction failed',
        ),
      );
    }, COLLAB_SAVE_INTERVAL);
    timer.unref();
    this.compactTimers.set(documentId, timer);
  }

  private scheduleEviction(documentId: string): void {
    if (this.evictTimers.has(documentId)) return;

    const timer = setTimeout(
      () => void this.evict(documentId),
      COLLAB_EVICT_GRACE,
    );
    timer.unref();
    this.evictTimers.set(documentId, timer);
  }

  private cancelEviction(documentId: string): void {
    const timer = this.evictTimers.get(documentId);
    if (!timer) return;

    clearTimeout(timer);
    this.evictTimers.delete(documentId);
  }

  // закрыть пустую комнату
  private async evict(documentId: string): Promise<void> {
    this.evictTimers.delete(documentId);
    const room = this.rooms.get(documentId);

    if (!room?.isEmpty) return;

    this.rooms.delete(documentId);
    this.stopCompact(documentId);
    await room
      .dispose()
      .catch((error) =>
        this.logger.error({ documentId, err: error }, 'room dispose failed'),
      );
  }

  private stopCompact(documentId: string): void {
    const timer = this.compactTimers.get(documentId);
    if (timer) {
      clearInterval(timer);
      this.compactTimers.delete(documentId);
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.evictTimers.forEach(clearTimeout);
    this.compactTimers.forEach(clearInterval);

    // закрываем все комнаты
    await Promise.allSettled(
      [...this.rooms.values()].map((room) =>
        room
          .dispose()
          .catch((error) =>
            this.logger.error({ err: error }, 'room dispose failed'),
          ),
      ),
    );
  }
}
