import { type FC, useEffect, useRef } from 'react';
import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { defaultKeymap, historyKeymap, history, undo, redo } from '@codemirror/commands';
import { oneDark } from '@codemirror/theme-one-dark';

type MarkdownEditorProps = {
  readonly content: string;
  readonly isDark: boolean;
  readonly initialLine?: number;
  readonly onChange: (content: string) => void;
  readonly onSave: () => void;
  readonly onTopLineChange?: (line: number) => void;
};

const lightEditorTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: 'var(--font-body-size)',
    fontFamily: 'var(--font-code)',
  },
  '.cm-content': {
    fontFamily: 'var(--font-code)',
    lineHeight: 'var(--line-height)',
    padding: '16px 0 var(--spacing-content-padding)',
  },
  '.cm-scroller': {
    overflow: 'auto',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--color-code-bg)',
    color: 'var(--color-text-secondary)',
    border: 'none',
  },
  '.cm-activeLine': {
    backgroundColor: 'var(--color-selection)',
  },
  '.cm-selectionMatch': {
    backgroundColor: 'var(--color-selection)',
  },
});

const getTopVisibleLine = (view: EditorView): number => {
  const scrollTop = view.scrollDOM.scrollTop;
  const block = view.lineBlockAtHeight(scrollTop);
  const line = view.state.doc.lineAt(block.from);
  return line.number;
};

export const MarkdownEditor: FC<MarkdownEditorProps> = ({ content, isDark, initialLine, onChange, onSave, onTopLineChange }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const saveKeymap = keymap.of([
      {
        key: 'Mod-s',
        run: () => {
          onSave();
          return true;
        },
      },
    ]);

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChange(update.state.doc.toString());
      }
    });

    const extensions = [
      lineNumbers(),
      history(),
      drawSelection(),
      highlightActiveLine(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      saveKeymap,
      markdown({ codeLanguages: languages }),
      updateListener,
      EditorView.lineWrapping,
      lightEditorTheme,
    ];

    if (isDark) {
      extensions.push(oneDark);
    }

    const state = EditorState.create({
      doc: content,
      extensions,
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    // Force layout measurement after mount
    requestAnimationFrame(() => {
      view.requestMeasure();
    });

    // Restore scroll to initial line
    if (initialLine !== undefined && initialLine > 1) {
      requestAnimationFrame(() => {
        const lineCount = view.state.doc.lines;
        const targetLine = Math.min(initialLine, lineCount);
        const lineInfo = view.state.doc.line(targetLine);
        const block = view.lineBlockAt(lineInfo.from);
        view.scrollDOM.scrollTop = block.top;
      });
    }

    // Track top visible line on scroll
    if (onTopLineChange) {
      const handleScroll = () => {
        onTopLineChange(getTopVisibleLine(view));
      };
      view.scrollDOM.addEventListener('scroll', handleScroll, { passive: true });
    }

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [isDark]);

  return <div className="markdown-editor" ref={containerRef} />;
};

export { undo, redo };
