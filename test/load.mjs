// Bundle one src module with esbuild (as the build does) so a test can import its plain exports in Node.
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SDK = { name: 'sdk', setup(b) { b.onResolve({ filter: /^@muclient\/sdk$/ }, () => ({ path: 'sdk', namespace: 'sdk' })); b.onLoad({ filter: /.*/, namespace: 'sdk' }, () => ({ contents: 'export const defineExtension = (d) => d;', loader: 'js' })); } };
let n = 0;
export async function load(rel) {
  const r = await build({ entryPoints: [join(ROOT, rel)], bundle: true, format: 'esm', platform: 'neutral', write: false, logLevel: 'silent', plugins: [SDK] });
  const dir = join(ROOT, 'node_modules', '.cache', 'ext-test');
  mkdirSync(dir, { recursive: true });
  const out = join(dir, `${rel.replace(/\W+/g, '_')}-${process.pid}-${++n}.mjs`);
  writeFileSync(out, r.outputFiles[0].contents);
  return import(pathToFileURL(out).href);
}
