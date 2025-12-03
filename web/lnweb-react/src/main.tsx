import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import './index.css';
import router from './router.tsx';
import { ErrorBoundary } from '@/components/error-boundary/ErrorBoundary';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary name="Router">
      <RouterProvider router={router} />
    </ErrorBoundary>
  </StrictMode>,
);
