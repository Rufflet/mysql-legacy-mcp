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
