/** Fails the build when the shipped JS or CSS exceeds its gzip budget, or dist/ nears the static-asset file cap. */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = new URL('../dist/', import.meta.url).pathname, BUDGET = { js: 90 * 1024, css: 25 * 1024 }, MAX_FILES = 19_000;
const walk = (d: string): string[] => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = walk(DIST), size = (ext: string) => files.filter(f => f.startsWith(join(DIST, 'assets')) && f.endsWith(ext)).reduce((n, f) => n + gzipSync(readFileSync(f)).length, 0);
const js = size('.js'), css = size('.css'), kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;
console.log(`bundle: JS ${kb(js)} gzip (budget ${kb(BUDGET.js)}), CSS ${kb(css)} gzip (budget ${kb(BUDGET.css)}), ${files.length} files`);
const fail = [js > BUDGET.js && 'JS over budget', css > BUDGET.css && 'CSS over budget', files.length > MAX_FILES && `dist has ${files.length} files`].filter(Boolean);
if (fail.length) { console.error(fail.join('; ')); process.exit(1); }
