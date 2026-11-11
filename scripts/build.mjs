import { cp, mkdir, rm, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { publicFiles } from './public-files.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, '_site');

// Validate before replacing the snapshot. Never regenerate the editable HTML.
for (const file of publicFiles) await stat(path.join(root, file));
await rm(output, { recursive: true, force: true });
for (const file of publicFiles) {
  await mkdir(path.dirname(path.join(output, file)), { recursive: true });
  await cp(path.join(root, file), path.join(output, file));
}
console.log('Copied the current public files to _site/. Your HTML edits are preserved.');
