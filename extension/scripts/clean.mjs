import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');

await rm(resolve(projectRoot, 'dist'), { recursive: true, force: true });
await rm(resolve(projectRoot, 'dist.crx'), { force: true });
await rm(resolve(projectRoot, 'dist.pem'), { force: true });

for (const name of [
  'shentu-navigator.zip',
  'shentu-navigator.crx',
  'campus-apply-agent.zip',
  'campus-apply-agent.crx',
]) {
  await rm(resolve(projectRoot, 'release', name), { force: true });
}

console.log('Cleaned dist and packaged release outputs. Existing .pem keys were kept.');
