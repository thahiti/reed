import type { Root } from 'hast';

type HastNode = {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: ReadonlyArray<HastNode>;
};

const EXTERNAL_RE = /^(?:https?:|data:)/;

const dirname = (filePath: string): string => {
  const lastSlash = filePath.lastIndexOf('/');
  return lastSlash >= 0 ? filePath.slice(0, lastSlash) : '';
};

const resolvePath = (baseDir: string, relativePath: string): string => {
  const parts = `${baseDir}/${relativePath}`.split('/');
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      resolved.pop();
    } else {
      resolved.push(part);
    }
  }
  return `/${resolved.join('/')}`;
};

export const resolveImageSrc = (src: string, basePath: string): string => {
  if (EXTERNAL_RE.test(src)) return src;
  if (!basePath) return src;

  const baseDir = dirname(basePath);
  const absolutePath = src.startsWith('/')
    ? src
    : resolvePath(baseDir, src);

  return `md-image://${absolutePath}`;
};

const visitImages = (node: HastNode, basePath: string): void => {
  if (node.type === 'element' && node.tagName === 'img' && node.properties) {
    const src = node.properties['src'];
    if (typeof src === 'string') {
      node.properties['src'] = resolveImageSrc(src, basePath);
    }
  }
  if (node.children) {
    node.children.forEach((child) => { visitImages(child, basePath); });
  }
};

export const rehypeImageResolve = (options: { readonly basePath: string }) =>
  (tree: Root) => {
    visitImages(tree as unknown as HastNode, options.basePath);
  };
