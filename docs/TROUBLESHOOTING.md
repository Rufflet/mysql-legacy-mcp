# Troubleshooting

## `ER_NOT_SUPPORTED_AUTH_MODE` / `Client does not support authentication protocol requested by server`

Check the MySQL version and the account authentication method with the DBA. This server uses `mysql@2.18.1`, not `mysql2`, and does not support every authentication mode. MySQL 8's default `caching_sha2_password` is outside the target range.

## `Old password authentication is not supported` / `HANDSHAKE_INSECURE_AUTH`

Pre-4.1 `old_password` is not tested or configured by this project. Provision a compatible dedicated account, or treat support for this authentication scheme as a separate implementation task.

## Legacy TLS or SSL handshake errors

This release does not configure TLS or SSL. It cannot satisfy an account requiring SSL or repair a protocol mismatch with an old MySQL server. Use an independently secured tunnel on a trusted network, or implement and test TLS support separately.

## `latin1`, `cp1251`, garbled text, or `utf8mb4` errors

The driver uses its default `UTF8_GENERAL_CI` connection charset. This avoids requesting `utf8mb4` from old servers, but it is not configurable legacy-encoding support. Verify representative data with the server owner; emoji is returned as `?` with the current connection settings.

## MCP server hangs, disconnects, or tools do not appear

The process waits for MCP messages on stdin, so silence in a terminal is normal. Check the client stderr logs, the `npx`/Node path, and the server command. Tool discovery does not verify the database connection: call `mysql_legacy_ping` first.

## `Missing required environment variable: MYSQL_LEGACY_...`

Set the variable in the MCP client's server environment, not only in a separate shell. `MYSQL_HOST`, `MYSQL_PASS`, and `MYSQL_DB` do not configure this package. Restart the client after changing configuration.

## `SQL parsing failed` / `Exactly one SELECT statement is allowed`

The SELECT tool rejects parse failures, multiple statements, non-SELECT statements, `SELECT INTO`, and locking reads. Use the dedicated schema tools for `SHOW` queries. A query accepted by the parser can still be unsupported by your specific MySQL version.

## `INSERT is disabled` / `UPDATE is disabled` / `DELETE is disabled` / `DDL is disabled`

`mysql_legacy_insert`, `mysql_legacy_update`, `mysql_legacy_delete`, and `mysql_legacy_ddl` are always visible in `tools/list` but reject every call until their matching flag (`MYSQL_LEGACY_ALLOW_INSERT`, `MYSQL_LEGACY_ALLOW_UPDATE`, `MYSQL_LEGACY_ALLOW_DELETE`, `MYSQL_LEGACY_ALLOW_DDL`) is set to `true` in the MCP client's server environment. See [Configuration](CONFIGURATION.md#write-operations). The MySQL account also needs the matching privilege — enabling the flag alone is not enough.

## `UPDATE without a WHERE clause is rejected` / `DELETE without a WHERE clause is rejected`

This guard is intentional and cannot be turned off by configuration, even with the corresponding `ALLOW` flag enabled. If you intend to clear an entire table, use `TRUNCATE TABLE` through `mysql_legacy_ddl` instead.

## `... is not allowed. mysql_legacy_ddl only accepts table-level statements`

`mysql_legacy_ddl` rejects `CREATE`/`DROP DATABASE`, `CREATE`/`DROP VIEW`, `CREATE`/`DROP INDEX`, and other non-table-level statements. Only `CREATE TABLE`, `ALTER TABLE`, `DROP TABLE`, `TRUNCATE TABLE`, and `RENAME TABLE` are accepted.

## `mysql_legacy_select` behaves unexpectedly inside a transaction, or a proxy rejects `START TRANSACTION READ ONLY`

On MySQL 5.6.5 and later, `mysql_legacy_select` wraps its query in `START TRANSACTION READ ONLY` unless `MYSQL_LEGACY_DISABLE_READ_ONLY_TRANSACTIONS=true` is set. If a proxy, middleware, or nonstandard server reports a version ≥5.6.5 but does not actually support this statement, set this flag to fall back to plain queries.
