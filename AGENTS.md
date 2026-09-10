# Repository instructions

## Project and layout

`mysql-legacy-mcp` is a Node.js MCP server for MySQL 5.0–5.6 over stdio. It is read-only by default, with separately enabled INSERT, UPDATE, DELETE, and table-level DDL tools. Keep changes small and focused on legacy compatibility.

- `src/server.js`: executable entry point, MCP tool registration, SQL validation, connection pooling, environment configuration, and result formatting. Exported helpers can be imported without starting the server.
- `test/static-smoke.js`: database-free assertions for validators, identifier quoting, result limits, and version handling.
- `scripts/smoke-live.js`: direct database smoke checks.
- `scripts/smoke-mcp.js`: integration checks through a real MCP stdio session, including optional writes.
- `docs/`: installation, configuration, troubleshooting, compatibility evidence, roadmap, and release checklist.
- `.github/workflows/ci.yml`: checks on Node.js 18.14.1, 22, and 24.
- `package.json`, `package-lock.json`, and `server.json`: package dependencies and distribution metadata.

The MySQL driver is `mysql` (mysqljs), not `mysql2` — they have different option names and defaults (for example `insecureAuth`, which only exists on mysql2). Do not assume mysql2 documentation, options, or APIs apply here; verify against `node_modules/mysql`'s own source when in doubt.

Read `CONTRIBUTING.md` before changing code and `docs/ROADMAP.md` before expanding scope. Keep documentation and agent instructions in English.

## Commands and verification

Use Node.js 18.14.1 or later and npm. This repository uses JavaScript ES modules directly; there is no build, typecheck, or lint script.

```sh
npm ci
npm run check
npm run smoke:static
npm run smoke:live
npm run smoke:mcp
npm start
npm pack --dry-run --ignore-scripts
```

- Run checks such as `npm run check`, smoke tests, build/typecheck commands if added, and packaging validation in a separate sub-agent using a low-cost model.
- Before a PR, run `check` and `smoke:static`; neither requires a database. CI also checks package contents with `npm pack --dry-run --ignore-scripts`.
- Live checks require an authorized MySQL instance and `MYSQL_LEGACY_*` configuration. Read the scripts and `docs/AUDIT.md` for fixture requirements before running them. The MCP test can insert, update, delete, create, and drop when write flags are enabled; use disposable fixtures for those paths.
- Changes to SQL behavior, driver options, or version handling need live verification. Report the exact tested versions and any checks that could not be run; do not claim compatibility from static tests alone.

## Implementation conventions

- Follow the existing two-space indentation, single quotes, semicolons, and small focused functions. Add comments only when they explain a non-obvious reason.
- Reuse `env`, `booleanEnv`, `integerEnv`, `quoteIdentifier`, `qualifiedTable`, `schemaQueries`, `safely`, and `withConnection` where appropriate.
- SQL statement validation is AST-based via `node-sql-parser` (`sqlParser.astify`), not regex or string matching. Each validator parses the input, requires exactly one statement of the expected type, and applies any further guard (such as the UPDATE/DELETE WHERE requirement) on the parsed AST. Follow this pattern for new statement types instead of adding string-based checks.
- Keep stdout reserved for MCP protocol traffic. Send diagnostics to stderr, as the entry point does with `console.error`.
- Keep imports free of server-startup side effects so static tests can import helpers.
- Add relevant assertions to `test/static-smoke.js` when changing validation, quoting, limits, or version gates. Extend MCP smoke coverage when changing observable tool behavior.

## Compatibility and safety constraints

- Preserve MySQL 5.1-compatible SQL and `SHOW`-based metadata queries. Do not introduce dependencies on CTEs, JSON functions, or modern `information_schema` fields.
- Preserve single-statement parsing and `multipleStatements: false`. SELECT must reject `INTO` and locking reads; UPDATE and DELETE must require a WHERE clause.
- Keep each write tool disabled by default behind its own `MYSQL_LEGACY_ALLOW_*` flag. Keep DDL scoped to table-level operations.
- Gate read-only transactions at MySQL 5.6.5 and preserve the plain-query fallback for older servers. Keep transaction operations on the same pooled connection and ensure connection release.
- Preserve row and byte response limits. These truncate returned results after fetching; they are not database-side execution limits.
- SQL validation does not replace database privileges. Never commit credentials or log secrets; `.env.example` is the configuration template.
- TLS configuration, custom charsets, and pre-4.1 authentication are deferred work. Do not imply they are supported or change connection defaults incidentally.
- Record new compatibility claims in `docs/AUDIT.md` with actual server version, authentication method, Node.js version, and exercised behavior.

## Documentation and releases

Update README and the relevant documents when tools, configuration, or supported behavior change. Keep release versions consistent across `package.json`, `package-lock.json`, `src/server.js`, and `server.json` when bumping a release. Use `docs/RELEASE_CHECKLIST.md` for publication work.
