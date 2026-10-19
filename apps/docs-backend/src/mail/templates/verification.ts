import type { RenderedMail } from '../mail.models';
import { button, paragraph, plainLink, renderLayout } from './layout';

export const verificationTemplate = ({
  to,
  link,
  ttlHours,
}: {
  to: string;
  link: string;
  ttlHours: number;
}): RenderedMail => {
  const ttl = `${ttlHours} ч.`;

  return {
    subject: 'Подтверждение почты',
    text: [
      'Здравствуйте!',
      '',
      `Подтвердите адрес ${to}: ${link}`,
      '',
      `Ссылка живёт ${ttl}`,
      'Если вы не регистрировались, просто проигнорируйте письмо.',
    ].join('\n'),
    html: renderLayout({
      title: 'Подтверждение почты',
      content: [
        paragraph('Здравствуйте!'),
        paragraph(`Подтвердите адрес ${to}.`),
        button(link, 'Подтвердить адрес'),
        plainLink(link),
        paragraph(`Ссылка живёт ${ttl}`),
        paragraph('Если вы не регистрировались, просто проигнорируйте письмо.'),
      ].join(''),
    }),
  };
};
