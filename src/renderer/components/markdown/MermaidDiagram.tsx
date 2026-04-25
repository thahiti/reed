import { type FC, useEffect, useState } from 'react';
import mermaid from 'mermaid';
import { useThemeMode } from '../../contexts/ThemeModeContext';

type MermaidDiagramProps = {
  readonly chart: string;
};

let mermaidId = 0;

export const MermaidDiagram: FC<MermaidDiagramProps> = ({ chart }) => {
  const mode = useThemeMode();
  const [svg, setSvg] = useState('');

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: mode === 'dark' ? 'dark' : 'default',
      securityLevel: 'strict',
    });

    const id = `mermaid-${String(++mermaidId)}`;
    void mermaid.render(id, chart).then(({ svg: rendered }) => {
      setSvg(rendered);
    });
  }, [chart, mode]);

  return (
    <div
      className="mermaid-diagram"
      data-testid="mermaid-diagram"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};
