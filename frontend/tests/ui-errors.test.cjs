const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');
const test = require('node:test');
function load(relative) {
  const filename = path.resolve(__dirname, '..', relative);
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = module.paths;
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS }
  }).outputText, filename);
  return mod.exports;
}
const { validatePhoto, MAX_PHOTO_BYTES } = load('src/lib/photos.ts');
const { extractErrorMessage } = load('src/lib/utils.ts');
test('photos reject empty, oversized and unsupported files', () => {
  assert.ok(validatePhoto({ size: 0, type: 'image/jpeg' }));
  assert.ok(validatePhoto({ size: MAX_PHOTO_BYTES + 1, type: 'image/jpeg' }));
  assert.ok(validatePhoto({ size: 100, type: 'image/svg+xml' }));
  for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
    assert.equal(validatePhoto({ size: MAX_PHOTO_BYTES, type }), null);
  }
});
test('network and timeout errors give actionable guidance', () => {
  assert.match(extractErrorMessage({ code: 'ERR_NETWORK' }), /connection/);
  assert.match(extractErrorMessage({ code: 'ECONNABORTED' }), /whether it completed/);
  assert.match(extractErrorMessage({ response: { status: 429 } }), /wait/);
});
test('server errors do not expose internal details', () => {
  assert.equal(extractErrorMessage({ response: { status: 500, data: { detail: 'database credentials' } } }, 'Try again'), 'Try again');
  assert.equal(extractErrorMessage({ response: { data: { detail: { secret: 'internal' } } } }, 'Try again'), 'Try again');
});
test('validation errors preserve useful field guidance and tolerate malformed items', () => {
  assert.equal(extractErrorMessage({ response: { status: 422, data: { detail: [null, {loc:['body','email'],msg:'Invalid email'}] } } }), 'email: Invalid email');
  assert.equal(extractErrorMessage(null, 'Fallback'), 'Fallback');
  assert.equal(extractErrorMessage({ response: { status: 400, data: { detail: 'Photo too small' } } }), 'Photo too small');
});
