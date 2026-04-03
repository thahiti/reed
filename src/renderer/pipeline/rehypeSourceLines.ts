import type { Root } from 'hast';

const blockTags = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'pre', 'blockquote', 'table', 'ul', 'ol', 'hr', 'div',
]);

type HastNode = {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  position?: { start: { line: number } };
  children?: ReadonlyArray<HastNode>;
};

const visitElements = (node: HastNode): void => {
  if (node.type === 'element' && node.tagName && blockTags.has(node.tagName) && node.position?.start.line) {
    node.properties = {
      ...node.properties,
      'data-source-line': node.position.start.line,
    };
  }
  if (node.children) {
    node.children.forEach((child) => { visitElements(child); });
  }
};

export const rehypeSourceLines = () => (tree: Root) => {
  visitElements(tree as unknown as HastNode);
};
