import { useEffect } from 'react';
import { useNavData } from '@/features/nav/NavDataContext';

export function usePageTitle(title: string) {
  const { network } = useNavData();

  useEffect(() => {
    const networkName = network?.fullName ?? network?.uniqueId ?? '';
    const suffix = networkName ? `${networkName} Litter Network` : 'Litter Networks';
    document.title = `${title} - ${suffix}`;
  }, [title, network?.fullName, network?.uniqueId]);
}
