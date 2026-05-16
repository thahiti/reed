import { basename, extname } from 'node:path';

export const derivePdfName = (mdPath: string): string => {
  const base = basename(mdPath);
  const ext = extname(base);
  const stem = ext ? base.slice(0, -ext.length) : base;
  return `${stem}.pdf`;
};
