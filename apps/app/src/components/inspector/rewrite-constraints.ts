/**
 * Re-export the shared rewrite-constraints helpers so consumers in this app
 * import from a single local path. The actual encoding logic lives in
 * `packages/shared` so the worker uses the same vocabulary.
 */

export type { RewriteAlternative, RewriteConstraints } from "@prosodeus/shared/browser";
export {
  DEFAULT_REWRITE_CONSTRAINTS as DEFAULT_CONSTRAINTS,
  describeTone,
  encodeConstraintsAsDirectives,
  summarizeStructuralChange,
} from "@prosodeus/shared/browser";
