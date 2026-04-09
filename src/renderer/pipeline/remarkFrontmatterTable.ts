import { parse } from 'yaml';

type MdastNode = {
  type: string;
  value?: string;
  children?: MdastNode[];
  data?: { hName?: string; hProperties?: Record<string, unknown> };
};

type MdastRoot = {
  type: 'root';
  children: MdastNode[];
};

export const parseFrontmatter = (yamlString: string): string | null => {
  if (!yamlString.trim()) return null;
  try {
    const parsed: unknown = parse(yamlString);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const entries = Object.entries(parsed as Record<string, unknown>);
    if (entries.length === 0) return null;
    return JSON.stringify(parsed);
  } catch {
    return null;
  }
};

export const remarkFrontmatterTable = () => (tree: MdastRoot) => {
  const yamlNode = tree.children.find((node) => node.type === 'yaml');
  if (!yamlNode?.value) return;

  const data = parseFrontmatter(yamlNode.value);
  if (!data) return;

  yamlNode.data = {
    hName: 'frontmatter-table',
    hProperties: { data },
  };
};
