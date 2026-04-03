import type { FC, PropsWithChildren } from 'react';

type CodeBlockProps = PropsWithChildren<{
  readonly language?: string;
}>;

export const CodeBlock: FC<CodeBlockProps> = ({ language, children }) => (
  <div className="code-block-wrapper">
    {language ? <span className="code-block-language">{language}</span> : null}
    <pre className="code-block">
      <code className={language ? `language-${language}` : undefined}>
        {children}
      </code>
    </pre>
  </div>
);
