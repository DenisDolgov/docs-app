import { Injectable, NotFoundException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { UserRepository } from '../auth/user.repository';
import { normalizeEmail } from '../common/utils/email';
import { UnitOfWork } from '../database/unit-of-work';
import { USER_NOT_FOUND_ERROR } from '../organization/errors';
import { AccessPolicyService } from './access-policy.service';
import { FolderShareRepository } from './folder-share.repository';
import type {
  FolderShareListItem,
  FolderShareView,
  GrantFolderShareByEmailParams,
  GrantFolderShareParams,
  ListFolderSharesParams,
  RevokeFolderShareParams,
} from './permission.models';

// Выдача и отзыв share на папку. Смена состава доступа пишется в аудит в той
// же транзакции, а кэш права документов поддерева инвалидируется после коммита.
@Injectable()
export class FolderShareService {
  constructor(
    private readonly folderShareRepository: FolderShareRepository,
    private readonly accessPolicy: AccessPolicyService,
    private readonly userRepository: UserRepository,
    private readonly auditService: AuditService,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  public async grant({
    folderId,
    userId,
    role,
    actorId,
  }: GrantFolderShareParams): Promise<FolderShareView> {
    await this.assertCanManageShares(folderId, actorId);

    const share = await this.unitOfWork.run(async (tx) => {
      const share = await this.folderShareRepository.upsert(
        { folderId, userId, role, actorId },
        tx,
      );

      await this.auditService.record(
        {
          actorId,
          action: 'folder_share.granted',
          targetType: 'folder',
          targetId: folderId,
          metadata: { role, userId },
        },
        tx,
      );

      return share;
    });

    await this.accessPolicy.invalidateFolder(folderId);

    return share;
  }

  public async grantByEmail({
    folderId,
    email,
    role,
    actorId,
  }: GrantFolderShareByEmailParams) {
    const user = await this.userRepository.findByEmail(normalizeEmail(email));

    if (!user) throw new NotFoundException(USER_NOT_FOUND_ERROR);

    const share = await this.grant({
      folderId,
      userId: user.id,
      role,
      actorId,
    });

    return { ...share, email: user.email };
  }

  public async revoke({
    folderId,
    userId,
    actorId,
  }: RevokeFolderShareParams): Promise<boolean> {
    await this.assertCanManageShares(folderId, actorId);

    const removed = await this.unitOfWork.run(async (tx) => {
      const removed = await this.folderShareRepository.deleteByFolderAndUser(
        folderId,
        userId,
        tx,
      );

      await this.auditService.record(
        {
          actorId,
          action: 'folder_share.revoked',
          targetType: 'folder',
          targetId: folderId,
          metadata: { userId },
        },
        tx,
      );

      return removed;
    });

    if (removed) await this.accessPolicy.invalidateFolder(folderId);

    return removed;
  }

  public async list({
    folderId,
    actorId,
  }: ListFolderSharesParams): Promise<FolderShareListItem[]> {
    await this.assertCanManageShares(folderId, actorId);

    return this.folderShareRepository.listByFolder(folderId);
  }

  private assertCanManageShares(folderId: string, actorId: string) {
    return this.accessPolicy.assertFolderAccess({
      folderId,
      principal: { userId: actorId },
      required: 'owner',
    });
  }
}
