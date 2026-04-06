import { protocol, net } from 'electron';
import { extname, normalize } from 'node:path';

export const ALLOWED_EXTENSIONS: ReadonlyArray<string> = [
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.webp',
  '.bmp',
  '.ico',
];

const MIME_MAP: Readonly<Record<string, string>> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
};

export const getMimeType = (ext: string): string =>
  MIME_MAP[ext] ?? 'application/octet-stream';

export const registerImageProtocol = (): void => {
  protocol.handle('md-image', (request) => {
    const url = new URL(request.url);
    const filePath = normalize(decodeURIComponent(url.pathname));
    const ext = extname(filePath).toLowerCase();

    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return new Response('Forbidden', { status: 403 });
    }

    return net.fetch(`file://${filePath}`);
  });
};
