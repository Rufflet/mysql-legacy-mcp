# Publication audit

Reviewed on 2026-09-09. This is a maintainer record, excluded from the npm tarball.

## Evidence from this checkout

The checkout initially had no Git remote and no tracked project files. Existing source, tests, and documentation were untracked user work. No historical failure logs or live MySQL results were supplied.

`src/server.js` uses mysqljs `mysql`, not `mysql2`. It creates one connection per tool query. Connection settings expose only host, port, user, password, optional database, a fixed connection timeout, and `multipleStatements: false`.

| Area | Implemented behavior | Claim boundary |
| --- | --- | --- |
| Metadata | SHOW DATABASES, SHOW FULL TABLES, SHOW FULL COLUMNS, SHOW CREATE TABLE, SHOW INDEX | No dependency on newer information_schema columns |
| SQL features | SELECT VERSION() plus SHOW metadata | No built-in CTEs, JSON functions, or SET TRANSACTION READ ONLY |
| Version handling | Ping returns VERSION() | No compatibility negotiation, version-specific SQL, or recorded patch-level test matrix |
| Authentication | Driver defaults | insecureAuth is false; no exposed old-password switch |
| Charset | Driver default UTF8_GENERAL_CI | Avoids requesting utf8mb4; no latin1/cp1251 override or validated encoding tests |
| TLS | Driver default false | Plain TCP, not a TLS compatibility implementation |
| SQL filtering | Single parsed SELECT, recursive INTO / locking-read rejection | Not database-enforced read-only; privileges still required |
| Output | SELECT rows and JSON bytes truncated after fetch | Does not bound database work or process memory; metadata output uncapped |

Driver defaults verified against [mysqljs 2.18.1 source](https://github.com/mysqljs/mysql/blob/v2.18.1/lib/ConnectionConfig.js). The prompt's assertion that this implementation exposes mysql2 insecureAuth is incorrect. The README does not repeat it.

## Dependencies

| Dependency | Initial declared range | Locked version | Node requirement in lockfile |
| --- | --- | --- | --- |
| @modelcontextprotocol/sdk | ^1.29.0 | 1.29.0 | >=18 |
| mysql | ^2.18.1 | 2.18.1 | >=0.6 |
| node-sql-parser | ^5.4.0 | 5.4.0 | >=8 |
| zod | ^3.24.2 | 3.25.76 | None declared |

Package Node minimum was >=18. The locked transitive @hono/node-server requires >=18.14.1, so the package minimum now matches that floor. This is dependency metadata, not evidence of runtime testing on that Node version. Zod's declared range is now ^3.25.0 to match the SDK's ^3.25 / ^4 peer requirement. Locked dependency versions are unchanged; mysql2 is absent.

## Version evidence

MySQL 5.1 is the original intended target. 5.0, 5.5, and 5.6 are plausible candidates based on built-in SQL, not tested support claims. Even 5.1 lacks a recorded live run here. The README labels every row accordingly.

`test/static-smoke.js` covers identifier quoting, SELECT filtering, and response truncation. `scripts/smoke-live.js` performs six direct driver checks: version, constant SELECT, database/table listings, columns, and CREATE TABLE metadata. It does not cover MCP stdio, indexes, real table SELECT, encoding round trips, or authentication variants.

Before upgrading a compatibility label, record exact server patch version, auth format, Node version, representative encodings, and outcomes. Request the author's real failure messages; generic search phrases are not presented as personal incident evidence.

## Scope of changes

Packaging adds a bin entry and Node shebang, a publication allowlist, MIT, keywords, and a preliminary 0.1.0 version synchronized with the MCP server identity and lockfile. The entry-point guard resolves filesystem symlinks so the installed node_modules/.bin executable starts the server. Runtime query behavior has not been extended. Public documentation explains the existing capabilities and limits.

On 2026-09-10, authenticated GitHub API access confirmed Rufflet / Alex Ershov. The public repository is https://github.com/Rufflet/mysql-legacy-mcp. Package author, repository, homepage, and issues links are populated, and private: true has been removed. A server.json draft and matching mcpName prepare a future registry submission; no registry publication has occurred.
