import { run } from 'node:test';
import { spec } from 'node:test/reporters';
import fs from 'node:fs';
import path from 'node:path';

const testDir = path.resolve('lib/test');
const files = fs.readdirSync(testDir)
  .filter(f => f.endsWith('.test.js'))
  .map(f => path.join(testDir, f));

const stream = run({ files });
stream.on('test:fail', () => {
  process.exitCode = 1;
});
stream.compose(new spec()).pipe(process.stdout);
