# Configuration

`mysql-legacy-mcp` is a local stdio server. Set its environment variables in the MCP client configuration; the server does not read `.env` files.

## Environment variables

| Variable | Default | Meaning |
| --- | --- | --- |
| `MYSQL_LEGACY_HOST` | Required | Database host or a local tunnel endpoint |
| `MYSQL_LEGACY_PORT` | `3306` | TCP port, 1–65535 |
| `MYSQL_LEGACY_USER` | Required | Dedicated reader account |
| `MYSQL_LEGACY_PASSWORD` | Required | Nonempty account password |
| `MYSQL_LEGACY_DATABASE` | Unset | Optional default database for SELECT queries |
| `MYSQL_LEGACY_HIDE_SYSTEM_DATABASES` | `true` | Hide `mysql` and `information_schema`; `true` or `false` |
| `MYSQL_LEGACY_QUERY_TIMEOUT` | `10000` | Driver query timeout, 100–60000 ms |
| `MYSQL_LEGACY_MAX_ROWS` | `200` | SELECT response-row limit, 1–1000 |
| `MYSQL_LEGACY_MAX_RESULT_BYTES` | `262144` | SELECT row-data JSON byte limit, 1024–1048576 |
| `MYSQL_LEGACY_CONNECT_TIMEOUT` | `10000` | Connection-establishment timeout, 100–60000 ms |
| `MYSQL_LEGACY_POOL_SIZE` | `5` | Pooled connection limit, 1–50 |
| `MYSQL_LEGACY_ALLOW_INSERT` | `false` | Enables `mysql_legacy_insert`; `true` or `false` |
| `MYSQL_LEGACY_ALLOW_UPDATE` | `false` | Enables `mysql_legacy_update`; `true` or `false` |
| `MYSQL_LEGACY_ALLOW_DELETE` | `false` | Enables `mysql_legacy_delete`; `true` or `false` |
| `MYSQL_LEGACY_ALLOW_DDL` | `false` | Enables `mysql_legacy_ddl`; `true` or `false` |
| `MYSQL_LEGACY_DISABLE_READ_ONLY_TRANSACTIONS` | `false` | Disables the read-only transaction wrap around `mysql_legacy_select`; `true` or `false` |

The connection timeout defaults to 10 seconds and is configurable via `MYSQL_LEGACY_CONNECT_TIMEOUT`. Empty values are treated as absent, including an empty password.

## Write operations

`mysql_legacy_insert`, `mysql_legacy_update`, `mysql_legacy_delete`, and `mysql_legacy_ddl` are always registered and visible in `tools/list`, but each is disabled by default and rejects calls with a clear error until its `MYSQL_LEGACY_ALLOW_*` flag is set to `true`.

- `mysql_legacy_update` and `mysql_legacy_delete` reject any statement without a WHERE clause. This cannot be disabled by configuration. To clear an entire table intentionally, use `TRUNCATE TABLE` via `mysql_legacy_ddl`.
- `mysql_legacy_ddl` only accepts table-level statements: `CREATE TABLE`, `ALTER TABLE`, `DROP TABLE`, `TRUNCATE TABLE`, `RENAME TABLE`. `CREATE`/`DROP DATABASE`, `CREATE`/`DROP VIEW`, `CREATE`/`DROP INDEX`, and similar non-table-level statements are rejected.
- As with `mysql_legacy_select`, SQL filtering is not an authorization boundary. The MySQL account itself must also be granted the corresponding privileges (`INSERT`, `UPDATE`, `DELETE`, `CREATE`/`ALTER`/`DROP` as applicable) — enabling a flag here does nothing if the account lacks the privilege, and disabling a flag here does not revoke a privilege the account already has.

## Read-only transactions

When `MYSQL_LEGACY_DISABLE_READ_ONLY_TRANSACTIONS` is not `true`, `mysql_legacy_select` runs inside `START TRANSACTION READ ONLY` / `COMMIT` on MySQL 5.6.5 and later, detected once per process via `SELECT VERSION()` and cached for the process lifetime. `START TRANSACTION READ ONLY` does not exist before MySQL 5.6.5; on older or unparsable server versions, `mysql_legacy_select` silently falls back to a plain query with no error or warning.

## Security and connection limits

Use a dedicated account with only the minimum SELECT and metadata permissions. Do not grant FILE, EXECUTE, or write privileges. SQL filtering is not an authorization boundary: database privileges remain essential.

Results are returned to the AI client. The MySQL connection is plaintext TCP because this release does not configure TLS; use a trusted local network or an independently secured tunnel.

There are no `MYSQL_LEGACY_INSECURE_AUTH`, `MYSQL_LEGACY_CHARSET`, or `MYSQL_LEGACY_SSL` settings. Supplying them has no effect. See [Troubleshooting](TROUBLESHOOTING.md) before assuming the server can resolve old-password, encoding, or TLS compatibility issues.

Result limits are applied after the database result has been fetched. They do not limit database work or process memory. Prefer explicit columns, selective predicates, and `LIMIT`.
