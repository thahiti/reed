import type { Root } from 'mdast';

type MdastNode = {
  readonly type: string;
  readonly value?: string;
  children?: ReadonlyArray<MdastNode>;
};

type TextNode = { readonly type: 'text'; readonly value: string };
type StrongNode = { readonly type: 'strong'; readonly children: ReadonlyArray<TextNode> };
type ResultNode = TextNode | StrongNode;

const STRONG_RE = /\*\*(.+?)\*\*/g;

const splitTextNode = (value: string): ReadonlyArray<ResultNode> => {
  const parts: ResultNode[] = [];
  let lastIndex = 0;

  STRONG_RE.lastIndex = 0;
  let match = STRONG_RE.exec(value);
  while (match !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: value.slice(lastIndex, match.index) });
    }
    const content = match[1];
    if (content) {
      parts.push({
        type: 'strong',
        children: [{ type: 'text', value: content }],
      });
    }
    lastIndex = STRONG_RE.lastIndex;
    match = STRONG_RE.exec(value);
  }

  if (lastIndex < value.length) {
    parts.push({ type: 'text', value: value.slice(lastIndex) });
  }

  return parts;
};

const visitTextNodes = (node: MdastNode): void => {
  if (!node.children) return;

  const newChildren: MdastNode[] = [];
  let changed = false;

  for (const child of node.children) {
    if (child.type === 'text' && child.value && child.value.includes('**')) {
      const parts = splitTextNode(child.value);
      const first = parts[0];
      if (parts.length > 1 || (parts.length === 1 && first && first.type !== 'text')) {
        newChildren.push(...parts);
        changed = true;
        continue;
      }
    }
    newChildren.push(child);
    visitTextNodes(child);
  }

  if (changed) {
    node.children = newChildren;
  }
};

export const remarkStrongFallback = () => (tree: Root) => {
  visitTextNodes(tree as unknown as MdastNode);
};
