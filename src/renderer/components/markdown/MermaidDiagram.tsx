import { type FC, useEffect, useState } from 'react';
import mermaid from 'mermaid';
import { useThemeMode } from '../../contexts/ThemeModeContext';

type MermaidDiagramProps = {
  readonly chart: string;
};

type State =
  | { readonly status: 'pending' }
  | { readonly status: 'ready'; readonly svg: string }
  | { readonly status: 'error'; readonly message: string };

let mermaidId = 0;

export const MermaidDiagram: FC<MermaidDiagramProps> = ({ chart }) => {
  const mode = useThemeMode();
  const [state, setState] = useState<State>({ status: 'pending' });

  useEffect(() => {
    setState({ status: 'pending' });
    mermaid.initialize({
      startOnLoad: false,
      theme: mode === 'dark' ? 'dark' : 'default',
      securityLevel: 'strict',
    });

    const id = `mermaid-${String(++mermaidId)}`;
    mermaid
      .render(id, chart)
      .then(({ svg }) => {
        setState({ status: 'ready', svg });
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        setState({ status: 'error', message });
      });
  }, [chart, mode]);

  if (state.status === 'error') {
    return (
      <div className="mermaid-error" data-testid="mermaid-error" data-state="error">
        <div className="mermaid-error__title">Mermaid 다이어그램을 그릴 수 없습니다</div>
        <pre className="mermaid-error__message">{state.message}</pre>
        <pre className="mermaid-error__source"><code>{chart}</code></pre>
      </div>
    );
  }

  return (
    <div
      className="mermaid-diagram"
      data-testid="mermaid-diagram"
      data-state={state.status}
      dangerouslySetInnerHTML={{ __html: state.status === 'ready' ? state.svg : '' }}
    />
  );
};
