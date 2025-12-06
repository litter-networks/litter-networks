// Copyright Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

import type { Network } from '@/data-sources/networks';

export interface DistrictGroup {
  id: string;
  name: string;
  networks: Network[];
  councilUrl?: string;
  councilName?: string;
}
