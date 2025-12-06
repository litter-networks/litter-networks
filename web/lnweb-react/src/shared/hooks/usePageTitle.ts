// Copyright Clean and Green Communities CIC / Litter Networks
// SPDX-License-Identifier: Apache-2.0

import { useEffect } from 'react';
import { useNavData } from '@/features/nav/useNavData';

/**
 * Set the document title to a page-specific title followed by the current network suffix.
 *
 * If the active network exposes `fullName` or `uniqueId`, the suffix will be "`<name> Litter Network`"; otherwise the suffix will be "Litter Networks". The final document title will be formatted as "`<title> - <suffix>`".
 *
 * @param title - Page-specific title text to place before the network suffix
 */
export function usePageTitle(title: string) {
  const { network } = useNavData();

  useEffect(() => {
    const networkName = network?.fullName ?? network?.uniqueId ?? '';
    const suffix = networkName ? `${networkName} Litter Network` : 'Litter Networks';
    document.title = `${title} - ${suffix}`;
  }, [title, network?.fullName, network?.uniqueId]);
}
