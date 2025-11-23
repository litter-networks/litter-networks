import { Navigate, useParams } from 'react-router-dom';
import { useNavData } from '@/features/nav/NavDataContext';

export function RedirectToNetworkRoot() {
  const { filterString } = useParams<{ filterString?: string }>();
  const { network } = useNavData();

  const target = network ? `/${filterString ?? 'all'}` : '/all';

  return <Navigate to={target} replace />;
}
