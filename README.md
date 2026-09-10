# mysql-legacy-mcp

Read-only MCP server for inspecting legacy MySQL 5.0–5.6 databases through stdio.

It uses MySQL 5.1-compatible SQL and `SHOW` metadata queries. Live MCP tests cover MySQL 5.0.51a, 5.1.73, 5.5.62, and 5.6.51. It is deliberately small: no write tools, no TLS configuration, and no custom authentication or charset options.

## Is this for you?

- You need an AI agent to inspect a MySQL 5.0, 5.1, 5.5, or 5.6 database.
- Your current MySQL MCP server assumes MySQL 5.7+, JSON functions, or newer `information_schema` fields.
- You need schema inspection and SELECT queries without exposing write operations.

If you are seeing `ER_NOT_SUPPORTED_AUTH_MODE`, `HANDSHAKE_INSECURE_AUTH`, `Old password authentication is not supported`, legacy TLS errors, or garbled `cp1251` / `latin1` text, read [Troubleshooting](docs/TROUBLESHOOTING.md) first. Those symptoms are not all solved by this package.

## Requirements

- Node.js 18.14.1 or later
- npm
- A dedicated MySQL account with only the required read and metadata privileges

## Quick install

### Claude Code

```sh
claude mcp add --transport stdio mysql-legacy \\
  --env MYSQL_LEGACY_HOST=127.0.0.1 \\
  --env MYSQL_LEGACY_USER=legacy_reader \\
  --env MYSQL_LEGACY_PASSWORD=replace-with-a-secret \\
  --env MYSQL_LEGACY_DATABASE=legacy_app \\
  -- npx -y mysql-legacy-mcp
```

### Cursor and other clients

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

Use the schema required by your client. Full copy-paste instructions for Claude Desktop, Codex, VS Code, Windsurf, Gemini, Trae, Qoder, and more are in the [Installation guide](docs/INSTALLATION.md).

Until the first npm release, use the checkout: run `npm ci`, then configure the client to launch `node` with the absolute path to `src/server.js`.

## Compatibility

| MySQL | Status |
| --- | --- |
| 5.0 | Verified: 5.0.51a |
| 5.1 | Verified: 5.1.73 |
| 5.5 | Verified: 5.5.62 |
| 5.6 | Verified: 5.6.51 |
| 5.7 | Verified reference only: 5.7.44 |
| 8.0 | Not a target; default `caching_sha2_password` is unsupported |

Each tested target passed all seven tools through a real MCP stdio session. Exact sources, test conditions, and the MySQL 8.0 boundary are recorded in the [compatibility audit](docs/AUDIT.md). This does not cover pre-4.1 `old_password`, custom connection charsets, TLS, or your server's exact patch level.

## Compared with modern MySQL MCP servers

| Server | Stated MySQL baseline | Focus |
| --- | --- | --- |
| `mysql-legacy-mcp` | Verified live: 5.0–5.6 | Read-only legacy schema inspection and SELECT queries |
| [`@benborla29/mcp-server-mysql`](https://github.com/benborla/mcp-server-mysql#requirements) | 5.7+; 8.0+ recommended | Modern MySQL features such as TLS, SSH tunnels, and optional writes |

This is a compatibility distinction, not a benchmark: choose the modern server for its modern-database features.

## Features

- Read-only `SELECT` tool with parser checks and result-size limits
- `SHOW`-based database, table, column, CREATE TABLE, and index inspection
- One MySQL connection per tool call; no reliance on CTEs, JSON functions, or modern metadata columns

## Tools

| Tool | Purpose |
| --- | --- |
| `mysql_legacy_ping` | Return `VERSION()` |
| `mysql_legacy_select` | Run one parsed SELECT statement |
| `mysql_legacy_list_databases` | List databases |
| `mysql_legacy_list_tables` | List tables and views |
| `mysql_legacy_describe_table` | Show columns |
| `mysql_legacy_show_create_table` | Show table DDL |
| `mysql_legacy_list_indexes` | Show indexes |

## Documentation

- [Installation guide](docs/INSTALLATION.md) — client-specific setup
- [Configuration](docs/CONFIGURATION.md) — environment variables, privileges, and security limits
- [Troubleshooting](docs/TROUBLESHOOTING.md) — authentication, TLS, encoding, and startup errors
- [Compatibility audit](docs/AUDIT.md) — reproducible version evidence

## Why this exists

This project came from a QA/fullstack workflow that needed AI-assisted inspection of a production MySQL 5.1 database. It is a focused utility for exploring legacy schemas and preparing migrations.

## Contributing

```sh
npm ci
npm run check
npm run smoke:static
```

For authorized database testing, see the smoke-test instructions in the [compatibility audit](docs/AUDIT.md).

## License

[MIT](LICENSE).
