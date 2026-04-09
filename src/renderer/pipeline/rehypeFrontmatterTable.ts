import type { Root } from 'hast';

type HastText = { type: 'text'; value: string };

type HastElement = {
  type: 'element';
  tagName: string;
  properties: Record<string, unknown>;
  children: HastChild[];
};

type HastChild = HastElement | HastText;

type HastRoot = {
  type: 'root';
  children: HastChild[];
};

const makeText = (value: string): HastText => ({ type: 'text', value });

const makeElement = (tagName: string, className: string | null, children: HastChild[]): HastElement => ({
  type: 'element',
  tagName,
  properties: className ? { className: [className] } : {},
  children,
});

const renderValue = (value: unknown): HastChild => {
  if (Array.isArray(value)) {
    const badges = (value as unknown[]).map((item): HastChild =>
      makeElement('span', 'frontmatter-badge', [makeText(String(item))]),
    );
    return makeElement('span', null, badges);
  }
  if (value !== null && typeof value === 'object') {
    return makeText(JSON.stringify(value as Record<string, unknown>));
  }
  return makeText(value === null || value === undefined ? '' : String(value as string | number | boolean));
};

const expandFrontmatterTable = (node: HastElement): HastElement => {
  const dataStr = typeof node.properties['data'] === 'string' ? node.properties['data'] : '{}';
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(dataStr) as Record<string, unknown>;
  } catch {
    parsed = {};
  }

  const rows: HastChild[] = Object.entries(parsed).map(([key, value]): HastElement => ({
    type: 'element',
    tagName: 'tr',
    properties: {},
    children: [
      makeElement('td', 'frontmatter-key', [makeText(key)]),
      makeElement('td', 'frontmatter-value', [renderValue(value)]),
    ],
  }));

  return makeElement('div', 'frontmatter-table', [
    makeElement('table', null, [
      makeElement('tbody', null, rows),
    ]),
  ]);
};

const transformNode = (node: HastChild): HastChild => {
  if (node.type === 'element' && node.tagName === 'frontmatter-table') {
    return expandFrontmatterTable(node);
  }
  return node;
};

export const rehypeFrontmatterTable = () => (tree: Root) => {
  const root = tree as unknown as HastRoot;
  root.children = root.children.map(transformNode);
};
