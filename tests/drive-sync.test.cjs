const assert = require('node:assert/strict');
const { decodeRemote, envelope, validStore } = require('../dist/google-drive-sync.js');

const store = { current: '2026-10', months: { '2026-10': { allowance: 1000, categories: [], expenses: [] } } };
assert.equal(validStore(store), true);
assert.deepEqual(decodeRemote(JSON.stringify(envelope(store, '2026-10-12T00:00:00.000Z'))), { data: store, updatedAt: '2026-10-12T00:00:00.000Z' });
assert.throws(() => decodeRemote('{"version":1,"data":{}}'), /형식/);
console.log('drive sync core checks passed');
