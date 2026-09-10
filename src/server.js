#!/usr/bin/env node
import mysql from 'mysql';
import SqlParser from 'node-sql-parser';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { realpathSync } from 'node:fs';

const { Parser } = SqlParser;
const sqlParser = new Parser();
const SYSTEM_DATABASES = new Set(['information_schema', 'mysql']);
const identifierSchema = z.string().min(1).max(64);
const selectQuerySchema = z.string().min(1).max(100000);

function env(name, { required = false, defaultValue } = {}) {
  const value = process.env[name];
  if (value === undefined || value === '') {
    if (required) throw new Error(`Missing required environment variable: ${name}`);
    return defaultValue;
  }
  return value;
}

function booleanEnv(name, defaultValue) {
  const value = env(name);
  if (value === undefined) return defaultValue;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`${name} must be true or false`);
}

function integerEnv(name, defaultValue, min, max) {
  const value = Number(env(name, { defaultValue: String(defaultValue) }));
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return value;
}

function queryLimits() {
  return {
    timeout: integerEnv('MYSQL_LEGACY_QUERY_TIMEOUT', 10000, 100, 60000),
    maxRows: integerEnv('MYSQL_LEGACY_MAX_ROWS', 200, 1, 1000),
    maxResultBytes: integerEnv('MYSQL_LEGACY_MAX_RESULT_BYTES', 262144, 1024, 1048576)
  };
}

function connectionOptions() {
  const port = Number(env('MYSQL_LEGACY_PORT', { defaultValue: '3306' }));
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('MYSQL_LEGACY_PORT must be an integer between 1 and 65535');
  }

  return {
    host: env('MYSQL_LEGACY_HOST', { required: true }),
    port,
    user: env('MYSQL_LEGACY_USER', { required: true }),
    password: env('MYSQL_LEGACY_PASSWORD', { required: true }),
    database: env('MYSQL_LEGACY_DATABASE'),
    connectTimeout: integerEnv('MYSQL_LEGACY_CONNECT_TIMEOUT', 10000, 100, 60000),
    multipleStatements: false
  };
}

export function quoteIdentifier(identifier, label = 'identifier') {
  if (typeof identifier !== 'string' || identifier.length === 0 || identifier.length > 64) {
    throw new Error(`${label} must be a non-empty identifier up to 64 characters`);
  }
  if (/[;\u0000-\u001F\u007F]/.test(identifier)) {
    throw new Error(`${label} contains a forbidden character`);
  }
  return `\`${identifier.replace(/`/g, '``')}\``;
}

export function qualifiedTable(database, table) {
  return `${quoteIdentifier(database, 'database')}.${quoteIdentifier(table, 'table')}`;
}

export function schemaQueries(database, table) {
  const qualified = qualifiedTable(database, table);
  return {
    listTables: `SHOW FULL TABLES FROM ${quoteIdentifier(database, 'database')}`,
    describeTable: `SHOW FULL COLUMNS FROM ${qualified}`,
    showCreateTable: `SHOW CREATE TABLE ${qualified}`,
    listIndexes: `SHOW INDEX FROM ${qualified}`
  };
}

function forbiddenSelectFeature(node) {
  if (node === null || typeof node !== 'object') return null;
  if (node.type === 'select' && node.into && (node.into.position || node.into.keyword)) {
    return 'SELECT ... INTO is not allowed';
  }
  if (node.type === 'select' && node.locking_read) {
    return `locking read ${node.locking_read} is not allowed`;
  }
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const forbidden = forbiddenSelectFeature(item);
        if (forbidden) return forbidden;
      }
    } else {
      const forbidden = forbiddenSelectFeature(value);
      if (forbidden) return forbidden;
    }
  }
  return null;
}

export function validateSelectQuery(sql) {
  if (typeof sql !== 'string' || sql.trim() === '') {
    throw new Error('SQL must be a non-empty string');
  }

  let ast;
  try {
    ast = sqlParser.astify(sql, { database: 'mysql' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown parser error';
    throw new Error(`SQL parsing failed: ${message}`);
  }

  const statements = Array.isArray(ast) ? ast : [ast];
  if (statements.length !== 1 || statements[0]?.type !== 'select') {
    throw new Error('Exactly one SELECT statement is allowed');
  }

  const forbidden = forbiddenSelectFeature(statements[0]);
  if (forbidden) throw new Error(forbidden);
}

export function limitSelectRows(rows, maxRows, maxResultBytes) {
  const limitedRows = [];
  let resultBytes = 2;

  for (const row of rows) {
    if (limitedRows.length >= maxRows) break;
    const serialized = JSON.stringify(row) ?? 'null';
    const rowBytes = Buffer.byteLength(serialized, 'utf8') + (limitedRows.length > 0 ? 1 : 0);
    if (resultBytes + rowBytes > maxResultBytes) break;
    limitedRows.push(row);
    resultBytes += rowBytes;
  }

  return {
    rows: limitedRows,
    returnedRows: limitedRows.length,
    totalRows: rows.length,
    truncated: limitedRows.length < rows.length
  };
}

function requireStatementType(sql, expectedTypes, label) {
  if (typeof sql !== 'string' || sql.trim() === '') {
    throw new Error('SQL must be a non-empty string');
  }

  let ast;
  try {
    ast = sqlParser.astify(sql, { database: 'mysql' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown parser error';
    throw new Error(`SQL parsing failed: ${message}`);
  }

  const statements = Array.isArray(ast) ? ast : [ast];
  const types = Array.isArray(expectedTypes) ? expectedTypes : [expectedTypes];
  if (statements.length !== 1 || !types.includes(statements[0]?.type)) {
    throw new Error(`Exactly one ${label} statement is allowed`);
  }

  return statements[0];
}

const WHERE_GUARD_MESSAGE = (verb) =>
  `${verb} without a WHERE clause is rejected. Add an explicit WHERE, or use TRUNCATE via mysql_legacy_ddl if you intend to clear the whole table.`;

export function validateInsertQuery(sql) {
  return requireStatementType(sql, 'insert', 'INSERT');
}

export function validateUpdateQuery(sql) {
  const ast = requireStatementType(sql, 'update', 'UPDATE');
  if (!ast.where) throw new Error(WHERE_GUARD_MESSAGE('UPDATE'));
  return ast;
}

export function validateDeleteQuery(sql) {
  const ast = requireStatementType(sql, 'delete', 'DELETE');
  if (!ast.where) throw new Error(WHERE_GUARD_MESSAGE('DELETE'));
  return ast;
}

const DDL_TYPES = ['create', 'alter', 'drop', 'truncate', 'rename'];
const DDL_LABEL = 'CREATE, ALTER, DROP, TRUNCATE, or RENAME';

export function validateDdlQuery(sql) {
  const ast = requireStatementType(sql, DDL_TYPES, DDL_LABEL);
  if ((ast.type === 'create' || ast.type === 'drop') && ast.keyword && ast.keyword !== 'table') {
    throw new Error(
      `${ast.type.toUpperCase()} ${ast.keyword.toUpperCase()} is not allowed. mysql_legacy_ddl only accepts table-level statements: CREATE/ALTER/DROP TABLE, TRUNCATE TABLE, RENAME TABLE.`
    );
  }
  return ast;
}

export function parseServerVersion(raw) {
  const match = typeof raw === 'string' ? /^(\d+)\.(\d+)\.(\d+)/.exec(raw) : null;
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), raw };
}

export function supportsReadOnlyTransactions(version) {
  if (!version) return false;
  const { major, minor, patch } = version;
  if (major !== 5) return major > 5;
  if (minor !== 6) return minor > 6;
  return patch >= 5;
}

let pool;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      ...connectionOptions(),
      connectionLimit: integerEnv('MYSQL_LEGACY_POOL_SIZE', 5, 1, 50)
    });
  }
  return pool;
}

export async function withConnection(callback) {
  const connection = await new Promise((resolveConn, rejectConn) => {
    getPool().getConnection((error, conn) => (error ? rejectConn(error) : resolveConn(conn)));
  });
  try {
    return await callback(connection);
  } finally {
    connection.release();
  }
}

function runQuery(connection, sql) {
  const { timeout } = queryLimits();
  return new Promise((resolveQuery, rejectQuery) => {
    connection.query({ sql, timeout }, (error, rows) => (error ? rejectQuery(error) : resolveQuery(rows)));
  });
}

export async function executeQuery(sql) {
  return withConnection((connection) => runQuery(connection, sql));
}

let cachedServerVersion;

async function detectServerVersion() {
  if (cachedServerVersion !== undefined) return cachedServerVersion;
  const rows = await executeQuery('SELECT VERSION() AS version');
  cachedServerVersion = parseServerVersion(rows[0]?.version);
  return cachedServerVersion;
}

async function selectReadOnly(sql) {
  if (booleanEnv('MYSQL_LEGACY_DISABLE_READ_ONLY_TRANSACTIONS', false)) {
    return executeQuery(sql);
  }

  const version = await detectServerVersion();
  if (!supportsReadOnlyTransactions(version)) {
    return executeQuery(sql);
  }

  return withConnection(async (connection) => {
    await runQuery(connection, 'START TRANSACTION READ ONLY');
    try {
      const rows = await runQuery(connection, sql);
      await runQuery(connection, 'COMMIT');
      return rows;
    } catch (error) {
      await runQuery(connection, 'ROLLBACK').catch(() => {});
      throw error;
    }
  });
}

function textResult(value) {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}

function errorResult(error) {
  const code = error && typeof error === 'object' && 'code' in error ? ` (${error.code})` : '';
  const message = error instanceof Error ? error.message : 'Unknown error';
  return { content: [{ type: 'text', text: `MySQL legacy MCP error${code}: ${message}` }], isError: true };
}

async function safely(callback) {
  try {
    return textResult(await callback());
  } catch (error) {
    return errorResult(error);
  }
}

function tableRows(rows) {
  return rows.map((row) => {
    const keys = Object.keys(row);
    return { name: row[keys[0]], type: row.Table_type ?? row[keys[1]] };
  });
}

export function tableCharsetFromCreateStatement(createStatement) {
  if (typeof createStatement !== 'string') return null;
  const match = /DEFAULT CHARSET=([\w]+)/i.exec(createStatement);
  return match ? match[1] : null;
}

export function createServer() {
  const server = new McpServer({ name: 'mysql-legacy-mcp', version: '0.2.0' });

  server.registerTool('mysql_legacy_ping', {
    description: 'Checks the legacy MySQL connection with SELECT VERSION() AS version. Read-only.'
  }, () => safely(async () => {
    const rows = await executeQuery('SELECT VERSION() AS version');
    return { connected: true, version: rows[0]?.version ?? null };
  }));

  server.registerTool('mysql_legacy_select', {
    description: 'Executes exactly one read-only SELECT statement. SELECT INTO and locking reads are rejected; results are limited by MYSQL_LEGACY_MAX_ROWS and MYSQL_LEGACY_MAX_RESULT_BYTES. Runs inside a START TRANSACTION READ ONLY block on MySQL 5.6.5+ unless MYSQL_LEGACY_DISABLE_READ_ONLY_TRANSACTIONS=true.',
    inputSchema: z.object({
      sql: selectQuerySchema.describe('One MySQL 5.1-compatible SELECT statement.')
    })
  }, ({ sql }) => safely(async () => {
    validateSelectQuery(sql);
    const rows = await selectReadOnly(sql);
    if (!Array.isArray(rows)) throw new Error('SELECT did not return a row set');
    const { maxRows, maxResultBytes } = queryLimits();
    return limitSelectRows(rows, maxRows, maxResultBytes);
  }));

  server.registerTool('mysql_legacy_insert', {
    description: 'Executes exactly one INSERT statement. Disabled unless MYSQL_LEGACY_ALLOW_INSERT=true.',
    inputSchema: z.object({
      sql: selectQuerySchema.describe('One MySQL INSERT statement.')
    })
  }, ({ sql }) => safely(async () => {
    if (!booleanEnv('MYSQL_LEGACY_ALLOW_INSERT', false)) {
      throw new Error('INSERT is disabled. Set MYSQL_LEGACY_ALLOW_INSERT=true to enable.');
    }
    validateInsertQuery(sql);
    const result = await executeQuery(sql);
    return { insertId: result.insertId, affectedRows: result.affectedRows };
  }));

  server.registerTool('mysql_legacy_update', {
    description: 'Executes exactly one UPDATE statement. A WHERE clause is required and cannot be disabled. Disabled unless MYSQL_LEGACY_ALLOW_UPDATE=true.',
    inputSchema: z.object({
      sql: selectQuerySchema.describe('One MySQL UPDATE statement with a WHERE clause.')
    })
  }, ({ sql }) => safely(async () => {
    if (!booleanEnv('MYSQL_LEGACY_ALLOW_UPDATE', false)) {
      throw new Error('UPDATE is disabled. Set MYSQL_LEGACY_ALLOW_UPDATE=true to enable.');
    }
    validateUpdateQuery(sql);
    const result = await executeQuery(sql);
    return { affectedRows: result.affectedRows, changedRows: result.changedRows };
  }));

  server.registerTool('mysql_legacy_delete', {
    description: 'Executes exactly one DELETE statement. A WHERE clause is required and cannot be disabled. Disabled unless MYSQL_LEGACY_ALLOW_DELETE=true.',
    inputSchema: z.object({
      sql: selectQuerySchema.describe('One MySQL DELETE statement with a WHERE clause.')
    })
  }, ({ sql }) => safely(async () => {
    if (!booleanEnv('MYSQL_LEGACY_ALLOW_DELETE', false)) {
      throw new Error('DELETE is disabled. Set MYSQL_LEGACY_ALLOW_DELETE=true to enable.');
    }
    validateDeleteQuery(sql);
    const result = await executeQuery(sql);
    return { affectedRows: result.affectedRows };
  }));

  server.registerTool('mysql_legacy_ddl', {
    description: 'Executes exactly one table-level CREATE, ALTER, DROP, TRUNCATE, or RENAME statement. Disabled unless MYSQL_LEGACY_ALLOW_DDL=true.',
    inputSchema: z.object({
      sql: selectQuerySchema.describe('One MySQL table-level DDL statement.')
    })
  }, ({ sql }) => safely(async () => {
    if (!booleanEnv('MYSQL_LEGACY_ALLOW_DDL', false)) {
      throw new Error('DDL is disabled. Set MYSQL_LEGACY_ALLOW_DDL=true to enable.');
    }
    const ast = validateDdlQuery(sql);
    await executeQuery(sql);
    return { success: true, statementType: ast.type };
  }));

  server.registerTool('mysql_legacy_list_databases', {
    description: 'Lists databases using SHOW DATABASES. System databases are hidden by default according to MYSQL_LEGACY_HIDE_SYSTEM_DATABASES.',
    inputSchema: z.object({
      include_system_databases: z.boolean().optional().describe('Overrides MYSQL_LEGACY_HIDE_SYSTEM_DATABASES for this call.')
    })
  }, ({ include_system_databases }) => safely(async () => {
    const hideSystem = include_system_databases === undefined
      ? booleanEnv('MYSQL_LEGACY_HIDE_SYSTEM_DATABASES', true)
      : !include_system_databases;
    const rows = await executeQuery('SHOW DATABASES');
    const databases = rows.map((row) => row.Database ?? Object.values(row)[0]);
    return { databases: hideSystem ? databases.filter((name) => !SYSTEM_DATABASES.has(name)) : databases };
  }));

  server.registerTool('mysql_legacy_list_tables', {
    description: 'Lists base tables and views with SHOW FULL TABLES FROM <database>. Read-only.',
    inputSchema: z.object({ database: identifierSchema })
  }, ({ database }) => safely(async () => {
    const rows = await executeQuery(schemaQueries(database, 'unused').listTables);
    return { database, tables: tableRows(rows) };
  }));

  server.registerTool('mysql_legacy_describe_table', {
    description: 'Lists columns with SHOW FULL COLUMNS FROM <database>.<table>, including each column\'s collation. Read-only.',
    inputSchema: z.object({ database: identifierSchema, table: identifierSchema })
  }, ({ database, table }) => safely(async () => {
    const rows = await executeQuery(schemaQueries(database, table).describeTable);
    return {
      database,
      table,
      columns: rows.map((row) => ({
        name: row.Field,
        type: row.Type,
        nullable: row.Null,
        key: row.Key,
        default: row.Default,
        extra: row.Extra,
        comment: row.Comment,
        collation: row.Collation ?? null
      }))
    };
  }));

  server.registerTool('mysql_legacy_show_create_table', {
    description: 'Returns the definition from SHOW CREATE TABLE <database>.<table>, plus the table\'s default charset parsed out for convenience. Read-only.',
    inputSchema: z.object({ database: identifierSchema, table: identifierSchema })
  }, ({ database, table }) => safely(async () => {
    const row = (await executeQuery(schemaQueries(database, table).showCreateTable))[0] ?? {};
    const createStatement = row['Create Table'] ?? row['Create View'] ?? Object.values(row)[1] ?? null;
    return {
      database,
      table,
      createStatement,
      charset: tableCharsetFromCreateStatement(createStatement)
    };
  }));

  server.registerTool('mysql_legacy_list_indexes', {
    description: 'Lists indexes with SHOW INDEX FROM <database>.<table>. Read-only.',
    inputSchema: z.object({ database: identifierSchema, table: identifierSchema })
  }, ({ database, table }) => safely(async () => {
    const rows = await executeQuery(schemaQueries(database, table).listIndexes);
    return {
      database,
      table,
      indexes: rows.map((row) => ({
        table: row.Table,
        nonUnique: row.Non_unique,
        keyName: row.Key_name,
        sequence: row.Seq_in_index,
        columnName: row.Column_name,
        collation: row.Collation,
        cardinality: row.Cardinality,
        subPart: row.Sub_part,
        packed: row.Packed,
        nullable: row.Null,
        indexType: row.Index_type,
        comment: row.Comment
      }))
    };
  }));

  return server;
}

async function main() {
  const server = createServer();
  await server.connect(new StdioServerTransport());
  console.error('mysql-legacy-mcp is running on stdio');
}

if (process.argv[1] && realpathSync(resolve(process.argv[1])) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`mysql-legacy-mcp failed to start: ${error.message}`);
    process.exit(1);
  });
}
