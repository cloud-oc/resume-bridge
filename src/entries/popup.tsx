import React from 'react';
import ReactDOM from 'react-dom/client';
import '@/shared/styles/global.css';
import { initializeTheme } from '@/shared/theme';
import Popup from '@/app/popup/Popup';

initializeTheme();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
);
