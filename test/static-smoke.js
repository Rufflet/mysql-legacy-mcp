import assert from 'node:assert/strict';
import {
  limitSelectRows,
  qualifiedTable,
  quoteIdentifier,
  schemaQueries,
  validateSelectQuery
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

console.log('Static smoke test passed.');
