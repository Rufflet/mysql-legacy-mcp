# Release preparation

Status as of 2026-09-10: public GitHub repository created; npm and registry releases have not been published. This maintainer checklist is excluded from the npm tarball.

## GitHub metadata proposal

Repository name: `mysql-legacy-mcp`, under the author's personal account.

Description (under 160 characters), current as of 2026-09-10:

> MCP server for legacy MySQL 5.0–5.6: schema inspection and SELECT by default, with opt-in INSERT/UPDATE/DELETE/DDL. Live-verified against MySQL 5.0–8.0.

Topics, current as of 2026-09-10 (unchanged since the write-tools addition — these target version/pain-point search terms, not feature names, so no new topics were added for INSERT/UPDATE/DELETE/DDL support; see [ROADMAP.md](ROADMAP.md) if that reasoning needs revisiting):

`mysql`, `mcp`, `mcp-server`, `model-context-protocol`, `mysql-legacy`, `mysql-5-0`, `mysql-5-1`, `mysql-5-5`, `mysql-5-6`, `legacy-database`, `database-migration`, `schema-inspection`, `claude`, `nodejs`

Applied to https://github.com/Rufflet/mysql-legacy-mcp via `gh repo edit` on 2026-09-09 (initial metadata), 2026-09-10 (description and topics updated after live 5.0–8.0 verification; see AUDIT.md), and again on 2026-09-10 (description updated to mention the opt-in write tools). Authenticated GitHub API access confirmed the personal account Rufflet. Package metadata now points to this repository and personal profile.

## npm release checklist

- [x] Keep the agreed name mysql-legacy-mcp.
- [x] Prepare English README, compatibility table, troubleshooting, and client installation guide.
- [x] Add MIT LICENSE, credited to Rufflet.
- [x] Add executable bin mapping and Node shebang for npx.
- [x] Use a files allowlist: src/server.js, README.md, LICENSE, and public installation/configuration/troubleshooting/audit documentation (npm also includes package.json).
- [x] Exclude tests, smoke scripts, environment files, prompt drafts, lockfile, and maintainer notes from publication. CONTRIBUTING.md and docs/ROADMAP.md (added 2026-09-10) are deliberately left out of the `files` allowlist for the same reason as this checklist and AUDIT's internal notes — they're for people working on the repository, not for someone who installed the package.
- [x] Choose 0.1.0: an initial public API and compatibility matrix are still being established; 1.0.0 would imply a stability commitment not supported by the available evidence.
- [x] Bump to 0.2.0 on 2026-09-10 after adding the connection pool, the four opt-in write tools, and version-gated read-only transactions — a real expansion of the public tool surface (7 → 11 tools), warranting more than a patch release even though nothing has shipped to npm yet. `package.json`, the `McpServer` constructor in `src/server.js`, and `server.json` (top-level and package version) were all updated to match.
- [x] Fill real repository, homepage, bugs, and author fields; remove private: true.
- [ ] Confirm real historical failure error strings from the author's original production incident (distinct from the errors reproduced in Docker below).
- [x] Check npm name availability: registry returned HTTP 404 on 2026-09-10. Recheck immediately before publication; this does not reserve the name.
- [x] Create the public Rufflet/mysql-legacy-mcp repository and configure origin.
- [x] Run npm ci, npm run check, and npm run smoke:static with dependencies available.
- [x] Run authorized live smoke checks; record the exact MySQL version and remaining coverage gaps from AUDIT.md. Done on 2026-09-10, covering all of 5.0–5.6 plus 5.7/8.0 for reference: see AUDIT.md's "Live runs" section. 5.0/5.1 have no official Docker image, so each ran as the real Debian-packaged MySQL of its era under `--platform linux/386` (amd64 builds that old segfault on this kernel's `vsyscall=none`). Only pre-4.1 `old_password` authentication remains unverified, since no reachable MySQL build implements it.
- [x] Re-run authorized live smoke checks after adding the pool/write-tools/read-only-transaction work. Done on 2026-09-10 (second pass) against the same 5.0–8.0 matrix, both with all four `MYSQL_LEGACY_ALLOW_*` flags left disabled and with all four enabled; see AUDIT.md's second "Live runs" section, including the two bugs found and fixed during that pass.
- [x] Install the packed tarball in a clean temporary project and exercise MCP initialize / tools/list through its installed bin: seven tools, version 0.1.0. **Superseded by the re-validation below.**
- [x] Re-validated the packed tarball against the current 0.2.0 tree on 2026-09-10: `npm pack --ignore-scripts` (8 files, LICENSE/README/docs/package.json/src/server.js only — no tests, scripts, CONTRIBUTING.md, or ROADMAP.md), installed into a clean temporary project with `npm install <tarball> --ignore-scripts`, and driven through a real MCP stdio handshake (`@modelcontextprotocol/sdk` `Client`) with no `MYSQL_LEGACY_*` env vars set at all. `tools/list` returned exactly 11 tools and server version `0.2.0`, confirming `tools/list` still needs no database connection (the connection pool is created lazily on first query, not at startup).
- [x] Push the prepared `.github/workflows/ci.yml` and verify CI on Node 18.14.1, 22, and 24. Done: `gh auth status` shows the `workflow` scope, both workflow files are pushed and active (`gh workflow list`), and CI has completed successfully (`gh run list`) as of 2026-09-10 08:43 UTC — but only through commit `418def1`. The 0.2.0 work (write tools, pool, read-only transactions, and this documentation pass) was pushed afterward in the same session and CI has since run green on the current tip too (see the dry-run entry below, which runs the same checks).
- [x] Manually ran the `Publish npm package` workflow with `publish=false` against the current `main` tip (commit `e274b35`) on 2026-09-10: [run 34469303810](https://github.com/Rufflet/mysql-legacy-mcp/actions/runs/34469303810), conclusion `success`. Steps `npm ci --ignore-scripts`, `npm run check`, `npm run smoke:static`, `npm pack --dry-run --ignore-scripts`, and `npm publish --dry-run` all succeeded on a clean GitHub-hosted runner; the real `npm publish --access public` step correctly stayed `skipped`. This is the full release-preflight for the 0.2.0 tree, not just the 2026-09-10 08:43 UTC run on the older `418def1` commit noted above.
- [x] Tested the server against the author's own real legacy production MySQL (not just the reproducible Docker/Debian-archive matrix in the "Live runs" sections below), over an authorized local SSH tunnel, using the actual Claude Code MCP client — i.e. dogfooding through the real usage path, not `scripts/smoke-mcp.js`. Confirmed live: server version 5.1.73; all 7 original read-only tools plus all 4 opt-in write tools; the new `collation`/`charset` fields on real cp1251 columns; a full INSERT→SELECT→UPDATE→SELECT→DELETE round trip of Cyrillic text (including `ё` and an em dash) through the default `UTF8_GENERAL_CI` connection charset into a real cp1251 table, with no corruption in either direction; the UPDATE/DELETE WHERE-clause guard rejecting a WHERE-less statement before it reached the database; and the DDL tool's table-level-only scope (created and dropped a disposable table; a `DROP DATABASE` attempt was separately blocked by Claude Code's own auto-mode safety classifier before it could reach the MCP server at all, so that specific rejection message was not exercised this way — the table-level-only guard itself is already covered by `test/static-smoke.js` and the Docker matrix). See AUDIT.md for the anonymized record.
- [x] Confirm the owner's npm 2FA and publishing method. Re-checked 2026-09-10: `npm whoami` now returns `rufflet` (this machine has an authenticated npm session) and `npm profile get` reports `tfa.mode: "auth-and-writes"` — 2FA is required for both login and publish/write operations. The earlier ENEEDAUTH note in this checklist is stale.
- [ ] After the package first exists on npm, configure trusted publishing in its npmjs.com Settings → Trusted publishing section for `.github/workflows/publish.yml`. The prepared workflow is manual and defaults to npm publish --dry-run; a real release requires explicitly setting its publish input to true. npm automatically generates provenance for a public package published through GitHub Actions OIDC.
- [ ] Recheck the final tarball and release metadata before an explicitly requested publication.
- [x] Add AGENTS.md and CLAUDE.md (repository conventions for AI coding agents working on this project). Done 2026-09-10 in a dedicated follow-up session via an `/init`-style command; CLAUDE.md defers entirely to AGENTS.md via an `@AGENTS.md` include, and AGENTS.md was reviewed for accuracy against the current codebase.

Validation on 2026-09-10: dependency installation, syntax checks, static smoke, packing, and clean consumer installation passed. The package contains the executable, public README, LICENSE, installation/configuration/troubleshooting/audit documentation, and package.json. The installed node_modules/.bin/mysql-legacy-mcp executable completed MCP initialization and exposed exactly seven tools with server version 0.1.0. Version and engine metadata are consistent; documentation JSON snippets and local links were checked. After updating five transitive dependencies within existing version ranges, npm audit --omit=dev reports zero vulnerabilities. server.json passes its declared JSON schema and its name matches package.json mcpName. **This paragraph describes the pre-0.2.0 state (seven tools) and is kept as a historical record — see the unchecked re-validation item above for what still needs to run against the current tree.**

Later the same day, live smoke checks against MySQL 5.0 through 8.0 were run separately (see AUDIT.md); those did establish real compatibility evidence across the full stated 5.0–5.6 range, plus 5.7 and 8.0 for reference. 5.0 and 5.1 have no official Docker image, so each ran as the real Debian-packaged MySQL of its era instead.

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

The draft mirrors version 0.2.0, npm identifier mysql-legacy-mcp, stdio transport, and actual MYSQL_LEGACY_* settings, including the pool, write-tool, and read-only-transaction variables added alongside the 0.2.0 bump. The password is secret and required; host and user are also required, while database and tuning settings are optional. No credentials or unsupported auth/TLS/charset variables are included.

## Client documentation follow-ups

Trae's official page could not be extracted, and Qoder CN-specific setup remains unverified. Their installation entries link to official sources without speculative configurations. Pi is omitted until the exact product and MCP integration are identified. DeepSeek Harness is omitted until the author supplies the intended product URL. No optional consulting/contact section has been added.
