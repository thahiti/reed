import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import rehypeReact from 'rehype-react';
import { Fragment, jsx, jsxs } from 'react/jsx-runtime';
import type { ReactElement } from 'react';
import { Heading } from '../components/markdown/Heading';
import { Paragraph } from '../components/markdown/Paragraph';
import { InlineCode } from '../components/markdown/InlineCode';
import { CodeBlock } from '../components/markdown/CodeBlock';
import { Blockquote } from '../components/markdown/Blockquote';
import { List, ListItem } from '../components/markdown/List';
import { Table, TableHead, TableBody, TableRow, TableCell } from '../components/markdown/Table';
import { Image } from '../components/markdown/Image';
import { Link } from '../components/markdown/Link';
import { Divider } from '../components/markdown/Divider';
import { Checkbox } from '../components/markdown/Checkbox';
import { MermaidDiagram } from '../components/markdown/MermaidDiagram';

type AnyProps = Record<string, unknown>;

type ChildElement = { props?: { className?: string; children?: string } };

const getFirstChild = (props: AnyProps): unknown =>
  Array.isArray(props.children) ? (props.children as unknown[])[0] : props.children;

const isMermaidPre = (props: AnyProps): boolean => {
  const child = getFirstChild(props);
  if (!child || typeof child !== 'object') return false;
  const childEl = child as ChildElement;
  return childEl.props?.className === 'language-mermaid';
};

const getMermaidChart = (props: AnyProps): string => {
  const child = getFirstChild(props);
  if (!child || typeof child !== 'object') return '';
  const childEl = child as ChildElement;
  return childEl.props?.children ?? '';
};

const buildProcessor = () => {
  const processor = unified();
  processor.use(remarkParse);
  processor.use(remarkGfm);
  processor.use(remarkMath);
  processor.use(remarkRehype);
  processor.use(rehypeKatex);
  processor.use(rehypeHighlight, { detect: true });
  processor.use(rehypeReact, {
    Fragment,
    jsx,
    jsxs,
    components: {
      h1: (props: AnyProps) => jsx(Heading, { ...props, level: 1 }),
      h2: (props: AnyProps) => jsx(Heading, { ...props, level: 2 }),
      h3: (props: AnyProps) => jsx(Heading, { ...props, level: 3 }),
      h4: (props: AnyProps) => jsx(Heading, { ...props, level: 4 }),
      h5: (props: AnyProps) => jsx(Heading, { ...props, level: 5 }),
      h6: (props: AnyProps) => jsx(Heading, { ...props, level: 6 }),
      p: Paragraph,
      code: InlineCode,
      pre: (props: AnyProps) => {
        if (isMermaidPre(props)) {
          return jsx(MermaidDiagram, { chart: getMermaidChart(props) });
        }
        return jsx(CodeBlock, props);
      },
      blockquote: Blockquote,
      ul: (props: AnyProps) => jsx(List, { ...props, ordered: false }),
      ol: (props: AnyProps) => jsx(List, { ...props, ordered: true }),
      li: ListItem,
      table: Table,
      thead: TableHead,
      tbody: TableBody,
      tr: TableRow,
      th: (props: AnyProps) => jsx(TableCell, { ...props, isHeader: true }),
      td: (props: AnyProps) => jsx(TableCell, { ...props, isHeader: false }),
      img: (props: AnyProps) => {
        const src = typeof props.src === 'string' ? props.src : '';
        const alt = typeof props.alt === 'string' ? props.alt : '';
        return jsx(Image, { src, alt });
      },
      a: (props: AnyProps) => {
        const href = typeof props.href === 'string' ? props.href : '#';
        return jsx(Link, { ...props, href });
      },
      hr: Divider,
      input: (props: AnyProps) =>
        props.type === 'checkbox'
          ? jsx(Checkbox, { checked: Boolean(props.checked ?? false) })
          : jsx('input', props),
    } as Record<string, unknown>,
  });
  return processor;
};

export const processMarkdown = (markdown: string): ReactElement => {
  const processor = buildProcessor();
  const file = processor.processSync(markdown);
  return file.result as ReactElement;
};
