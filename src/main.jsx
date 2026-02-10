import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import MobileApp from './mobile/MobileApp.jsx';
import './styles/tokens.css';
import './styles/base.css';
import './styles/chart.css';
import './styles/mobile.css';

const isMobile = window.innerWidth <= 768;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isMobile ? <MobileApp /> : <App />}
  </React.StrictMode>
);
