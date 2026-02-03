// Copyright Clean and Green Communities CIC / Litter Networks
// SPDX-License-Identifier: Apache-2.0

const rawEnv: ImportMetaEnv =
  typeof import.meta !== 'undefined' ? import.meta.env : (({} as unknown) as ImportMetaEnv);

const DEFAULT_DEV_API = 'http://local.litternetworks.org:8080';
const DEFAULT_PROD_API = '/api';
const DEFAULT_CDN = 'https://cdn.litternetworks.org';

const resolvedAppEnv = rawEnv.VITE_APP_ENV ?? rawEnv.MODE ?? 'development';
const isDevelopment = resolvedAppEnv === 'development';
const defaultApiBase = isDevelopment ? DEFAULT_DEV_API : DEFAULT_PROD_API;

export const appEnv = {
  apiBaseUrl: rawEnv.VITE_API_BASE_URL?.replace(/\/$/, '') ?? defaultApiBase,
  cdnBaseUrl: rawEnv.VITE_CDN_BASE_URL?.replace(/\/$/, '') ?? DEFAULT_CDN,
  staticAssetsBaseUrl:
    rawEnv.VITE_STATIC_ASSETS_BASE_URL?.replace(/\/$/, '') ??
    rawEnv.VITE_CDN_BASE_URL?.replace(/\/$/, '') ??
    DEFAULT_CDN,
  appEnv: resolvedAppEnv,
};

export const isDevEnv = isDevelopment;
