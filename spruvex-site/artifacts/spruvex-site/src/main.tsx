import { createRoot } from 'react-dom/client';
import './index.css';

const isAdmin = new URLSearchParams(window.location.search).has('admin');

async function mount() {
  if (isAdmin) {
    const { default: AdminPanel } = await import('./AdminPanel');
    createRoot(document.getElementById('root')!).render(<AdminPanel />);
  } else {
    const { default: App } = await import('./App');
    createRoot(document.getElementById('root')!).render(<App />);
  }
}

mount();
