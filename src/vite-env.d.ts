/// <reference types="vite/client" />

declare const __APP_VERSION__: string;
declare const __BUILD_LABEL__: string;
declare const __APP_NAME__: string;

interface ImportMetaEnv {
  readonly VITE_DISTFILES_REPO?: string;
  readonly VITE_DISTFILES_REF?: string;
  readonly VITE_UPSTREAM_REPO?: string;
  readonly VITE_UPSTREAM_REF?: string;
  readonly VITE_MANIFEST_URL?: string;
  readonly VITE_UPSTREAM_URL?: string;
}
