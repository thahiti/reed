import type { FC, HTMLAttributes, PropsWithChildren } from 'react';

type CodeBlockProps = PropsWithChildren<
  HTMLAttributes<HTMLDivElement> & {
    readonly language?: string;
  }
>;

export const CodeBlock: FC<CodeBlockProps> = ({ language, children, ...rest }) => (
  <div className="code-block-wrapper" {...rest}>
    {language ? <span className="code-block-language">{language}</span> : null}
    <pre className="code-block">
      <code className={language ? `language-${language}` : undefined}>
        {children}
      </code>
    </pre>
  </div>
);
