import assert from 'node:assert/strict';
import {
  limitSelectRows,
  parseServerVersion,
  qualifiedTable,
  quoteIdentifier,
  schemaQueries,
  supportsReadOnlyTransactions,
  tableCharsetFromCreateStatement,
  validateDdlQuery,
  validateDeleteQuery,
  validateInsertQuery,
  validateSelectQuery,
  validateUpdateQuery
} from '../src/server.js';

assert.equal(quoteIdentifier('eventnn'), '`eventnn`');
assert.equal(quoteIdentifier('name`part'), '`name``part`');
assert.equal(qualifiedTable('eventnn', 'orders'), '`eventnn`.`orders`');
assert.throws(() => quoteIdentifier('eventnn; DROP TABLE users'), /forbidden/);
assert.throws(() => quoteIdentifier('eventnn\u0000users'), /forbidden/);

const queries = schemaQueries('eventnn', 'orders');
assert.equal(queries.listTables, 'SHOW FULL TABLES FROM `eventnn`');
assert.equal(queries.describeTable, 'SHOW FULL COLUMNS FROM `eventnn`.`orders`');
assert.equal(queries.showCreateTable, 'SHOW CREATE TABLE `eventnn`.`orders`');
assert.equal(queries.listIndexes, 'SHOW INDEX FROM `eventnn`.`orders`');

assert.doesNotThrow(() => validateSelectQuery('SELECT id, name FROM users LIMIT 10'));
assert.doesNotThrow(() => validateSelectQuery("SELECT 'INTO OUTFILE' AS harmless_text"));
assert.throws(() => validateSelectQuery('INSERT INTO users (id) VALUES (1)'), /Exactly one SELECT/);
assert.throws(() => validateSelectQuery('UPDATE users SET active = 0'), /Exactly one SELECT/);
assert.throws(() => validateSelectQuery('DELETE FROM users'), /Exactly one SELECT/);
assert.throws(() => validateSelectQuery('CREATE TABLE unsafe (id INT)'), /Exactly one SELECT/);
assert.throws(() => validateSelectQuery('CALL unsafe_procedure()'), /Exactly one SELECT/);
assert.throws(() => validateSelectQuery('SELECT 1; SELECT 2'), /Exactly one SELECT/);
assert.throws(
  () => validateSelectQuery("SELECT * INTO OUTFILE '/tmp/users.txt' FROM users"),
  /SELECT \.\.\. INTO/
);
assert.throws(
  () => validateSelectQuery("SELECT * INTO DUMPFILE '/tmp/users.bin' FROM users"),
  /SELECT \.\.\. INTO/
);
assert.throws(() => validateSelectQuery('SELECT * FROM users FOR UPDATE'), /locking read/);
assert.throws(() => validateSelectQuery('SELECT * FROM users LOCK IN SHARE MODE'), /locking read/);

const rowLimited = limitSelectRows([{ id: 1 }, { id: 2 }, { id: 3 }], 2, 1000);
assert.deepEqual(rowLimited.rows, [{ id: 1 }, { id: 2 }]);
assert.equal(rowLimited.returnedRows, 2);
assert.equal(rowLimited.totalRows, 3);
assert.equal(rowLimited.truncated, true);

const byteLimited = limitSelectRows([{ value: 'too large' }], 10, 10);
assert.deepEqual(byteLimited.rows, []);
assert.equal(byteLimited.truncated, true);

// INSERT
assert.doesNotThrow(() => validateInsertQuery("INSERT INTO users (id, name) VALUES (1, 'a')"));
assert.throws(() => validateInsertQuery('SELECT 1'), /Exactly one INSERT/);
assert.throws(
  () => validateInsertQuery("INSERT INTO users (id) VALUES (1); INSERT INTO users (id) VALUES (2)"),
  /Exactly one INSERT/
);

// UPDATE
assert.doesNotThrow(() => validateUpdateQuery('UPDATE users SET active = 0 WHERE id = 1'));
assert.throws(() => validateUpdateQuery('UPDATE users SET active = 0'), /WHERE clause is rejected/);
assert.throws(() => validateUpdateQuery('UPDATE users SET active = 0'), /mysql_legacy_ddl/);
assert.throws(() => validateUpdateQuery('SELECT 1'), /Exactly one UPDATE/);
assert.throws(
  () => validateUpdateQuery('UPDATE users SET active = 0 WHERE id = 1; UPDATE users SET active = 1 WHERE id = 2'),
  /Exactly one UPDATE/
);

// DELETE
assert.doesNotThrow(() => validateDeleteQuery('DELETE FROM users WHERE id = 1'));
assert.throws(() => validateDeleteQuery('DELETE FROM users'), /WHERE clause is rejected/);
assert.throws(() => validateDeleteQuery('DELETE FROM users'), /mysql_legacy_ddl/);
assert.throws(() => validateDeleteQuery('SELECT 1'), /Exactly one DELETE/);

// DDL
assert.doesNotThrow(() => validateDdlQuery('CREATE TABLE t (id INT PRIMARY KEY)'));
assert.doesNotThrow(() => validateDdlQuery('ALTER TABLE t ADD COLUMN label VARCHAR(255)'));
assert.doesNotThrow(() => validateDdlQuery('DROP TABLE t'));
assert.doesNotThrow(() => validateDdlQuery('TRUNCATE TABLE t'));
assert.doesNotThrow(() => validateDdlQuery('RENAME TABLE t TO t2'));
assert.throws(() => validateDdlQuery('SELECT 1'), /Exactly one CREATE, ALTER, DROP, TRUNCATE, or RENAME/);
assert.throws(
  () => validateDdlQuery('CREATE TABLE t (id INT); DROP TABLE t'),
  /Exactly one CREATE, ALTER, DROP, TRUNCATE, or RENAME/
);
assert.throws(() => validateDdlQuery('DROP DATABASE d'), /only accepts table-level statements/);
assert.throws(() => validateDdlQuery('CREATE DATABASE d'), /only accepts table-level statements/);
assert.throws(() => validateDdlQuery('CREATE INDEX idx ON t (id)'), /only accepts table-level statements/);
assert.throws(() => validateDdlQuery('CREATE VIEW v AS SELECT 1'), /only accepts table-level statements/);

// Server version gating for read-only transactions (MySQL >= 5.6.5)
assert.deepEqual(parseServerVersion('5.6.5'), { major: 5, minor: 6, patch: 5, raw: '5.6.5' });
assert.deepEqual(parseServerVersion('5.7.44-log'), { major: 5, minor: 7, patch: 44, raw: '5.7.44-log' });
assert.equal(parseServerVersion('not-a-version'), null);
assert.equal(parseServerVersion(undefined), null);

assert.equal(supportsReadOnlyTransactions(parseServerVersion('5.6.4')), false);
assert.equal(supportsReadOnlyTransactions(parseServerVersion('5.6.5')), true);
assert.equal(supportsReadOnlyTransactions(parseServerVersion('5.5.62')), false);
assert.equal(supportsReadOnlyTransactions(parseServerVersion('5.7.44-log')), true);
assert.equal(supportsReadOnlyTransactions(parseServerVersion('8.0.46')), true);
assert.equal(supportsReadOnlyTransactions(parseServerVersion('not-a-version')), false);

// Table charset parsed out of SHOW CREATE TABLE output
assert.equal(
  tableCharsetFromCreateStatement("CREATE TABLE `t` (`id` int(11) NOT NULL) ENGINE=MyISAM DEFAULT CHARSET=cp1251"),
  'cp1251'
);
assert.equal(
  tableCharsetFromCreateStatement("CREATE TABLE `t` (`id` int(11) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"),
  'utf8mb4'
);
assert.equal(tableCharsetFromCreateStatement('CREATE VIEW `v` AS SELECT 1'), null);
assert.equal(tableCharsetFromCreateStatement(null), null);
assert.equal(tableCharsetFromCreateStatement(undefined), null);

console.log('Static smoke test passed.');
