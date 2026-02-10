import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { TooltipProvider } from './components/ui/tooltip.jsx';
import '@fontsource-variable/inter/index.css';
import '@fontsource-variable/jetbrains-mono/index.css';
import './styles/globals.css';
import './styles/workspace.css';
import './styles/chart.css';
import './styles/mobile.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <TooltipProvider>
      <App />
    </TooltipProvider>
  </React.StrictMode>
);
