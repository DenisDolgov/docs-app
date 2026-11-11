import {
  COLLAB_CHECKPOINT_INTERVAL,
  COLLAB_CHECKPOINT_UPDATES,
} from './collab.constants';
import type { CheckpointFacts } from './collab.models';

export const decideCheckpoint = (
  facts: CheckpointFacts,
  now: Date,
): number | null => {
  // если апдейтов с прошлого чекпойнта не было
  if (facts.updatesSinceCheckpoint === 0) {
    return null;
  }

  const isNeedCheckpointByTyme = facts.lastCheckpointAt
    ? new Date(facts.lastCheckpointAt.getTime() + COLLAB_CHECKPOINT_INTERVAL) <=
      now
    : false;

  const isNeedCheckpointByUpdates =
    facts.updatesSinceCheckpoint >= COLLAB_CHECKPOINT_UPDATES;

  // если накопилось достаточно апдейтов или прошло достаточно времени с последнего чекпойнта
  if (isNeedCheckpointByTyme || isNeedCheckpointByUpdates) {
    return facts.lastUpdateId ?? null;
  }

  return null;
};
