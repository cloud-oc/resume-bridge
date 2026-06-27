import React from 'react';
import ReactDOM from 'react-dom/client';
import '@/shared/styles/global.css';
import { initializeTheme } from '@/shared/theme';
import Sidebar from '@/app/sidebar/Sidebar';

initializeTheme();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Sidebar />
  </React.StrictMode>
);
