const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

// Один проход по строке: `&` не успевает попасть под замену повторно, поэтому
// двойного экранирования не бывает по построению, а не по порядку вызовов.
export const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => HTML_ENTITIES[char]);

const BODY_STYLE =
  'margin:0 0 16px;font:16px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2328;';

export const paragraph = (value: string) =>
  `<p style="${BODY_STYLE}">${escapeHtml(value)}</p>`;

// Ссылка приходит уже собранной, но в html она попадает в атрибут `href`,
// поэтому экранируется как значение атрибута, а не как текст.
export const button = (url: string, label: string) =>
  `<p style="margin:0 0 16px"><a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#1f6feb;color:#ffffff;font:600 16px/1 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;text-decoration:none">${escapeHtml(label)}</a></p>`;

export const plainLink = (url: string) =>
  `<p style="${BODY_STYLE}word-break:break-all"><a href="${escapeHtml(url)}" style="color:#1f6feb">${escapeHtml(url)}</a></p>`;

export const renderLayout = ({
  title,
  content,
}: {
  title: string;
  content: string;
}) => `<!doctype html>
<html lang="ru">
  <body style="margin:0;padding:24px;background:#f6f8fa;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:12px;">
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 16px;font:600 20px/1.3 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2328;">${escapeHtml(title)}</h1>
                ${content}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
