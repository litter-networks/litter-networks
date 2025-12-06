// Copyright Clean and Green Communities CIC / Litter Networks
// SPDX-License-Identifier: Apache-2.0

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
import { withErrorBoundary } from './utils/withErrorBoundary';

const MapAreaPageBounded = withErrorBoundary(MapAreaPage, 'Map Area Page');
const AppLayoutBounded = withErrorBoundary(AppLayout, 'App Layout');
const HomePageBounded = withErrorBoundary(HomePage, 'Home Page');
const NewsPageBounded = withErrorBoundary(NewsPage, 'News Page');
const JoinInPageBounded = withErrorBoundary(JoinInPage, 'Join In Page');
const JoinInChoosePageBounded = withErrorBoundary(JoinInChoosePage, 'Join In Choose Page');
const JoinInStatsPageBounded = withErrorBoundary(JoinInStatsPage, 'Join In Stats Page');
const JoinInResourcesPageBounded = withErrorBoundary(JoinInResourcesPage, 'Join In Resources Page');
const KnowledgePageBounded = withErrorBoundary(KnowledgePage, 'Knowledge Page');
const RedirectToNetworkRootBounded = withErrorBoundary(RedirectToNetworkRoot, 'Redirect');

const router = createBrowserRouter([
  {
    path: '/maps/area',
    element: <MapAreaPageBounded />,
  },
  {
    path: '/:filterString?',
    element: <AppLayoutBounded />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        index: true,
        element: <HomePageBounded />,
      },
      {
        path: 'news',
        element: <NewsPageBounded />,
      },
      {
        path: 'join-in',
        element: <JoinInPageBounded />,
      },
      {
        path: 'join-in/choose',
        element: <JoinInChoosePageBounded />,
      },
      {
        path: 'join-in/stats/:formal?',
        element: <JoinInStatsPageBounded />,
      },
      {
        path: 'join-in/resources',
        element: <JoinInResourcesPageBounded />,
      },
      {
        path: 'knowledge/*',
        element: <KnowledgePageBounded />,
      },
      {
        path: '*',
        element: <RedirectToNetworkRootBounded />,
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/all" replace />,
  },
]);

export default router;
