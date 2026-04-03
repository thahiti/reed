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
  readonly onChange: (content: string) => void;
  readonly onSave: () => void;
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
    padding: '16px 0',
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

export const MarkdownEditor: FC<MarkdownEditorProps> = ({ content, isDark, onChange, onSave }) => {
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

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [isDark]);

  return <div className="markdown-editor" ref={containerRef} />;
};

export { undo, redo };
