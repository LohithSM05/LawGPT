import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n/config'; // must init before any component calls useTranslation()
import App from './App';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
