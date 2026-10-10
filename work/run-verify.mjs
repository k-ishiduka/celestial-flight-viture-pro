// 全 verify-*.mjs を順に実行し、失敗があれば非ゼロで終了する。
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = dirname(here);
const scripts = readdirSync(here)
  .filter(f => /^verify-.*\.mjs$/.test(f))
  .sort();
const failed = [];

for (const script of scripts) {
  const result = spawnSync(process.execPath, [join('work', script)], { cwd: root, encoding: 'utf8' });
  const ok = result.status === 0;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${script}`);
  if (!ok) {
    failed.push(script);
    console.log(
      (result.stdout + result.stderr)
        .trim()
        .split('\n')
        .map(l => '      ' + l)
        .join('\n'),
    );
  }
}

console.log(`\n${scripts.length - failed.length}/${scripts.length} passed`);
process.exit(failed.length ? 1 : 0);
