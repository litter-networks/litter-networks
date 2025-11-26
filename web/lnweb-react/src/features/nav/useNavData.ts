import { useContext } from 'react';
import { NavDataContext } from './NavDataContextBase';

export function useNavData() {
  const context = useContext(NavDataContext);
  if (!context) {
    throw new Error('useNavData must be used within NavDataProvider');
  }
  return context;
}
