import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { EmailVerificationPolicy } from '../auth/email-verification-policy';
import { generateToken, hashToken } from '../auth/token';
import { UserRepository } from '../auth/user.repository';
import { normalizeEmail } from '../common/utils/email';
import { UnitOfWork } from '../database/unit-of-work';
import { MailService } from '../mail/mail.service';
import {
  INVITE_ALREADY_MEMBER_ERROR,
  INVITE_EMAIL_MISMATCH_ERROR,
  INVITE_INVALID_ERROR,
  INVITE_NOT_FOUND_ERROR,
  ORGANIZATION_NOT_FOUND_ERROR,
  USER_ALREADY_MEMBER_ERROR,
  USER_NOT_FOUND_ERROR,
} from './errors';
import {
  canManageMembers,
  ORGANIZATION_INVITE_TTL,
  ORGANIZATION_INVITE_TTL_DAYS,
} from './organization.constants';
import type {
  AcceptedInvite,
  AcceptInviteParams,
  AddMemberParams,
  IssuedInvite,
  IssueInviteParams,
  ListInvitesParams,
  OrganizationInviteView,
  ResendInviteParams,
  RevokeInviteParams,
} from './organization.models';
import { OrganizationService } from './organization.service';
import { OrganizationInviteRepository } from './organization-invite.repository';
import { OrganizationMemberRepository } from './organization-member.repository';

// Письмо уходит fire-and-forget после коммита: падение SMTP не должно
// откатывать уже созданное приглашение (TD26).
const toInviteView = ({
  id,
  organizationId,
  email,
  role,
  createdAt,
  expiresAt,
}: IssuedInvite): OrganizationInviteView => ({
  id,
  organizationId,
  email,
  role,
  createdAt,
  expiresAt,
  acceptedAt: null,
});

@Injectable()
export class OrganizationInviteService {
  private readonly logger = new Logger(OrganizationInviteService.name);

  constructor(
    private readonly organizationInviteRepository: OrganizationInviteRepository,
    private readonly organizationMemberRepository: OrganizationMemberRepository,
    private readonly organizationService: OrganizationService,
    private readonly userRepository: UserRepository,
    private readonly emailVerificationPolicy: EmailVerificationPolicy,
    private readonly unitOfWork: UnitOfWork,
    private readonly mailService: MailService,
  ) {}

  // HTTP-вход приглашения: проверка права и подготовка данных для письма.
  // Выпуск токена — `issue`.
  public async invite({
    organizationId,
    actorId,
    email,
    role,
  }: AddMemberParams): Promise<OrganizationInviteView> {
    await this.assertCanManageInvites(organizationId, actorId);

    const normalizedEmail = normalizeEmail(email);

    await this.assertInviteeIsNotMember(organizationId, normalizedEmail);

    const organization =
      await this.organizationService.findOrganization(organizationId);

    if (!organization) {
      throw new NotFoundException(ORGANIZATION_NOT_FOUND_ERROR);
    }

    const inviter = await this.userRepository.findById(actorId);

    if (!inviter) throw new NotFoundException(USER_NOT_FOUND_ERROR);

    const issued = await this.issue({
      organizationId,
      actorId,
      email: normalizedEmail,
      role,
      organizationName: organization.name,
      inviterEmail: inviter.email,
    });

    return toInviteView(issued);
  }

  public async list({
    organizationId,
    actorId,
  }: ListInvitesParams): Promise<OrganizationInviteView[]> {
    await this.assertCanManageInvites(organizationId, actorId);

    return this.organizationInviteRepository.listByOrganization(organizationId);
  }

  public async revoke({
    organizationId,
    inviteId,
    actorId,
  }: RevokeInviteParams): Promise<boolean> {
    await this.assertCanManageInvites(organizationId, actorId);

    const revoked = await this.organizationInviteRepository.revoke(
      organizationId,
      inviteId,
    );

    if (!revoked) throw new NotFoundException(INVITE_NOT_FOUND_ERROR);

    return true;
  }

  // Переотправка — это новое приглашение на тот же адрес: старый токен гаснет
  // внутри `issue`, иначе письмо и БД разошлись бы.
  public async resend({
    organizationId,
    inviteId,
    actorId,
  }: ResendInviteParams): Promise<OrganizationInviteView> {
    await this.assertCanManageInvites(organizationId, actorId);

    const invite = await this.organizationInviteRepository.findById(
      organizationId,
      inviteId,
    );

    if (!invite) throw new NotFoundException(INVITE_NOT_FOUND_ERROR);

    await this.assertInviteeIsNotMember(organizationId, invite.email);

    const organization =
      await this.organizationService.findOrganization(organizationId);

    if (!organization) {
      throw new NotFoundException(ORGANIZATION_NOT_FOUND_ERROR);
    }

    const inviter = await this.userRepository.findById(actorId);

    if (!inviter) throw new NotFoundException(USER_NOT_FOUND_ERROR);

    const issued = await this.issue({
      organizationId,
      actorId,
      email: invite.email,
      role: invite.role,
      organizationName: organization.name,
      inviterEmail: inviter.email,
    });

    return toInviteView(issued);
  }

  // Выпуск токена: гашение прежнего живого приглашения и вставка нового — одна
  // единица работы. Оба запроса обязаны идти в `tx`: вставка мимо транзакции
  // упрётся в частичный уникальный индекс и повиснет до её коммита.
  public async issue({
    organizationId,
    actorId,
    email,
    role,
    organizationName,
    inviterEmail,
  }: IssueInviteParams): Promise<IssuedInvite> {
    const token = generateToken();

    const issuedInvite = await this.unitOfWork.run(async (tx) => {
      await this.organizationInviteRepository.revokeLiveByOrgAndEmail(
        organizationId,
        email,
        tx,
      );

      const inviteRecord = await this.organizationInviteRepository.create(
        {
          organizationId,
          email,
          role,
          createdBy: actorId,
          expiresAt: new Date(Date.now() + ORGANIZATION_INVITE_TTL),
          tokenHash: hashToken(token),
        },
        tx,
      );

      return { ...inviteRecord, token };
    });

    this.mailService
      .sendOrganizationInvite({
        to: email,
        token,
        organizationName,
        inviterEmail,
        ttlDays: ORGANIZATION_INVITE_TTL_DAYS,
      })
      .catch((error) => {
        this.logger.error(
          { email, err: error },
          'не удалось отправить письмо с приглашением',
        );
      });

    return issuedInvite;
  }

  public async accept({
    token,
    userId,
  }: AcceptInviteParams): Promise<AcceptedInvite> {
    const tokenHash = hashToken(token);

    const user = await this.userRepository.findById(userId);

    if (!user) throw new NotFoundException(USER_NOT_FOUND_ERROR);

    const pending =
      await this.organizationInviteRepository.findByTokenHash(tokenHash);

    if (!pending) throw new NotFoundException(INVITE_NOT_FOUND_ERROR);

    if (pending.email !== user.email) {
      throw new ForbiddenException(INVITE_EMAIL_MISMATCH_ERROR);
    }

    const organization = await this.organizationService.findOrganization(
      pending.organizationId,
    );

    if (!organization) {
      throw new NotFoundException(ORGANIZATION_NOT_FOUND_ERROR);
    }

    return this.unitOfWork.run(async (tx) => {
      const invite = await this.organizationInviteRepository.consume(
        tokenHash,
        tx,
      );

      // Просроченное, отозванное и уже принятое сюда не попадают.
      if (!invite) throw new BadRequestException(INVITE_INVALID_ERROR);

      // Пока приглашение ждало, участника могли добавить напрямую: вставка
      // упёрлась бы в `member_unique` и дала 500. Откатываем погашение и
      // отвечаем конфликтом — роль из письма уже не применить.
      const existing = await this.organizationMemberRepository.findByOrgAndUser(
        invite.organizationId,
        userId,
        tx,
      );

      if (existing) throw new ConflictException(INVITE_ALREADY_MEMBER_ERROR);

      await this.organizationMemberRepository.create(
        {
          organizationId: invite.organizationId,
          role: invite.role,
          userId,
        },
        tx,
      );

      return {
        organizationId: invite.organizationId,
        organizationName: organization.name,
        role: invite.role,
      };
    });
  }

  private async assertCanManageInvites(
    organizationId: string,
    actorId: string,
  ): Promise<void> {
    const actorMember = await this.organizationService.requireMember(
      organizationId,
      actorId,
    );

    if (!canManageMembers(actorMember.role)) throw new ForbiddenException();

    await this.emailVerificationPolicy.assertEmailVerified(actorId);
  }

  // Приглашать того, кто уже участник, бессмысленно: письмо приведёт в ту же
  // организацию, где доступ уже есть. Участники видны и без приглашения.
  private async assertInviteeIsNotMember(
    organizationId: string,
    email: string,
  ): Promise<void> {
    const user = await this.userRepository.findByEmail(email);

    if (!user) return;

    const member = await this.organizationMemberRepository.findByOrgAndUser(
      organizationId,
      user.id,
    );

    if (member) throw new ConflictException(USER_ALREADY_MEMBER_ERROR);
  }
}
