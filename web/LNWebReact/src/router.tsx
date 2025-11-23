import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import { RouteErrorBoundary } from './pages/RouteErrorBoundary';
import { HomePage } from './pages/home/HomePage';
import { RedirectToNetworkRoot } from './pages/RedirectToNetworkRoot';
import { NewsPage } from './pages/news/NewsPage';
import { KnowledgePage } from './pages/knowledge/KnowledgePage';
import { JoinInPage } from './pages/join-in/JoinInPage';
import { JoinInStatsPage } from './pages/join-in/JoinInStatsPage';
import { JoinInResourcesPage } from './pages/join-in/JoinInResourcesPage';
import { JoinInChoosePage } from './pages/join-in/JoinInChoosePage';
import { MapAreaPage } from './pages/maps/MapAreaPage';

const router = createBrowserRouter([
  {
    path: '/maps/area',
    element: <MapAreaPage />,
  },
  {
    path: '/:filterString?',
    element: <AppLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: 'news',
        element: <NewsPage />,
      },
      {
        path: 'join-in',
        element: <JoinInPage />,
      },
      {
        path: 'join-in/choose',
        element: <JoinInChoosePage />,
      },
      {
        path: 'join-in/stats/:formal?',
        element: <JoinInStatsPage />,
      },
      {
        path: 'join-in/resources',
        element: <JoinInResourcesPage />,
      },
      {
        path: 'knowledge/*',
        element: <KnowledgePage />,
      },
      {
        path: '*',
        element: <RedirectToNetworkRoot />,
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/all" replace />,
  },
]);

export default router;
