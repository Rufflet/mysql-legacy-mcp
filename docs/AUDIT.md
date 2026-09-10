# Publication audit

Reviewed on 2026-09-09. This is a maintainer record, excluded from the npm tarball.

## Evidence from this checkout

The checkout initially had no Git remote and no tracked project files. Existing source, tests, and documentation were untracked user work. No historical failure logs or live MySQL results were supplied.

`src/server.js` uses mysqljs `mysql`, not `mysql2`. It uses a connection pool (`MYSQL_LEGACY_POOL_SIZE`, default 5) instead of one connection per tool query, created lazily on first use so `tools/list` still succeeds without a reachable database. Connection settings expose host, port, user, password, optional database, a configurable connection timeout (`MYSQL_LEGACY_CONNECT_TIMEOUT`), and `multipleStatements: false`. No explicit pool shutdown/signal handler is installed: the process is a long-lived stdio server owned entirely by its MCP client, which is expected to terminate it directly rather than send a graceful shutdown signal; the OS reclaims the pooled sockets on process exit.

| Area | Implemented behavior | Claim boundary |
| --- | --- | --- |
| Metadata | SHOW DATABASES, SHOW FULL TABLES, SHOW FULL COLUMNS, SHOW CREATE TABLE, SHOW INDEX | No dependency on newer information_schema columns |
| SQL features | SELECT VERSION() plus SHOW metadata | No built-in CTEs or JSON functions. `START TRANSACTION READ ONLY` is used for `mysql_legacy_select` only on MySQL ≥5.6.5 (detected via cached `SELECT VERSION()`) and only when `MYSQL_LEGACY_DISABLE_READ_ONLY_TRANSACTIONS` is not `true`; older or unparsable versions silently fall back to a plain query |
| Version handling | Ping returns VERSION(); `mysql_legacy_select` separately detects and caches the parsed version once per process for read-only-transaction gating | No compatibility negotiation beyond that gate, no other version-specific SQL, no recorded patch-level test matrix |
| Authentication | Driver defaults | insecureAuth is false; no exposed old-password switch |
| Charset | Driver default UTF8_GENERAL_CI | Avoids requesting utf8mb4; no latin1/cp1251 override or validated encoding tests |
| TLS | Driver default false | Plain TCP, not a TLS compatibility implementation |
| SQL filtering | Single parsed statement per call; SELECT rejects INTO and locking reads; UPDATE/DELETE require a WHERE clause (non-configurable); DDL is restricted to table-level CREATE/ALTER/DROP/TRUNCATE/RENAME | Not database-enforced: privileges still required. Write tools (`mysql_legacy_insert`/`_update`/`_delete`/`_ddl`) are implemented and unit-tested (`test/static-smoke.js`) but each is disabled by default behind its own `MYSQL_LEGACY_ALLOW_*` flag |
| Output | SELECT rows and JSON bytes truncated after fetch | Does not bound database work or process memory; metadata output uncapped |

**Live-verified 2026-09-10 (second pass, see "Live runs" below):** the four write tools and the read-only-transaction wrapping were run against the full 5.0–8.0 matrix, both with all four `MYSQL_LEGACY_ALLOW_*` flags left at their default `false` and with all four explicitly set to `true`. Every version passed both passes. `START TRANSACTION READ ONLY`/`COMMIT`/`ROLLBACK` was chosen over `SET SESSION TRANSACTION READ ONLY` specifically so a pooled connection cannot return to the pool carrying a stale read-only session setting into a later write-tool call; the one unexercised edge case is a connection where both `COMMIT` and the fallback `ROLLBACK` fail (e.g. the socket dies mid-transaction) — the `mysql` driver marks such connections fatal and removes them from the pool rather than returning them to the free list, but this specific failure mode is not covered by a test.

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

### Live runs, 2026-09-10 (first pass — 7 read-only tools)

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

### Live runs, 2026-09-10 (second pass — pool, write tools, read-only transactions)

Rerun of the full matrix after adding the connection pool, the four opt-in write tools, and version-gated read-only transactions. `scripts/smoke-mcp.js` now asserts 11 registered tools and drives 20 checks per pass. Each version was tested twice from a fresh instance: once with no `MYSQL_LEGACY_ALLOW_*` variables set (all four write tools must reject as disabled) and once with `MYSQL_LEGACY_ALLOW_INSERT=true MYSQL_LEGACY_ALLOW_UPDATE=true MYSQL_LEGACY_ALLOW_DELETE=true MYSQL_LEGACY_ALLOW_DDL=true` (each write tool must actually insert/update/delete/create/drop against a dedicated `legacy_smoke_writes` scratch table, isolated from the read-only fixture). Test accounts this time were granted `ALL PRIVILEGES` on the target database plus global `SELECT, SHOW VIEW` (a disposable local container, not a production privilege model — see [Configuration](CONFIGURATION.md) for the minimal privileges a real deployment needs per write tool).

| Version | Source | Disabled-flags pass | Enabled-flags pass | Read-only-transaction branch (`supportsReadOnlyTransactions`) |
| --- | --- | --- | --- | --- |
| 5.0.51a-24+lenny5 | Real `mysql-server-5.0`, Debian Lenny archive, `--platform linux/386` | 20/20 | 20/20 | Below 5.6.5 — silent plain-query fallback |
| 5.1.73-1+deb6u1 | Real `mysql-server-5.1`, Debian Squeeze archive, `--platform linux/386` | 20/20 | 20/20 | Below 5.6.5 — silent plain-query fallback |
| 5.5.62 | Official Docker `mysql:5.5` | 20/20 | 20/20 | Below 5.6.5 — silent plain-query fallback |
| 5.6.51 | Official Docker `mysql:5.6` | 20/20 | 20/20 | At/above 5.6.5 — `START TRANSACTION READ ONLY` / `COMMIT` actually used |
| 5.7.44 | Official Docker `mysql:5.7` | 20/20 | 20/20 | At/above 5.6.5 — `START TRANSACTION READ ONLY` / `COMMIT` actually used |
| 8.0.46, default `caching_sha2_password` account | Official Docker `mysql:8.0` | 10/20 (same documented boundary as the first pass: only checks that don't require a successful DB connection pass — `tools/list`, the two SELECT rejection checks, and all four disabled-write-tool checks, since the flag check runs before any DB call) | Not applicable — this account cannot authenticate at all; the enabled-flags pass was only run against the `mysql_native_password` account below | n/a — no query reached the server |
| 8.0.46, `mysql_native_password` account | Official Docker `mysql:8.0` | 20/20 | 20/20 | At/above 5.6.5 — `START TRANSACTION READ ONLY` / `COMMIT` actually used |

No official Docker image exists for MySQL 5.0 or 5.1; the same Debian-archive/`--platform linux/386` approach from the first pass was reused, and it worked without needing to rediscover the vsyscall workaround below.

The vsyscall/i386 diagnosis from the first pass still applies and was not re-encountered: any x86_64 binary built before ~2013 (Squeeze/Lenny's own `apt`, `ldd`, and MySQL) depends on the legacy vsyscall page, which this host's kernel has disabled; `--platform linux/386` sidesteps it entirely since 32-bit x86 never used vsyscalls.

Two real issues were found and fixed during this pass, both flagged here rather than silently patched:

1. **Test bug in `scripts/smoke-mcp.js`** (not a `src/server.js` bug): the four disabled-flag checks (`mysql_legacy_insert (disabled)` etc.) called the existing `textOf()` helper to read the rejection message, but `textOf()` throws whenever `result.isError` is true — it was written for checks that expect success. Every disabled-tool check therefore failed even though the server correctly rejected the call; the check's own assertion logic never actually ran. Fixed by adding a second helper, `errorTextOf()`, that reads `result.content[0].text` without throwing, and using it in the four disabled-branch checks. Re-run after the fix: all versions passed 20/20 on the disabled-flags pass.
2. **Seeding-only charset issue** (not a `src/server.js` or test bug): inserting the Cyrillic/Western-European fixture row via `mysql -uroot ... -e "INSERT ..."` without `--default-character-set=utf8` on the client sent the UTF-8 source bytes under the client's own default charset (`latin1` on the official MySQL 5.5–8.0 images), corrupting the stored value before the MCP server ever saw it. Fixed by adding `--default-character-set=utf8` to every seeding `mysql` invocation across all versions. This was a test-setup mistake, not a driver or server defect — the driver's own default charset request (`UTF8_GENERAL_CI`, unrelated to this) was never in question.

One other seeding detail worth recording for future runs: a throwaway test account granted only `ALL PRIVILEGES ON legacy_app.*` cannot see the `mysql`/`information_schema` databases via `SHOW DATABASES`, which made the `include_system_databases` check fail until the account was also granted global `SELECT, SHOW VIEW ON *.*` — this matches the production guidance in [Configuration](CONFIGURATION.md) that `mysql_legacy_list_databases(include_system_databases: true)` needs visibility into system databases to return them.

One other snag carried over from the first pass: seeding via a single multi-statement heredoc into `mysql -uroot` on a fresh instance silently stops partway through after an early failure, with no fatal exit code. Running each statement as its own `mysql -e` call (as done throughout this pass) avoids it.

Pre-4.1 `old_password` authentication remains untested: it predates every MySQL version reachable here, including 5.0.51a (which already defaults to the post-4.1 `mysql_native_password` scheme). Verifying it would need a MySQL 3.x/4.0 build or a 5.0 server explicitly reconfigured with `old_passwords=1`, both out of scope for this pass.

### Field test against a real production instance, 2026-09-10

Beyond the reproducible Docker/Debian-archive matrix above, the 0.2.0 work was also exercised once against the author's own real legacy production MySQL database, reached over an authorized local SSH tunnel and driven through the actual Claude Code MCP client — dogfooding the real usage path, not `scripts/smoke-mcp.js`. No host, database, or table name from this environment is recorded here or anywhere else in this repository.

Server version: 5.1.73. Authentication: the account connected successfully with no `insecureAuth`-equivalent option and no special configuration, which by itself confirms it uses the post-4.1 password format — this driver cannot complete a handshake with a pre-4.1 `old_password` account at all, with or without configuration. All 7 original read-only tools and all 4 opt-in write tools were called against the real schema; the write tools operated only on tables created for this purpose.

Confirmed live: `mysql_legacy_describe_table`'s new `collation` field and `mysql_legacy_show_create_table`'s new `charset` field, against a real `cp1251_general_ci` column; a full INSERT → SELECT → UPDATE → SELECT → DELETE round trip of Cyrillic text (including `ё` and an em dash) through the default `UTF8_GENERAL_CI` connection charset into a real `cp1251` table, byte-identical on every read back; the UPDATE/DELETE WHERE-clause guard rejecting a WHERE-less UPDATE before any query reached the server; and `mysql_legacy_ddl` creating and then dropping a disposable table without affecting any of the roughly 80 other tables in the schema (verified via `mysql_legacy_list_tables` before and after). A `DROP DATABASE` attempt made to check the DDL tool's table-level-only scope was blocked by Claude Code's own auto-mode safety classifier before it reached the MCP server, so that specific rejection path was not exercised this way in the field — it remains covered by `test/static-smoke.js` and the Docker matrix above.

Before upgrading a compatibility label further, record exact server patch version, auth format, Node version, representative encodings, and outcomes against a real server. Request the author's real failure messages; generic search phrases are not presented as personal incident evidence.

## Scope of changes

Packaging adds a bin entry and Node shebang, a publication allowlist, MIT, keywords, and a preliminary 0.1.0 version synchronized with the MCP server identity and lockfile. The entry-point guard resolves filesystem symlinks so the installed node_modules/.bin executable starts the server. Runtime query behavior has not been extended. Public documentation explains the existing capabilities and limits.

On 2026-09-10, authenticated GitHub API access confirmed the personal account Rufflet. The public repository is https://github.com/Rufflet/mysql-legacy-mcp. Package author, repository, homepage, and issues links are populated, and private: true has been removed. A server.json draft and matching mcpName prepare a future registry submission; no registry publication has occurred.
