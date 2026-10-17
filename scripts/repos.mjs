/**
 * Upstream repos whose docs sync into this site.
 * Each repo contributes docs/user-guide/** → pages/<slug>/guide/** and
 * docs/dev-guide/** → pages/<slug>/dev/** — always cloned from `main`
 * (the officially released source), never from feature/develop branches.
 *
 * Shared by sync-repo-docs.mjs and check-docs-drift.mjs.
 */
export const REPOS = [
  { git: 'https://github.com/michaelsogos/primebrick-v3-backend.git', slug: 'backend' },
  { git: 'https://github.com/michaelsogos/primebrick-v3-frontend.git', slug: 'frontend' },
  { git: 'https://github.com/michaelsogos/primebrick-v3-microservices.git', slug: 'microservices', serviceDocs: true },
  { git: 'https://github.com/michaelsogos/primebrick-v3-dal.git', slug: 'dal' },
  { git: 'https://github.com/michaelsogos/primebrick-v3-sdk.git', slug: 'sdk' },
  // Dev-guide only — decimal is a developer library; no user-guide tier exists,
  // so it publishes to pages/decimal/dev/** and never enters the product KB.
  { git: 'https://github.com/michaelsogos/primebrick-decimal.git', slug: 'decimal' },
];
