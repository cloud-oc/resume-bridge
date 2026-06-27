import React from 'react';
import ReactDOM from 'react-dom/client';
import '@/shared/styles/global.css';
import Options from '@/app/options/Options';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Options />
  </React.StrictMode>
);
