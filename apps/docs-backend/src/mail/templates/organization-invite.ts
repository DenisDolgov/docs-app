import { ORGANIZATION_INVITE_LINK_TTL_DAYS } from '../mail.constants';
import type { RenderedMail } from '../mail.models';
import { button, paragraph, plainLink, renderLayout } from './layout';

export const organizationInviteTemplate = ({
  link,
  organizationName,
  inviterEmail,
}: {
  link: string;
  organizationName: string;
  inviterEmail: string;
}): RenderedMail => {
  const ttl = `${ORGANIZATION_INVITE_LINK_TTL_DAYS} дн.`;

  // В `text` разметки нет, поэтому название остаётся как ввёл пользователь.
  // В `html` оно проходит через `paragraph`/`renderLayout`, где экранируется.
  return {
    subject: `Приглашение в организацию «${organizationName}»`,
    text: [
      'Здравствуйте!',
      '',
      `${inviterEmail} приглашает вас в организацию «${organizationName}».`,
      '',
      `Принять приглашение: ${link}`,
      '',
      `Ссылка живёт ${ttl}`,
    ].join('\n'),
    html: renderLayout({
      title: `Приглашение в организацию «${organizationName}»`,
      content: [
        paragraph('Здравствуйте!'),
        paragraph(
          `${inviterEmail} приглашает вас в организацию «${organizationName}».`,
        ),
        button(link, 'Принять приглашение'),
        plainLink(link),
        paragraph(`Ссылка живёт ${ttl}`),
      ].join(''),
    }),
  };
};
