import { Logger } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuditEventParams } from '../../src/audit/audit.models';
import { AuditRepository } from '../../src/audit/audit.repository';
import { AuditService } from '../../src/audit/audit.service';
import type { DbExecutor } from '../../src/database/database.constants';

// Контракт куска S18: два режима отказа ядра журнала.
describe('AuditService (unit)', () => {
  const params: AuditEventParams = {
    actorId: '01920000-0000-7000-8000-000000000001',
    action: 'document_share.granted',
    targetType: 'document',
    targetId: '01920000-0000-7000-8000-000000000002',
    metadata: { userId: '01920000-0000-7000-8000-000000000003' },
  };
  const tx = {} as DbExecutor;

  let insert: ReturnType<typeof vi.fn>;
  let service: AuditService;

  beforeEach(() => {
    insert = vi.fn();
    service = new AuditService({ insert } as unknown as AuditRepository);
  });

  it('record пишет через репозиторий с переданным исполнителем', async () => {
    insert.mockResolvedValueOnce(undefined);

    await service.record(params, tx);

    expect(insert).toHaveBeenCalledWith(params, tx);
  });

  it('record пробрасывает отказ репозитория', async () => {
    insert.mockRejectedValueOnce(new Error('insert failed'));

    await expect(service.record(params, tx)).rejects.toThrow('insert failed');
  });

  it('recordBestEffort не бросает отказ и оставляет след в логе', async () => {
    insert.mockRejectedValueOnce(new Error('insert failed'));
    const errorSpy = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    try {
      await expect(service.recordBestEffort(params)).resolves.toBeUndefined();

      expect(errorSpy).toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });
});
