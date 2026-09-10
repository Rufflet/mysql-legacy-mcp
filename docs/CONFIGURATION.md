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

The connection timeout is fixed at 10 seconds. Empty values are treated as absent, including an empty password.

## Security and connection limits

Use a dedicated account with only the minimum SELECT and metadata permissions. Do not grant FILE, EXECUTE, or write privileges. SQL filtering is not an authorization boundary: database privileges remain essential.

Results are returned to the AI client. The MySQL connection is plaintext TCP because this release does not configure TLS; use a trusted local network or an independently secured tunnel.

There are no `MYSQL_LEGACY_INSECURE_AUTH`, `MYSQL_LEGACY_CHARSET`, or `MYSQL_LEGACY_SSL` settings. Supplying them has no effect. See [Troubleshooting](TROUBLESHOOTING.md) before assuming the server can resolve old-password, encoding, or TLS compatibility issues.

Result limits are applied after the database result has been fetched. They do not limit database work or process memory. Prefer explicit columns, selective predicates, and `LIMIT`.
