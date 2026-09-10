# Prompt: extend legacy connection compatibility

You are maintaining `mysql-legacy-mcp`, a read-only stdio MCP server using the `mysql` (mysqljs) driver. Extend connection compatibility only after proving each added behavior with automated, reproducible tests. Do not publish the npm package, submit it to a registry, weaken read-only SQL controls, or make unsupported compatibility claims.

## Objective

Investigate and, where technically sound, implement opt-in support for:

1. pre-4.1 `old_password` authentication / `insecureAuth`;
2. configurable connection charsets, including `cp1251`, `latin1`, and one non-Unicode charset used outside Cyrillic locales (for example `sjis`), with real round-trip tests using representative text;
3. TLS/SSL connection options suitable for legacy MySQL deployments.

## Required process

1. Audit the current driver and server code first. Record exactly which mysqljs options are available and their security implications. Do not assume mysql2 options apply.
2. Define minimal explicit environment variables, validate every value, and never log credentials, certificate contents, or private keys.
3. Keep insecure behavior opt-in. Explain that `insecureAuth` and disabled certificate verification reduce security and must never be enabled by default.
4. Add tests that drive the installed MCP server through stdio, not merely direct driver calls. Preserve existing tests.
5. For authentication, test a real server/account actually using the old authentication path. A label such as `old_password supported` is forbidden unless that test passes. If a MySQL 3.x/4.0 target cannot be run reproducibly, document the gap rather than pretending 5.0 default authentication covers it.
6. For charsets, store and retrieve actual Cyrillic `cp1251`, Western-European `latin1`, and the chosen non-Unicode charset data. Verify exact values or precise expected conversion behavior, not only that a query does not throw.
7. For TLS, test successful verified TLS, rejected invalid/untrusted certificates, and the intended legacy-protocol boundary. Do not globally weaken Node's TLS policy. If an old server cannot negotiate securely with a current Node/OpenSSL stack, document that result and recommend a local secure tunnel instead of silently setting unsafe defaults.
8. Update README, `docs/CONFIGURATION.md`, `docs/TROUBLESHOOTING.md`, and `docs/AUDIT.md` with only evidence-backed behavior. Move any long explanation out of README.
9. Run `npm run check`, static smoke tests, MCP smoke tests, a clean packed-tarball installation test, and `npm publish --dry-run`. Do not run real `npm publish`.

## Acceptance criteria

- Existing MySQL 5.0–5.6 coverage remains passing.
- Every new option is opt-in, validated, documented, and covered by an MCP-level integration test.
- The default configuration remains a read-only plaintext-TCP client with no claim to solve old-password, arbitrary charset, or TLS compatibility unless its dedicated evidence exists.
- The final report lists tested MySQL version, account auth method, Node version, connection charset, TLS settings, and test outcome for every compatibility claim.
