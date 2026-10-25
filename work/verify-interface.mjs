import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { normalizeSkyQuery, tonightValue } from '../outputs/interface-utils.js';

assert.equal(normalizeSkyQuery(' ｵﾘｵﾝ座 '), normalizeSkyQuery('おりおん'));
assert.equal(normalizeSkyQuery(' ＳＩＲＩＵＳ '), normalizeSkyQuery('Sirius'));
assert.equal(normalizeSkyQuery('コル・カロリ'), normalizeSkyQuery('こる かろり'));
assert.equal(tonightValue(new Date('2026-10-25T18:30:00Z'), 9), '2026-10-26T21:00:00');
assert.equal(tonightValue(new Date('2026-01-01T03:00:00Z'), -8), '2025-12-31T21:00:00');
assert.equal(tonightValue(new Date('2026-10-25T20:00:00Z'), 5.75), '2026-10-26T21:00:00');
assert.equal(tonightValue(new Date('2026-10-25T23:30:00Z'), 0), '2026-10-25T21:00:00');

// Moving controls between sections must preserve the controls used by the sky engines.
const html = readFileSync('outputs/index.html', 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
assert.equal(ids.length, new Set(ids).size, 'Every control must have a unique ID');
for (const file of readdirSync('outputs').filter(name => name.endsWith('.js'))) {
  for (const match of readFileSync(`outputs/${file}`, 'utf8').matchAll(/\$\(['"]([^'"]+)['"]\)/g)) {
    assert.ok(ids.includes(match[1]), `${file} requires #${match[1]}`);
  }
}
console.log('Search normalization, observing-time date boundaries, and UI control integrity: PASS');
