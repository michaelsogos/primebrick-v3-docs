---
title: "README"
source: guide
repo: "dal"
---


Type-driven PostgreSQL Data Access Layer for Primebrick v3.

## What it is

A shared library that provides a metadata-based, type-safe `Repository` for PostgreSQL. Entities are plain TS classes decorated with `@Entity`, `@Column`, `@Key`, `@Unique`, `@AuditableField`, `@DeletableField`. The Repository reads entity metadata at runtime to generate parameterized SQL — no hand-written queries, no DTOs, snake_case everywhere.

The `Dal` gateway class (`getDal()`) owns the `pg.Pool`, registers type parsers, and enforces best-practice pool defaults (`statement_timeout`, `connectionTimeoutMillis`, `search_path`, `application_name`) to prevent connection throttling under high-async REST traffic. One singleton instance per process per database, reused across all requests — zero per-request allocation.

## Consumers

- **primebrick-us-v3** (microservices) — Phase 2 (after DAL is released)
- **primebrick-be-v3** (backend) — Phase 3 (after US integration)

## Commands

| Action | Command |
|--------|---------|
| Install | `pnpm install` |
| Build | `pnpm run build` |
| Test | `pnpm test` |
| Test (watch) | `pnpm test:watch` |
| Benchmarks | `pnpm test:benchmark` |

## Architecture

```
src/
  dal/            Dal gateway — pool ownership, type parsers, getDal singleton, withClient
  meta/           entity metadata + decorators + column PG<->JS coercion
  query/          query DSL (filters, sorts, joins, projection) + streaming
  repository/     the Repository class — type-driven CRUD, finders, bulk ops
  errors/         NotFoundError, MultipleRowsError
  types/          FindOptions, BulkOptions, AuditPort, LoggerPort
  audit/          auditable field types + join helpers
  index.ts        public barrel
```

## Key design decisions

- **snake_case everywhere** — DB columns, TS properties, JSON responses all use snake_case. No DTO transformation.
- **RETURNING \*** on all writes — the DB returns the full row after insert/update/delete, hydrated directly into the entity shape.
- **throwIfNotFound: true** by default on all finders — pass `{ throwIfNotFound: false }` to get `null` instead.
- **deletedRecords: "EXCLUDED"** by default — soft-deleted rows are excluded from finders unless `{ deletedRecords: "ONLY" }` or `"INCLUDED"`.
- **TEMP TABLE strategy** for `updateMany` / `upsertMany` — `CREATE TEMP TABLE ... ON COMMIT DROP` → batched INSERT → single `UPDATE FROM` / `INSERT SELECT ON CONFLICT`. Atomic, SQL-injection safe, scales to millions of rows.
- **Audit-aware ON CONFLICT** — `upsertMany` preserves `created_at`/`created_by` on conflict, stamps `updated_at`/`updated_by`/`version`.
- **bigint via INT8_OID type parser** — `int8` columns return native `bigint`, not strings. Registered by the `Dal` gateway (consumers no longer need to do this manually).
- **Metadata-driven numeric handling** — `@Column({ dbType: "numeric", precision: 15, scale: 2 })` returns `number` when safe, `string` when precision overflows `Number.MAX_SAFE_INTEGER`.
- **Dal gateway** — `getDal(config)` singleton owns the pool, registers type parsers, sets `statement_timeout`/`search_path`/`application_name` on every connection. `withClient(fn, { timeoutMs })` for transactions and per-call timeout override. `close()` for graceful shutdown.
- **statement_timeout as anti-throttling** — default 30s per session. A slow query holding a connection starves the pool under burst traffic; the timeout guarantees connection release. Per-call override for bulk ops (`SET LOCAL` inside tx) and ad-hoc long queries (`withClient`).

## GitFlow

This repository follows GitFlow. See [docs/gitflow.md](./docs/gitflow.md) for complete rules.

## AI documentation

- [AGENTS.md](./AGENTS.md) — entry point for AI agents
- [docs/ai/](./docs/ai/) — AI-first documentation
- [.devin/rules/](./.devin/rules/) — always-on rules for Devin agents
- [.devin/skills/](./.devin/skills/) — invokable skills

## License

MIT — see [LICENSE](./LICENSE)
