import { type FC, useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

type MermaidDiagramProps = {
  readonly chart: string;
};

let mermaidId = 0;

export const MermaidDiagram: FC<MermaidDiagramProps> = ({ chart }) => {
  const [svg, setSvg] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mermaid.initialize({ startOnLoad: false, theme: 'default' });

    const id = `mermaid-${String(++mermaidId)}`;
    void mermaid.render(id, chart).then(({ svg: rendered }) => {
      setSvg(rendered);
    });
  }, [chart]);

  return (
    <div
      className="mermaid-diagram"
      data-testid="mermaid-diagram"
      ref={containerRef}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};
