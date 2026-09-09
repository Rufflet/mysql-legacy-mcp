import { executeQuery, qualifiedTable, validateSelectQuery } from '../src/server.js';

const database = process.env.MYSQL_LEGACY_DATABASE;
const table = process.env.MYSQL_LEGACY_SMOKE_TABLE;

if (!database || !table) {
  console.error('Set MYSQL_LEGACY_DATABASE and MYSQL_LEGACY_SMOKE_TABLE before running this smoke test.');
  process.exit(1);
}

const qualified = qualifiedTable(database, table);
const selectSmoke = 'SELECT 1 AS value';
validateSelectQuery(selectSmoke);
const checks = [
  ['ping/version', 'SELECT VERSION() AS version'],
  ['read-only select', selectSmoke],
  ['list databases', 'SHOW DATABASES'],
  ['list tables', `SHOW FULL TABLES FROM \`${database.replace(/`/g, '``')}\``],
  ['describe table', `SHOW FULL COLUMNS FROM ${qualified}`],
  ['show create table', `SHOW CREATE TABLE ${qualified}`]
];

for (const [name, sql] of checks) {
  const rows = await executeQuery(sql);
  console.log(`${name}: ok (${Array.isArray(rows) ? rows.length : 0} row(s))`);
}
