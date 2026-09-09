# mysql-legacy-mcp

MCP queries and schema inspection for legacy MySQL 5.0–5.6 deployments, built around MySQL 5.1-compatible SQL.

Compatibility across this range is **not yet verified**. This server uses `mysql` (mysqljs), `SHOW` metadata queries, and a SELECT-only tool interface. It does not expose old-password authentication, custom charset, or TLS options.

## Is this for you?

- Your MySQL MCP server fails or hangs when connecting to MySQL 5.1 or 5.5.
- Schema inspection expects newer `information_schema` fields, JSON functions, or transaction features your database lacks.
- You need to inspect a legacy ERP, CRM, or application database without exposing a write tool.
- You found `ER_NOT_SUPPORTED_AUTH_MODE`, “Client does not support authentication protocol requested by server”, or “Old password authentication is not supported”. Read the limitations below: switching to this package is not a guaranteed fix.
- You are looking for `insecureAuth`, working with `latin1` / `cp1251`, or diagnosing an old MySQL TLS handshake. These are relevant limitations, not implemented features.

The error phrases above are diagnostic search terms, not a record of failures reproduced by this project.

## MySQL compatibility

No live test results are recorded in this repository. A live smoke script exists; its presence is not evidence that a version passed.

| MySQL version | Status | Basis and limitations |
| --- | --- | --- |
| 5.0 | Untested; likely compatible with appropriate authentication | Built-in tools use older SELECT / SHOW syntax. No patch-level verification; pre-4.1 password authentication is disabled. |
| 5.1 | Intended target; live verification pending | Original implementation targets 5.1. Exact version, authentication, and encoding results need recording. |
| 5.5 | Untested; likely compatible | No newer server features required by built-in tools; same authentication and transport limits. |
| 5.6 | Untested; likely compatible | Same SQL approach; user-supplied queries must still suit the server. |

There is no version negotiation or SQL rewriting. `mysql_legacy_ping` reports `VERSION()`; it does not enable version-specific behavior. Modern authentication such as `caching_sha2_password` is outside this package's intended scope.

## How it compares

| Server | Minimum supported MySQL version | Focus |
| --- | --- | --- |
| `mysql-legacy-mcp` | Not established by live tests; targets 5.0–5.6 | SELECT-only tools and SHOW-based schema inspection; no TLS or auth configuration |
| `@benborla29/mcp-server-mysql` | 5.7+; 8.0+ recommended | Broader features including TLS, SSH tunneling, and optional writes |

Based on the [other project's requirements](https://github.com/benborla/mcp-server-mysql#requirements), reviewed on 2026-09-09. This is not a benchmark or a claim about every MySQL MCP server.

## Installation and Quick Start

Requires Node.js >=18.14.1 and npm. Use a currently maintained Node.js release for deployment. This is a local **stdio** MCP server: your client launches it as a child process.

The npm commands below are for the first published release. Until then, run `npm ci` in this checkout and configure your client to launch `node` with the absolute path to `src/server.js`.

Use a dedicated database account with only the needed SELECT and metadata access. Do not grant FILE, EXECUTE, or write privileges. Results are sent to your AI client. The database connection is unencrypted TCP: use a trusted local connection or an independently secured tunnel.

### Claude Code

Replace the example values. The command stores credentials in client configuration and may leave them in shell history; use the client's secret handling where available.

```sh
claude mcp add --transport stdio mysql-legacy --env MYSQL_LEGACY_HOST=127.0.0.1 --env MYSQL_LEGACY_USER=legacy_reader --env MYSQL_LEGACY_PASSWORD=replace-with-a-secret --env MYSQL_LEGACY_DATABASE=legacy_app -- npx -y mysql-legacy-mcp
```

Restart Claude Code, then ask it to call `mysql_legacy_ping`. [Claude Code MCP documentation](https://code.claude.com/docs/en/mcp).

### Cursor

Merge into project `.cursor/mcp.json` or user `~/.cursor/mcp.json`. Keep real credentials out of version control.

```json
{
  "mcpServers": {
    "mysql-legacy": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "mysql-legacy-mcp"],
      "env": {
        "MYSQL_LEGACY_HOST": "127.0.0.1",
        "MYSQL_LEGACY_USER": "legacy_reader",
        "MYSQL_LEGACY_PASSWORD": "replace-with-a-secret",
        "MYSQL_LEGACY_DATABASE": "legacy_app"
      }
    }
  }
}
```

Restart Cursor after saving. [Cursor MCP documentation](https://cursor.com/docs/mcp).

For Claude Desktop, Codex, VS Code, Windsurf, Gemini CLI, OpenCode, Qwen Code, and other clients, see [the installation guide](docs/INSTALLATION.md).

## Configuration reference

Set variables on the MCP server process. The server does **not** read `.env` files itself. Empty values are treated as absent; an empty password is not accepted.

| Variable | Default | Meaning |
| --- | --- | --- |
| `MYSQL_LEGACY_HOST` | Required | Database host or local tunnel endpoint |
| `MYSQL_LEGACY_PORT` | `3306` | TCP port, 1–65535 |
| `MYSQL_LEGACY_USER` | Required | Dedicated reader account |
| `MYSQL_LEGACY_PASSWORD` | Required | Nonempty account password |
| `MYSQL_LEGACY_DATABASE` | Unset | Optional default database for SELECT queries |
| `MYSQL_LEGACY_HIDE_SYSTEM_DATABASES` | `true` | Hide mysql and information_schema in listings; true / false |
| `MYSQL_LEGACY_QUERY_TIMEOUT` | `10000` | Driver query timeout, 100–60000 ms |
| `MYSQL_LEGACY_MAX_ROWS` | `200` | SELECT response row limit, 1–1000 |
| `MYSQL_LEGACY_MAX_RESULT_BYTES` | `262144` | SELECT row-data JSON byte limit, 1024–1048576 |

Connection timeout is fixed at 10 seconds. There are no `MYSQL_LEGACY_INSECURE_AUTH`, `MYSQL_LEGACY_CHARSET`, or `MYSQL_LEGACY_SSL` settings; supplying them has no effect.

## Tools and limits

| Tool | SQL / behavior |
| --- | --- |
| `mysql_legacy_ping` | `SELECT VERSION() AS version` |
| `mysql_legacy_select` | One parsed SELECT statement |
| `mysql_legacy_list_databases` | `SHOW DATABASES` |
| `mysql_legacy_list_tables` | `SHOW FULL TABLES FROM <database>` |
| `mysql_legacy_describe_table` | `SHOW FULL COLUMNS FROM <database>.<table>` |
| `mysql_legacy_show_create_table` | `SHOW CREATE TABLE <database>.<table>` |
| `mysql_legacy_list_indexes` | `SHOW INDEX FROM <database>.<table>` |

The SELECT tool rejects parse failures, multiple statements, non-SELECT statements, SELECT INTO, and locking reads. The driver also disables multiple statements. Schema identifiers are quoted and reject control characters and semicolons.

These filters are not a database authorization boundary: SELECT expressions can call functions, acquire locks, or consume resources. Database privileges remain essential. The default database is not an allowlist, and hiding system databases is only a display filter.

SELECT responses include `rows`, `returnedRows`, `totalRows`, and `truncated`. Limits apply **after the full result has been fetched into memory**, and exclude the MCP envelope; they do not bound database work or memory use. Schema results are not row/byte capped. Use selective queries with explicit LIMIT. The driver timeout is not a server-side execution budget.

## Troubleshooting

### ER_NOT_SUPPORTED_AUTH_MODE / Client does not support authentication protocol requested by server

Check the exact MySQL version and account authentication with your DBA. This package uses mysql@2.18.1, not mysql2; changing package names alone does not make every authentication mode compatible. Diagnose with a dedicated reader account.

### Old password authentication is not supported / HANDSHAKE_INSECURE_AUTH

Pre-4.1 `old_password` authentication and `mysql_native_password` differ. The mysqljs driver's `insecureAuth` defaults to false, and this server does not expose it. A DBA must provision a compatible dedicated account, or a separate implementation change is needed. See [mysqljs connection options](https://github.com/mysqljs/mysql/tree/v2.18.1#connection-options).

### TLS / SSL handshake errors with old MySQL

This server does not configure TLS. It cannot satisfy an account requiring SSL or repair legacy TLS negotiation. Use an independently secured connection appropriate to your deployment; do not expose the plaintext database connection to an untrusted network.

### latin1, cp1251, garbled text, or utf8mb4 errors

The driver defaults to `UTF8_GENERAL_CI`, avoiding an utf8mb4 connection request to older servers. This is not custom legacy-encoding support. Verify stored encodings and server conversion using representative text. There is no configurable connection charset. See [mysqljs 2.18.1 defaults](https://github.com/mysqljs/mysql/blob/v2.18.1/lib/ConnectionConfig.js).

### MCP server hangs, disconnects, or tools do not appear

The process waits for MCP messages on stdin; silence in a terminal is normal. Check client logs (stderr), Node/npm availability, and the command. Database connections happen on tool calls: successful tool discovery does not prove database reachability. Call `mysql_legacy_ping` first. Initial npx startup needs registry access to download dependencies.

### Missing required environment variable: MYSQL_LEGACY_...

Set the variable in the client's server environment. A separate terminal's variables may not reach the client. `MYSQL_HOST`, `MYSQL_PASS`, and `MYSQL_DB` do not configure this package. Restart after changes.

### SQL parsing failed / Exactly one SELECT statement is allowed

The MySQL parser may reject otherwise valid legacy syntax; there is no unrestricted fallback. Use schema tools for SHOW queries. Passing the parser does not guarantee validity on your MySQL version.

### Codex does not load a copied JSON configuration

Codex uses TOML with `mcp_servers`; VS Code uses JSON with `servers`; OpenCode uses `mcp` and `environment`. Follow [INSTALLATION.md](docs/INSTALLATION.md).

## Why this exists

This project grew out of a QA/fullstack workflow needing AI-assisted inspection of a production MySQL 5.1 database. Metadata queries avoid requiring SET TRANSACTION READ ONLY, CTEs, or MySQL JSON features. It is a small utility for inspecting existing databases and preparing migrations.

## Contributing

From a checkout, run `npm ci`, then:

```sh
npm run check
npm run smoke:static
```

For a database you are authorized to inspect, set the connection variables plus `MYSQL_LEGACY_DATABASE` and `MYSQL_LEGACY_SMOKE_TABLE`, then run `npm run smoke:live`. Record the exact version, authentication, encodings, and results; redact credentials and application data. The existing live script reads metadata and performs a constant SELECT; it does not test MCP transport, index listing, or a SELECT against an application table.

Include a minimal reproducer with compatibility reports. Tie new compatibility claims to recorded evidence.

## License

[MIT](LICENSE).
