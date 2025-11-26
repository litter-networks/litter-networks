import type { Network } from '@/data-sources/networks';

export interface DistrictGroup {
  id: string;
  name: string;
  networks: Network[];
  councilUrl?: string;
  councilName?: string;
}
