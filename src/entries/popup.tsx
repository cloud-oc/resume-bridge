import React from 'react';
import ReactDOM from 'react-dom/client';
import '@/shared/styles/global.css';
import Popup from '@/app/popup/Popup';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
);
