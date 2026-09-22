// Build-time constants injected by `define` in `vite.config.ts`, surfaced as
// a typed module so the rest of the app imports values instead of reaching
// for global magic identifiers.

/** Semantic version from `package.json` at build time. */
export const APP_VERSION: string = __APP_VERSION__;

/** Human-facing build label (`<version>[.<run>][-<slot>]`). */
export const BUILD_LABEL: string = __BUILD_LABEL__;

/** The project name shown in the header. */
export const APP_NAME: string = __APP_NAME__;

/**
 * The commit this bundle was built from, full sha — empty when the build had
 * no git and no `GITHUB_SHA` to ask. The footer shows the first seven and
 * links at the commit, which is the whole point: a build label says *which*
 * deploy a bug report came from, a commit says what was in it.
 */
export const BUILD_COMMIT: string = __BUILD_COMMIT__;

/** Where this bundle's source lives, for the footer's commit link. */
export const REPO_URL = "https://github.com/nQuake/web-installer";
