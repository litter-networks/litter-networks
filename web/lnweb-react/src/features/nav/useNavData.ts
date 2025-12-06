// Copyright Clean and Green Communities CIC / Litter Networks
// SPDX-License-Identifier: Apache-2.0

import { useContext } from 'react';
import { NavDataContext } from './NavDataContextBase';

export function useNavData() {
  const context = useContext(NavDataContext);
  if (!context) {
    throw new Error('useNavData must be used within NavDataProvider');
  }
  return context;
}
