import type { NextConfig } from 'next';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const nextConfig: NextConfig = {
  // Картинка в контенте ссылается на стабильный `/files/:id/content`. Запрос
  // идёт на наш origin (браузер прикладывает httpOnly-куку), а Next
  // проксирует его на API, который отвечает редиректом на подписанную ссылку.
  async rewrites() {
    return [
      {
        source: '/files/:fileId/content',
        destination: `${API_URL}/files/:fileId/content`,
      },
    ];
  },
};

export default nextConfig;
