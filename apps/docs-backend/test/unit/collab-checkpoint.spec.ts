import { describe, expect, it } from 'vitest';

import { decideCheckpoint } from '../../src/collab/checkpoint';
import type { CheckpointFacts } from '../../src/collab/collab.models';

// Контракт куска S1: когда писать авто-чекпоинт и на каком watermark'е.
const NOW = new Date('2026-11-11T12:00:00.000Z');

const facts = (overrides: Partial<CheckpointFacts> = {}): CheckpointFacts => ({
  lastUpdateId: 120,
  updatesSinceCheckpoint: 1,
  lastCheckpointAt: new Date('2026-11-11T11:55:00.000Z'),
  ...overrides,
});

describe('decideCheckpoint', () => {
  it('пишет чекпоинт, когда апдейтов накопилось достаточно', () => {
    expect(decideCheckpoint(facts({ updatesSinceCheckpoint: 50 }), NOW)).toBe(
      120,
    );
  });

  it('не пишет, пока мало и апдейтов, и времени', () => {
    expect(
      decideCheckpoint(facts({ updatesSinceCheckpoint: 49 }), NOW),
    ).toBeNull();
  });

  it('пишет чекпоинт, когда прошёл интервал с прошлого', () => {
    expect(
      decideCheckpoint(
        facts({
          updatesSinceCheckpoint: 1,
          lastCheckpointAt: new Date('2026-11-11T11:50:00.000Z'),
        }),
        NOW,
      ),
    ).toBe(120);
  });

  it('не пишет, если с прошлого чекпоинта не было апдейтов', () => {
    expect(
      decideCheckpoint(
        facts({
          updatesSinceCheckpoint: 0,
          lastCheckpointAt: new Date('2026-11-11T11:00:00.000Z'),
        }),
        NOW,
      ),
    ).toBeNull();
  });

  it('не пишет, если в журнале ещё нет ни одного апдейта', () => {
    expect(
      decideCheckpoint(
        facts({ lastUpdateId: null, updatesSinceCheckpoint: 0 }),
        NOW,
      ),
    ).toBeNull();
  });

  it('первый чекпоинт пишет только по счётчику апдейтов', () => {
    expect(
      decideCheckpoint(
        facts({ lastCheckpointAt: null, updatesSinceCheckpoint: 49 }),
        NOW,
      ),
    ).toBeNull();
    expect(
      decideCheckpoint(
        facts({ lastCheckpointAt: null, updatesSinceCheckpoint: 50 }),
        NOW,
      ),
    ).toBe(120);
  });

  it('watermark — последний записанный апдейт, а не счётчик', () => {
    expect(
      decideCheckpoint(
        facts({ lastUpdateId: 7777, updatesSinceCheckpoint: 50 }),
        NOW,
      ),
    ).toBe(7777);
  });
});
