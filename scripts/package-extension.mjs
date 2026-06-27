import { createWriteStream } from 'node:fs';
import { copyFile, cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { deflateRaw } from 'node:zlib';
import { promisify } from 'node:util';

const projectRoot = resolve(import.meta.dirname, '..');
const distDir = resolve(projectRoot, 'dist');
const firefoxDistDir = resolve(projectRoot, 'dist-firefox');
const releaseDir = resolve(projectRoot, 'release');
const extensionName = 'resume-bridge';
const keyPath = resolve(releaseDir, `${extensionName}.pem`);
const zipPath = resolve(releaseDir, `${extensionName}.zip`);
const crxPath = resolve(releaseDir, `${extensionName}.crx`);
const firefoxZipPath = resolve(releaseDir, `${extensionName}-firefox.zip`);
const firefoxXpiPath = resolve(releaseDir, `${extensionName}-firefox.xpi`);
const deflateRawAsync = promisify(deflateRaw);
const args = new Set(process.argv.slice(2));
const createdOutputs = [];

const chromeCandidates = [
  process.env.CHROME_BIN,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
].filter(Boolean);

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(path);
    if (entry.isFile()) return [path];
    return [];
  }));
  return files.flat().sort();
}

function dosDateTime(date) {
  let year = date.getFullYear();
  if (year < 1980) year = 1980;
  const dosTime =
    (date.getHours() << 11) |
    (date.getMinutes() << 5) |
    Math.floor(date.getSeconds() / 2);
  const dosDate =
    ((year - 1980) << 9) |
    ((date.getMonth() + 1) << 5) |
    date.getDate();
  return { dosTime, dosDate };
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUInt16(value) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value);
  return buffer;
}

function writeUInt32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value);
  return buffer;
}

async function deflateBuffer(input) {
  return deflateRawAsync(input, { level: 9 });
}

async function createZip(sourceDir, targetPath) {
  const files = await listFiles(sourceDir);
  const output = createWriteStream(targetPath);
  const centralRecords = [];
  let offset = 0;

  for (const file of files) {
    const relativeName = relative(sourceDir, file).split('\\').join('/');
    const nameBuffer = Buffer.from(relativeName);
    const input = await readFile(file);
    const compressed = await deflateBuffer(input);
    const checksum = crc32(input);
    const { dosTime, dosDate } = dosDateTime((await stat(file)).mtime);
    const method = 8;

    const localHeader = Buffer.concat([
      writeUInt32(0x04034b50),
      writeUInt16(20),
      writeUInt16(0),
      writeUInt16(method),
      writeUInt16(dosTime),
      writeUInt16(dosDate),
      writeUInt32(checksum),
      writeUInt32(compressed.length),
      writeUInt32(input.length),
      writeUInt16(nameBuffer.length),
      writeUInt16(0),
      nameBuffer,
    ]);

    output.write(localHeader);
    output.write(compressed);

    centralRecords.push({
      nameBuffer,
      checksum,
      compressedSize: compressed.length,
      uncompressedSize: input.length,
      dosTime,
      dosDate,
      method,
      offset,
    });

    offset += localHeader.length + compressed.length;
  }

  let centralSize = 0;
  for (const record of centralRecords) {
    const header = Buffer.concat([
      writeUInt32(0x02014b50),
      writeUInt16(20),
      writeUInt16(20),
      writeUInt16(0),
      writeUInt16(record.method),
      writeUInt16(record.dosTime),
      writeUInt16(record.dosDate),
      writeUInt32(record.checksum),
      writeUInt32(record.compressedSize),
      writeUInt32(record.uncompressedSize),
      writeUInt16(record.nameBuffer.length),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt32(0),
      writeUInt32(record.offset),
      record.nameBuffer,
    ]);
    output.write(header);
    centralSize += header.length;
  }

  output.write(Buffer.concat([
    writeUInt32(0x06054b50),
    writeUInt16(0),
    writeUInt16(0),
    writeUInt16(centralRecords.length),
    writeUInt16(centralRecords.length),
    writeUInt32(centralSize),
    writeUInt32(offset),
    writeUInt16(0),
  ]));

  await new Promise((resolve, reject) => {
    output.end(resolve);
    output.on('error', reject);
  });
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${basename(command)} exited with code ${code}`));
    });
  });
}

async function findChrome() {
  for (const candidate of chromeCandidates) {
    if (candidate && await exists(candidate)) return candidate;
  }
  return null;
}

async function packageCrx() {
  const chrome = await findChrome();
  if (!chrome) {
    console.warn('Chrome executable not found. Zip package was created, but CRX packaging was skipped.');
    return;
  }

  const args = [`--pack-extension=${distDir}`];
  if (await exists(keyPath)) {
    args.push(`--pack-extension-key=${keyPath}`);
  }

  await run(chrome, args);

  const generatedCrx = resolve(projectRoot, 'dist.crx');
  const generatedPem = resolve(projectRoot, 'dist.pem');

  if (await exists(generatedCrx)) {
    await copyFile(generatedCrx, crxPath);
    await rm(generatedCrx, { force: true });
    createdOutputs.push(crxPath);
  }
  if (await exists(generatedPem)) {
    if (!await exists(keyPath)) {
      await mkdir(dirname(keyPath), { recursive: true });
      await copyFile(generatedPem, keyPath);
    }
    await rm(generatedPem, { force: true });
  }
}

async function packageFirefox() {
  await rm(firefoxDistDir, { recursive: true, force: true });
  await cp(distDir, firefoxDistDir, { recursive: true });

  const manifestPath = resolve(firefoxDistDir, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

  delete manifest.side_panel;
  manifest.permissions = manifest.permissions.filter((permission) => permission !== 'sidePanel');
  manifest.sidebar_action = {
    default_panel: 'pages/sidebar.html',
    default_icon: {
      16: 'icons/icon16.png',
      32: 'icons/icon32.png',
    },
    default_title: 'Resume Bridge',
  };

  manifest.background = {
    scripts: ['background.js'],
    type: 'module',
  };

  manifest.browser_specific_settings = {
    gecko: {
      id: 'resume-bridge@cloud-oc.github.io',
      data_collection_permissions: {
        required: ['none'],
      },
      strict_min_version: '109.0',
    },
    gecko_android: {
      strict_min_version: '120.0',
    },
  };

  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  await createZip(firefoxDistDir, firefoxZipPath);
  await copyFile(firefoxZipPath, firefoxXpiPath);
  createdOutputs.push(firefoxZipPath, firefoxXpiPath);
}

if (!await exists(resolve(distDir, 'manifest.json'))) {
  throw new Error('Missing dist/manifest.json. Run npm run build first.');
}

await mkdir(releaseDir, { recursive: true });
if (!args.has('--firefox-only')) {
  await createZip(distDir, zipPath);
  createdOutputs.push(zipPath);
  await packageCrx();
}
if (!args.has('--chrome-only')) {
  await packageFirefox();
}

for (const outputPath of createdOutputs) {
  console.log(`Created ${relative(projectRoot, outputPath)}`);
}
if (await exists(keyPath)) {
  console.log(`Using key ${relative(projectRoot, keyPath)}`);
}
