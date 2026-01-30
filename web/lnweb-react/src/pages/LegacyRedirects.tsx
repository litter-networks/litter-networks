// Copyright Clean and Green Communities CIC / Litter Networks
// SPDX-License-Identifier: Apache-2.0

import { Navigate, useParams } from 'react-router-dom';

/**
 * Redirects legacy /network/:filterString routes to the current /:filterString routes.
 */
export function LegacyNetworkRedirect() {
  const params = useParams<{ filterString?: string; '*': string }>();
  const filterString = params.filterString ?? 'all';
  const rest = params['*'];

  const target = `/${filterString}${rest ? `/${rest}` : ''}`.replace(/\/+/g, '/');

  return <Navigate to={target} replace />;
}

/**
 * Redirects legacy /knowledge/* routes to the network-aware /all/knowledge/* routes.
 */
export function LegacyKnowledgeRedirect() {
  const params = useParams<{ '*': string }>();
  const rest = params['*'];
  const target = `/all/knowledge${rest ? `/${rest}` : ''}`.replace(/\/+/g, '/');

  return <Navigate to={target} replace />;
}

/**
 * Redirects legacy /rules route to the canonical knowledge page.
 */
export function LegacyRulesRedirect() {
  return <Navigate to="/all/knowledge/getting-started/rules" replace />;
}

/**
 * Redirects legacy /knowledge/safetyadvice to the canonical safety page.
 */
export function LegacySafetyAdviceRedirect() {
  return <Navigate to="/all/knowledge/getting-started/safety" replace />;
}
