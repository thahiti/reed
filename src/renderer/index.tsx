import './styles/fonts.css';
import './styles/global.css';
import 'highlight.js/styles/github.css';
import './styles/app.css';
import './styles/markdown.css';
import './styles/tabs.css';
import './styles/quick-open.css';
import './styles/welcome.css';
import './styles/editor.css';
import { createRoot } from 'react-dom/client';
import { App } from './App';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<App />);
}
