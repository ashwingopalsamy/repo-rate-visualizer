import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { App } from './app/App.tsx';

const root = document.getElementById('root')!;
const app = <StrictMode><App /></StrictMode>;
// Prerendered pages hydrate; the dev server renders from scratch.
if (root.hasChildNodes()) hydrateRoot(root, app); else createRoot(root).render(app);
