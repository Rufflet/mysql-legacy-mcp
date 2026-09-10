# Contributing

`mysql-legacy-mcp` is a small, deliberately narrow tool: an MCP server for legacy MySQL (5.0–5.6), read-only by default with a handful of opt-in write tools. Contributions are welcome, but the project favors staying small and evidence-based over growing scope. Before proposing a larger feature, check [docs/ROADMAP.md](docs/ROADMAP.md) — it lists things that were considered and deliberately deferred, along with the reasoning, so you don't duplicate that analysis.

## Reporting issues

Open a GitHub issue. Include the exact MySQL version (`SELECT VERSION()`), the Node.js version, and the exact error text — this project's documentation is built on real reproduced errors, not generic search phrases, so a precise report is far more useful than a paraphrase.

## Proposing changes

1. Open an issue first for anything beyond a small fix, so the approach can be agreed before you write code.
2. Fork and branch from `main`.
3. Keep changes minimal and scoped to the stated problem — no unrelated refactors or drive-by formatting changes in the same PR.
4. Match the existing code style: no comments unless they explain a non-obvious *why*, small focused functions, reuse of existing helpers (`env`/`booleanEnv`/`integerEnv`, `safely`, `withConnection`) over new ad hoc patterns.

## Development setup

```sh
npm ci
```

Run before every PR (no database required):

```sh
npm run check         # node --check on the server and scripts
npm run smoke:static  # pure unit tests (validators, quoting, limits, version gating)
```

`npm run smoke:live` and `npm run smoke:mcp` need a real MySQL instance (`MYSQL_LEGACY_*` env vars, plus `MYSQL_LEGACY_SMOKE_TABLE`/`MYSQL_LEGACY_WRITE_SMOKE_TABLE` fixtures — see the header comments in `scripts/smoke-live.js` and `scripts/smoke-mcp.js` for the exact schema each expects). If your change affects SQL behavior, driver options, or version handling, run these against a real server before opening a PR, and say which MySQL version(s) you tested against in the PR description.

## Compatibility claims

This project's standard is: no compatibility claim without a passing test against a real server exhibiting that behavior. If you can't test against a given MySQL version or auth/charset/TLS mode, say so explicitly in your PR rather than assuming it works — [docs/AUDIT.md](docs/AUDIT.md) records exactly what has and hasn't been verified, and how (including the Docker/Debian-archive approach used to reach pre-2013 MySQL versions that have no official Docker image). A new compatibility claim should extend that document with the same rigor: exact server version, auth method, Node version, and what was actually exercised.

## License

By contributing, you agree your contribution is licensed under this project's [MIT license](LICENSE).
