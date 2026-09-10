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

Package Node minimum was >=18. The locked transitive @hono/node-server requires >=18.14.1, so the package minimum now matches that floor. This is dependency metadata, not evidence of runtime testing on that Node version. Zod's declared range is now ^3.25.0 to match the SDK's ^3.25 / ^4 peer requirement. Direct dependency versions are unchanged; mysql2 is absent. On 2026-09-10, five transitive dependencies were refreshed within existing ranges: @hono/node-server 1.19.17, hono 4.13.7, fast-uri 3.1.7, ip-address 10.7.0, and qs 6.16.0. The subsequent npm audit --omit=dev reported zero vulnerabilities.

## Version evidence

MySQL 5.1 was the original intended target and 5.0 the oldest labeled candidate; both are now live-verified (see below). The README's compatibility table reflects this.

`test/static-smoke.js` covers identifier quoting, SELECT filtering, and response truncation. `scripts/smoke-live.js` performs six direct driver checks: version, constant SELECT, database/table listings, columns, and CREATE TABLE metadata.

`scripts/smoke-mcp.js` was added on 2026-09-10 to close the previously noted gap: it spawns the real server over stdio and drives every tool through the actual MCP protocol, including `list_indexes`, a real table SELECT, a UTF-8 (non-emoji) round trip, and an informational utf8mb4/emoji check. It does not cover pre-4.1 `old_password` authentication — see the note at the end of this section.

### Live runs, 2026-09-10

One dedicated `legacy_reader`@`%` (SELECT, SHOW VIEW) account per instance, `scripts/smoke-mcp.js` driving all 7 tools through real MCP stdio transport. Each version was a fresh instance; results were not cross-contaminated.

| Version | Source | Result |
| --- | --- | --- |
| 5.0.51a-24+lenny5 | Real `mysql-server-5.0` package, Debian Lenny's own archived repo (`archive.debian.org`), run under `--platform linux/386` | 13/13 checks passed |
| 5.1.73-1+deb6u1 | Real `mysql-server-5.1` package, Debian Squeeze's own archived repo, `--platform linux/386` | 13/13 checks passed |
| 5.5.62 | Official Docker `mysql:5.5` | 13/13 checks passed |
| 5.6.51 | Official Docker `mysql:5.6` | 13/13 checks passed |
| 5.7.44 | Official Docker `mysql:5.7` | 13/13 checks passed |
| 8.0.46, default `caching_sha2_password` account | Official Docker `mysql:8.0` | 3/13 passed (only `tools/list` and the two rejection checks; every DB-dependent call failed with `ER_NOT_SUPPORTED_AUTH_MODE`) |
| 8.0.46, `mysql_native_password` account | Official Docker `mysql:8.0` | 13/13 checks passed |

No official Docker image exists for MySQL 5.0 or 5.1 (`docker manifest inspect` returned "no such manifest" for both tags against `docker.io/library/mysql` and `docker.io/mysql/mysql-server`). Rather than pull an anonymous third-party image, each was installed as the genuine MySQL package from its contemporary Debian release's own archived repository — the actual OS vendor's build, just long past EOL.

Getting there required diagnosing a real blocker, worth recording: on the first attempt, `apt-get update` inside `debian/eol:squeeze` (default amd64) died with "Method http has died unexpectedly" from a segfault, and even `ldd` on the same binary segfaulted. `dmesg` showed the actual cause: `vsyscall attempted with vsyscall=none`. Any x86_64 binary built before ~2013 — which includes Squeeze/Lenny's own `apt`, `ldd`, and MySQL itself — can rely on the legacy vsyscall page; this host's kernel (like most modern kernels) has vsyscalls fully disabled and cannot emulate them, so the process dies immediately on first use. This is a kernel/ABI incompatibility, not something an unofficial image (official, community, or self-built) can route around, since it strikes any period-correct amd64 binary regardless of who built it. The i386 build of the same package has no such dependency — 32-bit x86 never used vsyscalls — so running the container with `--platform linux/386` resolved it completely, with no code or kernel changes needed.

One other snag: seeding via a single multi-statement heredoc into `mysql -uroot` on a fresh instance silently stopped partway through after an early failure, leaving later statements (including the reader account) never executed, with no fatal exit code to flag it. Running each statement as a separate `mysql -e` call and checking its output resolved this and should be the pattern for any future live run.

Pre-4.1 `old_password` authentication remains untested: it predates every MySQL version reachable here, including 5.0.51a (which already defaults to the post-4.1 `mysql_native_password` scheme). Verifying it would need a MySQL 3.x/4.0 build or a 5.0 server explicitly reconfigured with `old_passwords=1`, both out of scope for this pass.

Before upgrading a compatibility label further, record exact server patch version, auth format, Node version, representative encodings, and outcomes against a real server. Request the author's real failure messages; generic search phrases are not presented as personal incident evidence.

## Scope of changes

Packaging adds a bin entry and Node shebang, a publication allowlist, MIT, keywords, and a preliminary 0.1.0 version synchronized with the MCP server identity and lockfile. The entry-point guard resolves filesystem symlinks so the installed node_modules/.bin executable starts the server. Runtime query behavior has not been extended. Public documentation explains the existing capabilities and limits.

On 2026-09-10, authenticated GitHub API access confirmed Rufflet / Alex Ershov. The public repository is https://github.com/Rufflet/mysql-legacy-mcp. Package author, repository, homepage, and issues links are populated, and private: true has been removed. A server.json draft and matching mcpName prepare a future registry submission; no registry publication has occurred.
