// Copyright 2025 Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

import { Navigate, useParams } from 'react-router-dom';
import { useNavData } from '@/features/nav/useNavData';

/**
 * Redirects to the network-aware root path using the current route parameter and navigation context.
 *
 * @returns A JSX element that navigates to the computed root path (for example `"/all"` or `"/{filterString}"`) with `replace` enabled.
 */
export function RedirectToNetworkRoot() {
  const { filterString } = useParams<{ filterString?: string }>();
  const { network } = useNavData();

  const target = network ? `/${filterString ?? 'all'}` : '/all';

  return <Navigate to={target} replace />;
}
