/**
 * Upstream repos whose docs sync into this site.
 * Each repo contributes docs/user-guide/** → pages/<slug>/guide/** and
 * docs/dev-guide/** → pages/<slug>/dev/** — always cloned from `main`
 * (the officially released source), never from feature/develop branches.
 *
 * Shared by sync-repo-docs.mjs, check-docs-drift.mjs and generate-nav.mjs.
 *
 * `label` / `icon` / `group` drive the Zudoku sidebar:
 *   group 'service' → "Services" category; group 'library' → "Libraries".
 * A repo without nav metadata syncs pages but gets no sidebar entry.
 */
export const REPOS = [
  { git: 'https://github.com/michaelsogos/primebrick-v3-backend.git', slug: 'backend', label: 'Backend', icon: 'server', group: 'service' },
  { git: 'https://github.com/michaelsogos/primebrick-v3-frontend.git', slug: 'frontend', label: 'Frontend', icon: 'monitor', group: 'service' },
  { git: 'https://github.com/michaelsogos/primebrick-v3-microservices.git', slug: 'microservices', label: 'Microservices', icon: 'boxes', group: 'service', serviceDocs: true },
  { git: 'https://github.com/michaelsogos/primebrick-v3-dal.git', slug: 'dal', label: 'DAL Library', icon: 'database', group: 'library' },
  { git: 'https://github.com/michaelsogos/primebrick-v3-sdk.git', slug: 'sdk', label: 'SDK Library', icon: 'package', group: 'library' },
  // Dev-guide only — decimal is a developer library; no user-guide tier exists,
  // so it publishes to pages/decimal/dev/** and never enters the product KB.
  { git: 'https://github.com/michaelsogos/primebrick-decimal.git', slug: 'decimal', label: 'Decimal Library', icon: 'calculator', group: 'library' },
];
