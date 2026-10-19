import { PASSWORD_RESET_LINK_TTL_HOURS } from '../mail.constants';
import type { RenderedMail } from '../mail.models';
import { button, paragraph, plainLink, renderLayout } from './layout';

export const passwordResetTemplate = ({
  to,
  link,
}: {
  to: string;
  link: string;
}): RenderedMail => {
  const ttl = `${PASSWORD_RESET_LINK_TTL_HOURS} ч.`;

  return {
    subject: 'Сброс пароля',
    text: [
      'Здравствуйте!',
      '',
      `Вы запросили сброс пароля для ${to}: ${link}`,
      '',
      `Ссылка живёт ${ttl}`,
      'Если это были не вы, пароль менять не нужно — просто проигнорируйте письмо.',
    ].join('\n'),
    html: renderLayout({
      title: 'Сброс пароля',
      content: [
        paragraph('Здравствуйте!'),
        paragraph(`Вы запросили сброс пароля для ${to}.`),
        button(link, 'Задать новый пароль'),
        plainLink(link),
        paragraph(`Ссылка живёт ${ttl}`),
        paragraph(
          'Если это были не вы, пароль менять не нужно — просто проигнорируйте письмо.',
        ),
      ].join(''),
    }),
  };
};
