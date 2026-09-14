# Client installation

Configuration sources reviewed on 2026-09-09. These examples adapt official client schemas to this package; they have not been tested interactively in every client.

## Before you start

Install Node.js >=18.14.1 and npm on the machine where the client launches its tools. Replace the sample connection values below with a dedicated reader account. Keep credentials out of commits and shared configuration; CLI arguments can also appear in shell history. Merge entries into existing configuration instead of replacing your other servers.

This package uses stdio, not an HTTP endpoint. It does not load `.env` files or expose insecureAuth, charset, or SSL options. See [Configuration](CONFIGURATION.md) and [Troubleshooting](TROUBLESHOOTING.md).

`mysql-legacy-mcp` is published on npm, so the `npx -y mysql-legacy-mcp` examples below work as shown. The same package is listed in the [official MCP Registry](https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.Rufflet/mysql-legacy-mcp) as `io.github.Rufflet/mysql-legacy-mcp`; that listing does not replace these copy-paste configs. To run from a local checkout instead (for example, to test an unreleased change), run `npm ci` in the checkout and use command `node`, with a single argument containing the absolute path to `src/server.js`, in the corresponding client configuration. Retain the same environment variables. Do not use a working-directory-relative path for GUI clients.

After connecting, call `mysql_legacy_ping`, then list tables in the intended database. Tool discovery alone does not test database connectivity.

## Claude Code

Run in your project (default local scope):

```sh
claude mcp add --transport stdio mysql-legacy \
  --env MYSQL_LEGACY_HOST=127.0.0.1 \
  --env MYSQL_LEGACY_USER=legacy_reader \
  --env MYSQL_LEGACY_PASSWORD=replace-with-a-secret \
  --env MYSQL_LEGACY_DATABASE=legacy_app \
  -- npx -y mysql-legacy-mcp
```

Restart Claude Code after changes. [Official MCP guide](https://code.claude.com/docs/en/mcp).

## Claude Desktop

Open Settings → Developer → Edit Config. macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`; Windows: `%APPDATA%\Claude\claude_desktop_config.json`.

```json
{
  "mcpServers": {
    "mysql-legacy": {
      "command": "npx",
      "args": [
        "-y",
        "mysql-legacy-mcp"
      ],
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

Completely quit and restart Claude Desktop. [Official local-server guide](https://modelcontextprotocol.io/docs/develop/connect-local-servers).

## OpenAI Codex CLI

```sh
codex mcp add mysql-legacy \
  --env MYSQL_LEGACY_HOST=127.0.0.1 \
  --env MYSQL_LEGACY_USER=legacy_reader \
  --env MYSQL_LEGACY_PASSWORD=replace-with-a-secret \
  --env MYSQL_LEGACY_DATABASE=legacy_app \
  -- npx -y mysql-legacy-mcp
```

The equivalent user configuration in `~/.codex/config.toml` is TOML:

```toml
[mcp_servers.mysql-legacy]
command = "npx"
args = ["-y", "mysql-legacy-mcp"]

[mcp_servers.mysql-legacy.env]
MYSQL_LEGACY_HOST = "127.0.0.1"
MYSQL_LEGACY_USER = "legacy_reader"
MYSQL_LEGACY_PASSWORD = "replace-with-a-secret"
MYSQL_LEGACY_DATABASE = "legacy_app"
```

Use `mcp_servers`, not `mcpServers`. Restart Codex after saving. [Official MCP guide](https://learn.chatgpt.com/docs/extend/mcp?surface=cli).

## Cursor

Project: `.cursor/mcp.json`; user: `~/.cursor/mcp.json`.

```json
{
  "mcpServers": {
    "mysql-legacy": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "mysql-legacy-mcp"
      ],
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

Restart Cursor after saving. [Official MCP guide](https://cursor.com/docs/mcp).

## Windsurf / Cascade

User configuration: `~/.codeium/windsurf/mcp_config.json`. The verified documentation does not establish a project-level `.windsurf/mcp.json` path.

```json
{
  "mcpServers": {
    "mysql-legacy": {
      "command": "npx",
      "args": [
        "-y",
        "mysql-legacy-mcp"
      ],
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

Restart the client after saving. The [official Windsurf MCP URL](https://docs.windsurf.com/windsurf/cascade/mcp) currently redirects to the Cascade documentation at Devin.

## VS Code + GitHub Copilot

The CLI registers a user-profile server (POSIX shell quoting):

```sh
code --add-mcp '{"name":"mysql-legacy","command":"npx","args":["-y","mysql-legacy-mcp"],"env":{"MYSQL_LEGACY_HOST":"127.0.0.1","MYSQL_LEGACY_USER":"legacy_reader","MYSQL_LEGACY_PASSWORD":"replace-with-a-secret","MYSQL_LEGACY_DATABASE":"legacy_app"}}'
```

For a project, use `.vscode/mcp.json`. Its root key is `servers`:

```json
{
  "servers": {
    "mysql-legacy": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "mysql-legacy-mcp"
      ],
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

Restart the MCP server using MCP: List Servers, or restart VS Code after saving. [Official setup guide](https://code.visualstudio.com/docs/agent-customization/mcp-servers).

## Gemini CLI

```sh
gemini mcp add --env MYSQL_LEGACY_HOST=127.0.0.1 --env MYSQL_LEGACY_USER=legacy_reader --env MYSQL_LEGACY_PASSWORD=replace-with-a-secret --env MYSQL_LEGACY_DATABASE=legacy_app mysql-legacy npx -y mysql-legacy-mcp
```

Restart Gemini CLI after adding the server. [Official CLI reference](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/cli-reference.md).

## OpenCode

Run `opencode mcp add` for interactive setup, or merge the following into project `opencode.jsonc`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "mysql-legacy": {
      "type": "local",
      "command": [
        "npx",
        "-y",
        "mysql-legacy-mcp"
      ],
      "enabled": true,
      "environment": {
        "MYSQL_LEGACY_HOST": "127.0.0.1",
        "MYSQL_LEGACY_USER": "legacy_reader",
        "MYSQL_LEGACY_PASSWORD": "replace-with-a-secret",
        "MYSQL_LEGACY_DATABASE": "legacy_app"
      }
    }
  }
}
```

Use `mcp`, an array-valued `command`, and `environment`. Restart OpenCode after saving. [Official MCP guide](https://github.com/anomalyco/opencode/blob/dev/packages/web/src/content/docs/mcp-servers.mdx).

## Grok Build CLI (xAI)

These instructions apply to `xai-org/grok-build`, not unrelated community clients named Grok CLI.

```sh
grok mcp add mysql-legacy -e MYSQL_LEGACY_HOST=127.0.0.1 -e MYSQL_LEGACY_USER=legacy_reader -e MYSQL_LEGACY_PASSWORD=replace-with-a-secret -e MYSQL_LEGACY_DATABASE=legacy_app -- npx -y mysql-legacy-mcp
```

Restart Grok after changes. [Official MCP guide](https://github.com/xai-org/grok-build/blob/main/crates/codegen/xai-grok-pager/docs/user-guide/07-mcp-servers.md).

## Google Antigravity CLI / IDE

User: `~/.gemini/config/mcp_config.json`; workspace: `.agents/mcp_config.json`. In the IDE, MCP Servers → Manage MCP Servers → View raw config opens the configuration.

```json
{
  "mcpServers": {
    "mysql-legacy": {
      "command": "npx",
      "args": [
        "-y",
        "mysql-legacy-mcp"
      ],
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

Restart Antigravity after saving, or reload servers through its MCP manager. [Official MCP guide](https://antigravity.google/docs/cli/mcp) confirms these paths for the current CLI and IDE.

## OpenClaw

Current OpenClaw uses its MCP management commands. Set a server definition including environment values (POSIX shell quoting):

```sh
openclaw mcp set mysql-legacy '{"command":"npx","args":["-y","mysql-legacy-mcp"],"env":{"MYSQL_LEGACY_HOST":"127.0.0.1","MYSQL_LEGACY_USER":"legacy_reader","MYSQL_LEGACY_PASSWORD":"replace-with-a-secret","MYSQL_LEGACY_DATABASE":"legacy_app"}}'
```

Restart the OpenClaw gateway/client after changing the server configuration. [Official CLI reference](https://github.com/openclaw/openclaw/blob/main/docs/cli/mcp.md). Do not assume the older `~/.openclaw/mcp.json` format; current configuration uses `mcp.servers`.

## Hermes (Nous Research)

Edit `~/.hermes/config.yaml`. This is YAML; `mcp_servers` is a mapping keyed by server name:

```yaml
mcp_servers:
  mysql-legacy:
    command: "npx"
    args: ["-y", "mysql-legacy-mcp"]
    env:
      MYSQL_LEGACY_HOST: "127.0.0.1"
      MYSQL_LEGACY_USER: "legacy_reader"
      MYSQL_LEGACY_PASSWORD: "replace-with-a-secret"
      MYSQL_LEGACY_DATABASE: "legacy_app"
```

Restart Hermes after saving. [Official implementation and configuration reference](https://github.com/nousresearch/hermes-agent/blob/main/tools/mcp_tool.py).

## CodeBuddy (Tencent)

Open CodeBuddy Settings → MCP → Add MCP and enter the custom JSON:

```json
{
  "mcpServers": {
    "mysql-legacy": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "mysql-legacy-mcp"
      ],
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

Restart CodeBuddy after saving. [Official IDE MCP guide](https://www.codebuddy.cn/docs/ide/User-guide/MCP). This uses the UI to select the file; no undocumented filesystem path is assumed.

## Qwen Code CLI

```sh
qwen mcp add mysql-legacy -e MYSQL_LEGACY_HOST=127.0.0.1 -e MYSQL_LEGACY_USER=legacy_reader -e MYSQL_LEGACY_PASSWORD=replace-with-a-secret -e MYSQL_LEGACY_DATABASE=legacy_app npx -y mysql-legacy-mcp
```

Restart Qwen Code after adding the server. [Official MCP guide](https://github.com/qwenlm/qwen-code/blob/main/docs/developers/tools/mcp-server.md).

## Qoder IDE (international and CN)

In Qoder IDE, open **Settings → MCP**, choose **+ Add**, and enter a stdio server. The same current MCP UI documentation is used for international and CN installations; use the client UI rather than assuming a filesystem path. Paste this JSON when prompted:

```json
{
  "mcpServers": {
    "mysql-legacy": {
      "command": "npx",
      "args": [
        "-y",
        "mysql-legacy-mcp"
      ],
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

Save the configuration and confirm the link icon appears. [Official Qoder IDE MCP guide](https://docs.qoder.com/user-guide/chat/model-context-protocol#configure-mcp-servers).

## Xiaomi MiMo Code

Project: `.mimocode/mimocode.jsonc`; user: `~/.config/mimocode/mimocode.jsonc` (both also accept `.json`).

```json
{
  "$schema": "https://mimo.xiaomi.com/mimocode/config.json",
  "mcp": {
    "mysql-legacy": {
      "type": "local",
      "command": ["npx", "-y", "mysql-legacy-mcp"],
      "enabled": true,
      "environment": {
        "MYSQL_LEGACY_HOST": "127.0.0.1",
        "MYSQL_LEGACY_USER": "legacy_reader",
        "MYSQL_LEGACY_PASSWORD": "replace-with-a-secret",
        "MYSQL_LEGACY_DATABASE": "legacy_app"
      }
    }
  }
}
```

Restart MiMo Code after saving. Paths follow the [official README](https://github.com/XiaomiMiMo/MiMo-Code#file-locations); fields follow its [current MCP schema](https://github.com/XiaomiMiMo/MiMo-Code/blob/main/packages/opencode/src/config/mcp.ts). Some inherited documentation still says OpenCode, so use the MiMo-specific filename above.

## Trae (ByteDance)

Open Trae's MCP server manager and select **Add MCP Server**. Choose a local stdio server, set command to `npx`, arguments to `-y mysql-legacy-mcp`, and add the four `MYSQL_LEGACY_*` variables from the examples above. Use the UI supplied by your Trae version; no unverified config-file path is assumed. See Trae's [Add MCP servers guide](https://docs.trae.ai/ide/add-mcp-servers).

## Pi and DeepSeek Harness

Pi explicitly has no built-in MCP support; it needs a separately maintained extension, so this package does not provide an installation recipe. DeepSeek Harness is not included because it is outside this project's supported MCP-client list.

## Startup troubleshooting

- An npm 404 before the first release means the npx installation path is not available yet. Use the checkout instructions above.
- If a GUI cannot find `npx`, verify its PATH or configure an absolute executable path. Windows clients may need a command wrapper; follow the client's platform documentation.
- Do not paste TOML into JSON or use another client's root key.
- Configure all three required credentials: host, user, and nonempty password. The database is optional but is included in the examples to make unqualified SELECT queries work.
- Missing tools and a failed database ping are different failures. Read stderr logs for the exact error and consult [Troubleshooting](TROUBLESHOOTING.md).
