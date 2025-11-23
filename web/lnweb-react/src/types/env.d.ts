interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_CDN_BASE_URL?: string;
  readonly VITE_STATIC_ASSETS_BASE_URL?: string;
  readonly VITE_APP_ENV?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
