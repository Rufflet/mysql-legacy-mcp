#!/usr/bin/env node
// End-to-end MCP compatibility check: spawns the real src/server.js over stdio and
// drives every registered tool through the actual protocol, against whatever MySQL
// the MYSQL_LEGACY_* env vars point at. Complements scripts/smoke-live.js (which
// calls the driver directly) by also covering MCP transport, list_indexes, a real
// table SELECT, and a UTF-8 round trip.
//
// Requires, in MYSQL_LEGACY_DATABASE:
//   <table>            id INT PRIMARY KEY, label VARCHAR(255), CHARSET utf8
//                       rows: (1,'alpha'), (2,'beta'), (3,'héllo wörld — ключ')
//                       plus an index on label and at least one row present
//   <table>_utf8mb4     id INT PRIMARY KEY, label VARCHAR(255), CHARSET utf8mb4
//                       row: (1, '<any text containing a non-BMP character>')
//                       used only to record (not assert) the driver's documented
//                       utf8mb4 limitation; exact content isn't checked.
//
// The four write tools (mysql_legacy_insert/update/delete/ddl) are always
// registered but each is gated by its own MYSQL_LEGACY_ALLOW_* flag. This script
// checks both branches: with the flag left at its default (false), it asserts the
// tool rejects the call as disabled; with the flag explicitly set to 'true' in the
// environment this script is run under, it drives a real insert/update/delete or
// create+drop cycle against MYSQL_LEGACY_WRITE_SMOKE_TABLE (default
// `<table>_writes`), which must exist with schema
// `id INT PRIMARY KEY AUTO_INCREMENT, label VARCHAR(255)` and stays isolated from
// the read-only fixture above so write checks never touch data the SELECT/describe
// checks depend on.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverPath = resolve(process.env.MCP_SERVER_PATH || resolve(__dirname, '../src/server.js'));

const database = process.env.MYSQL_LEGACY_DATABASE;
const table = process.env.MYSQL_LEGACY_SMOKE_TABLE || 'legacy_smoke';
const writeTable = process.env.MYSQL_LEGACY_WRITE_SMOKE_TABLE || `${table}_writes`;
const ddlTable = `${table}_ddl_check`;

const allowInsert = process.env.MYSQL_LEGACY_ALLOW_INSERT === 'true';
const allowUpdate = process.env.MYSQL_LEGACY_ALLOW_UPDATE === 'true';
const allowDelete = process.env.MYSQL_LEGACY_ALLOW_DELETE === 'true';
const allowDdl = process.env.MYSQL_LEGACY_ALLOW_DDL === 'true';

if (!database) {
  console.error('Set MYSQL_LEGACY_DATABASE and MYSQL_LEGACY_SMOKE_TABLE before running this test. See the schema requirements at the top of this file.');
  process.exit(1);
}

const results = [];

async function check(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail });
    console.log(`OK   ${name}${detail ? ' -> ' + detail : ''}`);
  } catch (error) {
    results.push({ name, ok: false, detail: error.message });
    console.log(`FAIL ${name} -> ${error.message}`);
  }
}

function textOf(result) {
  const text = result?.content?.[0]?.text;
  if (result?.isError) throw new Error(text || 'tool reported isError with no text');
  return text;
}

function errorTextOf(result) {
  return result?.content?.[0]?.text || '';
}

async function main() {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverPath],
    env: process.env
  });
  const client = new Client({ name: 'compat-test', version: '0.0.0' });
  await client.connect(transport);

  await check('tools/list', async () => {
    const { tools } = await client.listTools();
    if (tools.length !== 11) throw new Error(`expected 11 tools, got ${tools.length}`);
    return `${tools.length} tools`;
  });

  await check('mysql_legacy_ping', async () => {
    const res = await client.callTool({ name: 'mysql_legacy_ping', arguments: {} });
    const parsed = JSON.parse(textOf(res));
    if (!parsed.connected) throw new Error('not connected');
    return parsed.version;
  });

  await check('mysql_legacy_list_databases', async () => {
    const res = await client.callTool({ name: 'mysql_legacy_list_databases', arguments: {} });
    const parsed = JSON.parse(textOf(res));
    if (!Array.isArray(parsed.databases)) throw new Error('no databases array');
    if (parsed.databases.includes('mysql')) throw new Error('system database not hidden by default');
    return `${parsed.databases.length} db(s)`;
  });

  await check('mysql_legacy_list_databases(include_system_databases)', async () => {
    const res = await client.callTool({
      name: 'mysql_legacy_list_databases',
      arguments: { include_system_databases: true }
    });
    const parsed = JSON.parse(textOf(res));
    if (!parsed.databases.includes('mysql')) throw new Error('system database missing when included');
    return `${parsed.databases.length} db(s)`;
  });

  await check('mysql_legacy_list_tables', async () => {
    const res = await client.callTool({ name: 'mysql_legacy_list_tables', arguments: { database } });
    const parsed = JSON.parse(textOf(res));
    if (!parsed.tables.some((t) => t.name === table)) throw new Error(`smoke table ${table} not listed`);
    return `${parsed.tables.length} table(s)`;
  });

  await check('mysql_legacy_describe_table', async () => {
    const res = await client.callTool({
      name: 'mysql_legacy_describe_table',
      arguments: { database, table }
    });
    const parsed = JSON.parse(textOf(res));
    if (!parsed.columns.length) throw new Error('no columns returned');
    return `${parsed.columns.length} column(s)`;
  });

  await check('mysql_legacy_show_create_table', async () => {
    const res = await client.callTool({
      name: 'mysql_legacy_show_create_table',
      arguments: { database, table }
    });
    const parsed = JSON.parse(textOf(res));
    if (!parsed.createStatement) throw new Error('no createStatement returned');
    return 'ok';
  });

  await check('mysql_legacy_list_indexes', async () => {
    const res = await client.callTool({
      name: 'mysql_legacy_list_indexes',
      arguments: { database, table }
    });
    const parsed = JSON.parse(textOf(res));
    if (!Array.isArray(parsed.indexes)) throw new Error('no indexes array');
    return `${parsed.indexes.length} index row(s)`;
  });

  await check('mysql_legacy_select (basic)', async () => {
    const res = await client.callTool({
      name: 'mysql_legacy_select',
      arguments: { sql: `SELECT id, label FROM \`${table}\` ORDER BY id` }
    });
    const parsed = JSON.parse(textOf(res));
    if (!parsed.returnedRows) throw new Error('expected rows');
    return `${parsed.returnedRows} row(s)`;
  });

  await check('mysql_legacy_select (unicode round-trip, utf8 column)', async () => {
    const res = await client.callTool({
      name: 'mysql_legacy_select',
      arguments: { sql: `SELECT label FROM \`${table}\` WHERE id = 3` }
    });
    const parsed = JSON.parse(textOf(res));
    const label = parsed.rows[0]?.label;
    if (label !== 'héllo wörld — ключ') throw new Error(`unicode mismatch: ${JSON.stringify(label)}`);
    return 'ok';
  });

  // Informational only: utf8mb4 (emoji) is documented as out of scope since the
  // driver connects with UTF8_GENERAL_CI. Not asserted, just recorded.
  await check('mysql_legacy_select (utf8mb4 emoji, informational)', async () => {
    const res = await client.callTool({
      name: 'mysql_legacy_select',
      arguments: { sql: `SELECT label FROM \`${table}_utf8mb4\` WHERE id = 1` }
    });
    const parsed = JSON.parse(textOf(res));
    const label = parsed.rows[0]?.label;
    return JSON.stringify(label);
  });

  await check('mysql_legacy_select rejects non-SELECT', async () => {
    const res = await client.callTool({
      name: 'mysql_legacy_select',
      arguments: { sql: `DELETE FROM \`${table}\`` }
    });
    if (!res.isError) throw new Error('expected isError for DELETE');
    return 'rejected as expected';
  });

  await check('mysql_legacy_select rejects FOR UPDATE', async () => {
    const res = await client.callTool({
      name: 'mysql_legacy_select',
      arguments: { sql: `SELECT * FROM \`${table}\` FOR UPDATE` }
    });
    if (!res.isError) throw new Error('expected isError for FOR UPDATE');
    return 'rejected as expected';
  });

  // Write tools: always registered, gated per-flag. Each is checked in whichever
  // branch matches the environment this script actually ran under.
  let insertedId;

  if (!allowInsert) {
    await check('mysql_legacy_insert (disabled)', async () => {
      const res = await client.callTool({
        name: 'mysql_legacy_insert',
        arguments: { sql: `INSERT INTO \`${writeTable}\` (label) VALUES ('smoke')` }
      });
      if (!res.isError || !errorTextOf(res).includes('MYSQL_LEGACY_ALLOW_INSERT')) {
        throw new Error('expected disabled-INSERT rejection');
      }
      return 'rejected as expected';
    });
  } else {
    await check('mysql_legacy_insert', async () => {
      const res = await client.callTool({
        name: 'mysql_legacy_insert',
        arguments: { sql: `INSERT INTO \`${writeTable}\` (label) VALUES ('smoke')` }
      });
      const parsed = JSON.parse(textOf(res));
      if (!parsed.insertId) throw new Error('expected insertId');
      insertedId = parsed.insertId;
      return `insertId=${insertedId}`;
    });
  }

  if (!allowUpdate) {
    await check('mysql_legacy_update (disabled)', async () => {
      const res = await client.callTool({
        name: 'mysql_legacy_update',
        arguments: { sql: `UPDATE \`${writeTable}\` SET label = 'updated' WHERE id = 1` }
      });
      if (!res.isError || !errorTextOf(res).includes('MYSQL_LEGACY_ALLOW_UPDATE')) {
        throw new Error('expected disabled-UPDATE rejection');
      }
      return 'rejected as expected';
    });
  } else if (insertedId) {
    await check('mysql_legacy_update', async () => {
      const res = await client.callTool({
        name: 'mysql_legacy_update',
        arguments: { sql: `UPDATE \`${writeTable}\` SET label = 'updated' WHERE id = ${insertedId}` }
      });
      const parsed = JSON.parse(textOf(res));
      if (parsed.affectedRows !== 1) throw new Error(`expected affectedRows=1, got ${parsed.affectedRows}`);
      return 'ok';
    });
  }

  await check('mysql_legacy_update rejects missing WHERE', async () => {
    const res = await client.callTool({
      name: 'mysql_legacy_update',
      arguments: { sql: `UPDATE \`${writeTable}\` SET label = 'updated'` }
    });
    if (!res.isError) throw new Error('expected isError for UPDATE without WHERE');
    return 'rejected as expected';
  });

  if (!allowDelete) {
    await check('mysql_legacy_delete (disabled)', async () => {
      const res = await client.callTool({
        name: 'mysql_legacy_delete',
        arguments: { sql: `DELETE FROM \`${writeTable}\` WHERE id = 1` }
      });
      if (!res.isError || !errorTextOf(res).includes('MYSQL_LEGACY_ALLOW_DELETE')) {
        throw new Error('expected disabled-DELETE rejection');
      }
      return 'rejected as expected';
    });
  } else if (insertedId) {
    await check('mysql_legacy_delete', async () => {
      const res = await client.callTool({
        name: 'mysql_legacy_delete',
        arguments: { sql: `DELETE FROM \`${writeTable}\` WHERE id = ${insertedId}` }
      });
      const parsed = JSON.parse(textOf(res));
      if (parsed.affectedRows !== 1) throw new Error(`expected affectedRows=1, got ${parsed.affectedRows}`);
      return 'ok';
    });
  }

  await check('mysql_legacy_delete rejects missing WHERE', async () => {
    const res = await client.callTool({
      name: 'mysql_legacy_delete',
      arguments: { sql: `DELETE FROM \`${writeTable}\`` }
    });
    if (!res.isError) throw new Error('expected isError for DELETE without WHERE');
    return 'rejected as expected';
  });

  if (!allowDdl) {
    await check('mysql_legacy_ddl (disabled)', async () => {
      const res = await client.callTool({
        name: 'mysql_legacy_ddl',
        arguments: { sql: `CREATE TABLE \`${ddlTable}\` (id INT PRIMARY KEY)` }
      });
      if (!res.isError || !errorTextOf(res).includes('MYSQL_LEGACY_ALLOW_DDL')) {
        throw new Error('expected disabled-DDL rejection');
      }
      return 'rejected as expected';
    });
  } else {
    await check('mysql_legacy_ddl (create + drop)', async () => {
      const created = await client.callTool({
        name: 'mysql_legacy_ddl',
        arguments: { sql: `CREATE TABLE \`${ddlTable}\` (id INT PRIMARY KEY)` }
      });
      const createdParsed = JSON.parse(textOf(created));
      if (createdParsed.statementType !== 'create') throw new Error('expected statementType=create');

      const dropped = await client.callTool({
        name: 'mysql_legacy_ddl',
        arguments: { sql: `DROP TABLE \`${ddlTable}\`` }
      });
      const droppedParsed = JSON.parse(textOf(dropped));
      if (droppedParsed.statementType !== 'drop') throw new Error('expected statementType=drop');
      return 'create+drop ok';
    });
  }

  await check('mysql_legacy_ddl rejects non-table-level DROP', async () => {
    const res = await client.callTool({
      name: 'mysql_legacy_ddl',
      arguments: { sql: 'DROP DATABASE this_should_not_run' }
    });
    if (!res.isError) throw new Error('expected isError for DROP DATABASE');
    return 'rejected as expected';
  });

  await client.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error('Fatal:', error);
  process.exit(1);
});
