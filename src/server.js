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
    connectTimeout: 10000,
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

export async function executeQuery(sql) {
  const connection = mysql.createConnection(connectionOptions());
  const { timeout } = queryLimits();
  return new Promise((resolveQuery, rejectQuery) => {
    connection.query({ sql, timeout }, (queryError, rows) => {
      connection.end((endError) => {
        if (queryError) return rejectQuery(queryError);
        if (endError) return rejectQuery(endError);
        return resolveQuery(rows);
      });
    });
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

export function createServer() {
  const server = new McpServer({ name: 'mysql-legacy-mcp', version: '0.1.0' });

  server.registerTool('mysql_legacy_ping', {
    description: 'Checks the legacy MySQL connection with SELECT VERSION() AS version. Read-only.'
  }, () => safely(async () => {
    const rows = await executeQuery('SELECT VERSION() AS version');
    return { connected: true, version: rows[0]?.version ?? null };
  }));

  server.registerTool('mysql_legacy_select', {
    description: 'Executes exactly one read-only SELECT statement. SELECT INTO and locking reads are rejected; results are limited by MYSQL_LEGACY_MAX_ROWS and MYSQL_LEGACY_MAX_RESULT_BYTES.',
    inputSchema: z.object({
      sql: selectQuerySchema.describe('One MySQL 5.1-compatible SELECT statement.')
    })
  }, ({ sql }) => safely(async () => {
    validateSelectQuery(sql);
    const rows = await executeQuery(sql);
    if (!Array.isArray(rows)) throw new Error('SELECT did not return a row set');
    const { maxRows, maxResultBytes } = queryLimits();
    return limitSelectRows(rows, maxRows, maxResultBytes);
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
    description: 'Lists columns with SHOW FULL COLUMNS FROM <database>.<table>. Read-only.',
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
        comment: row.Comment
      }))
    };
  }));

  server.registerTool('mysql_legacy_show_create_table', {
    description: 'Returns the definition from SHOW CREATE TABLE <database>.<table>. Read-only.',
    inputSchema: z.object({ database: identifierSchema, table: identifierSchema })
  }, ({ database, table }) => safely(async () => {
    const row = (await executeQuery(schemaQueries(database, table).showCreateTable))[0] ?? {};
    return {
      database,
      table,
      createStatement: row['Create Table'] ?? row['Create View'] ?? Object.values(row)[1] ?? null
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
