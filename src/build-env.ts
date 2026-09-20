// Build-time constants injected by `define` in `vite.config.ts`, surfaced as
// a typed module so the rest of the app imports values instead of reaching
// for global magic identifiers.

/** Semantic version from `package.json` at build time. */
export const APP_VERSION: string = __APP_VERSION__;

/** Human-facing build label (`<version>[.<run>][-<slot>]`). */
export const BUILD_LABEL: string = __BUILD_LABEL__;

/** The project name shown in the header. */
export const APP_NAME: string = __APP_NAME__;
