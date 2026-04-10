import type { Root, Element, ElementContent } from 'hast';
import type { VFile } from 'vfile';
import { toAnchorId } from './anchorId';
import type { TocHeading, TocHeadingLevel } from '../../shared/types/toc';

declare module 'vfile' {
  interface DataMap {
    readonly headings: readonly TocHeading[];
  }
}

const HEADING_TAGS: Readonly<Record<string, TocHeadingLevel>> = {
  h1: 1,
  h2: 2,
  h3: 3,
  h4: 4,
  h5: 5,
  h6: 6,
};

const extractText = (nodes: ReadonlyArray<ElementContent>): string =>
  nodes
    .map((node) => {
      if (node.type === 'text') return node.value;
      if (node.type === 'element') return extractText(node.children);
      return '';
    })
    .join('');

const findUniqueId = (base: string, used: ReadonlySet<string>): string => {
  if (!used.has(base)) return base;
  const suffixed = Array.from({ length: used.size + 1 }, (_, i) => `${base}-${String(i + 2)}`);
  return suffixed.find((id) => !used.has(id)) ?? `${base}-${String(used.size + 2)}`;
};

const collectHeading = (
  el: Element,
  level: TocHeadingLevel,
  headings: TocHeading[],
  usedIds: Set<string>,
): void => {
  const text = extractText(el.children);
  const base = toAnchorId(text) || `heading-${String(headings.length + 1)}`;
  const id = findUniqueId(base, usedIds);
  usedIds.add(id);
  el.properties = { ...el.properties, id };
  headings.push({ level, id, text });
};

const visit = (
  nodes: ReadonlyArray<ElementContent>,
  headings: TocHeading[],
  usedIds: Set<string>,
): void => {
  nodes.forEach((node) => {
    if (node.type !== 'element') return;
    const level = HEADING_TAGS[node.tagName];
    if (level !== undefined) {
      collectHeading(node, level, headings, usedIds);
      return;
    }
    visit(node.children, headings, usedIds);
  });
};

/**
 * Pure extractor: walks the hast tree, mutates heading nodes to add unique
 * `properties.id`, and returns the collected headings. Extracted for direct
 * unit testing without unified plumbing.
 */
export const collectHeadings = (tree: Root): readonly TocHeading[] => {
  const headings: TocHeading[] = [];
  const usedIds = new Set<string>();
  visit(tree.children, headings, usedIds);
  return headings;
};

export const rehypeCollectHeadings = () => (tree: Root, file: VFile): void => {
  file.data.headings = collectHeadings(tree);
};
