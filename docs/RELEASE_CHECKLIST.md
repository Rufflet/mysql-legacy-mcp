# Release preparation

Status as of 2026-09-10: public GitHub repository created; npm and registry releases have not been published. This maintainer checklist is excluded from the npm tarball.

## GitHub metadata proposal

Repository name: `mysql-legacy-mcp`, under the author's personal account.

Description (under 160 characters):

> MCP queries and schema inspection for legacy MySQL, built around MySQL 5.1-compatible SQL. MySQL 5.0–5.6 compatibility remains unverified.

Topics:

`mysql`, `mcp`, `mcp-server`, `model-context-protocol`, `mysql-legacy`, `mysql-5-1`, `mysql-5-5`, `legacy-database`, `database-migration`, `schema-inspection`, `claude`, `nodejs`

Applied to https://github.com/Rufflet/mysql-legacy-mcp. Authenticated GitHub API access confirmed the personal account Rufflet and author name Alex Ershov. Package metadata now points to this repository and personal profile.

## npm release checklist

- [x] Keep the agreed name mysql-legacy-mcp.
- [x] Prepare English README, compatibility table, troubleshooting, and client installation guide.
- [x] Add MIT LICENSE, credited to Alex Ershov.
- [x] Add executable bin mapping and Node shebang for npx.
- [x] Use a files allowlist: src/server.js, docs/INSTALLATION.md, README.md, LICENSE (npm also includes package.json).
- [x] Exclude tests, smoke scripts, environment files, prompt drafts, lockfile, and maintainer notes from publication.
- [x] Choose 0.1.0: an initial public API and compatibility matrix are still being established; 1.0.0 would imply a stability commitment not supported by the available evidence.
- [x] Fill real repository, homepage, bugs, and author fields; remove private: true.
- [ ] Confirm exact live-tested MySQL versions and real historical error strings with the author.
- [x] Check npm name availability: registry returned HTTP 404 on 2026-09-10. Recheck immediately before publication; this does not reserve the name.
- [x] Create the public Rufflet/mysql-legacy-mcp repository and configure origin.
- [x] Run npm ci, npm run check, and npm run smoke:static with dependencies available.
- [ ] Run authorized live smoke checks; record the exact MySQL version and remaining coverage gaps from AUDIT.md.
- [x] Install the packed tarball in a clean temporary project and exercise MCP initialize / tools/list through its installed bin: seven tools, version 0.1.0.
- [ ] Activate docs/ci.yml.example as .github/workflows/ci.yml and verify CI on Node 18.14.1, 22, and 24. GitHub rejected the initial workflow push because the active OAuth token lacks workflow scope; the draft is preserved as documentation.
- [ ] Confirm the owner's npm 2FA and publishing method. npm whoami currently returns ENEEDAUTH on this machine; no npm login is configured. Never paste credentials into the repository or chat.
- [ ] Decide whether to configure GitHub Actions OIDC trusted publishing with provenance as a separate follow-up.
- [ ] Recheck the final tarball and release metadata before an explicitly requested publication.

Validation on 2026-09-10: dependency installation, syntax checks, static smoke, packing, and clean consumer installation passed. The package contains exactly LICENSE, README.md, docs/INSTALLATION.md, package.json, and src/server.js. The installed node_modules/.bin/mysql-legacy-mcp executable completed MCP initialization and exposed exactly seven tools with server version 0.1.0. Version and engine metadata are consistent; documentation JSON snippets and local links were checked. No live database connection was attempted in this verification pass. After updating five transitive dependencies within existing version ranges, npm audit --omit=dev reports zero vulnerabilities. server.json passes its declared JSON schema and its name matches package.json mcpName.

The [npm authentication guide](https://docs.npmjs.com/about-two-factor-authentication/) is the source of current account requirements; do not rely on unverified future cutoff dates in planning notes. [Trusted publishing](https://docs.npmjs.com/trusted-publishers/) uses OIDC credentials and can generate provenance for public packages from public GitHub repositories. It requires matching repository/workflow configuration in npm. Establish the first package publication path before assuming trusted publisher settings are available for a brand-new name.

## Phase 2: directories and registries

Start after a stable npm release, only on a separate explicit request. None of these submissions is required to complete the npm release itself. Recheck current submission rules at execution time.

| Destination | Status | Next action |
| --- | --- | --- |
| [Official MCP Registry](https://github.com/modelcontextprotocol/registry) | Draft prepared; not published | server.json uses io.github.Rufflet/mysql-legacy-mcp. After npm release, authenticate ownership and submit that version on explicit request. |
| [Glama](https://glama.ai/mcp/faq) | Not done | Submit the public GitHub repository; follow the repository ownership flow. |
| [PulseMCP](https://www.pulsemcp.com/api) | Not done | Check for an existing imported listing before submitting manually. No fixed indexing delay is assumed. |
| [Smithery](https://smithery.ai/docs/build/publish) | Not done | Review the current listing route and its requirements for a local stdio package before submission; hosting is a separate decision. |
| [mcp.so](https://mcp.so/) | Not done | Follow its current submission route and link the published package and repository. |
| [Awesome MCP Servers](https://github.com/punkpeye/awesome-mcp-servers) | Not done | Read contribution rules and propose a factual entry by PR when requested. |
| [Awesome MCP ZH](https://github.com/yzfly/Awesome-MCP-ZH) | Not done | Read contribution rules and prepare an appropriate entry when requested. |
| Docker MCP Catalog | Not applicable now | No Docker image is provided; reconsider only if one is created in a separately scoped task. |

Glama distinguishes a GitHub repository's root `glama.json` from a remote connector's `/.well-known/glama.json`. This npm/stdio project is a repository listing, not a hosted connector. See [Glama's repository metadata explanation](https://glama.ai/blog/2025-07-08-what-is-glamajson). Do not create a remote ownership challenge file for this package.

A server.json draft is included with a matching package.json mcpName, io.github.Rufflet/mysql-legacy-mcp. The [registry npm package guide](https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/package-types.mdx) requires this field for npm ownership verification. The draft is excluded from the npm tarball and has not been submitted.

The draft mirrors version 0.1.0, npm identifier mysql-legacy-mcp, stdio transport, and actual MYSQL_LEGACY_* settings. The password is secret and required; host and user are also required, while database and tuning settings are optional. No credentials or unsupported auth/TLS/charset variables are included.

## Client documentation follow-ups

Trae's official page could not be extracted, and Qoder CN-specific setup remains unverified. Their installation entries link to official sources without speculative configurations. Pi is omitted until the exact product and MCP integration are identified. DeepSeek Harness is omitted until the author supplies the intended product URL. No optional consulting/contact section has been added.
