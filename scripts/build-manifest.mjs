// Indexes larp-stuff/ into larp-stuff/manifest.json so the site can list it.
// Runs in the Pages workflow on every push; run it by hand with `node scripts/build-manifest.mjs`.
import { execFileSync } from 'node:child_process';
import { openSync, readSync, closeSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = 'larp-stuff';
const MEDIA = /\.(jpe?g|png|webp|gif|avif|mp4|webm|mov|m4v)$/i;

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith('.')) return [];
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : MEDIA.test(entry.name) ? [path] : [];
  });
}

// Pixel size for PNG, GIF, JPEG and WebP, so tiles keep their shape while loading.
function dimensions(path) {
  const buf = Buffer.alloc(256 * 1024);
  const fd = openSync(path, 'r');
  const length = readSync(fd, buf, 0, buf.length, 0);
  closeSync(fd);
  const b = buf.subarray(0, length);
  const tag = (at, size) => b.toString('latin1', at, at + size);
  try {
    if (tag(1, 3) === 'PNG') return [b.readUInt32BE(16), b.readUInt32BE(20)];
    if (tag(0, 3) === 'GIF') return [b.readUInt16LE(6), b.readUInt16LE(8)];
    if (tag(0, 4) === 'RIFF' && tag(8, 4) === 'WEBP') {
      if (tag(12, 4) === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
      if (tag(12, 4) === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
      if (tag(12, 4) === 'VP8L') {
        const bits = b.readUInt32LE(21);
        return [1 + (bits & 0x3fff), 1 + ((bits >> 14) & 0x3fff)];
      }
    }
    if (b[0] === 0xff && b[1] === 0xd8) {
      for (let at = 2; at < b.length - 9; ) {
        if (b[at] !== 0xff) break;
        const marker = b[at + 1];
        const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
        if (isFrame) return [b.readUInt16BE(at + 7), b.readUInt16BE(at + 5)];
        at += 2 + b.readUInt16BE(at + 2);
      }
    }
  } catch {}
  return [0, 0];
}

// When the file was first committed, so the feed can sort it; falls back to its modified time.
function addedAt(path) {
  try {
    const out = execFileSync('git', ['log', '--diff-filter=A', '--follow', '--format=%at', '--', path], { encoding: 'utf8' }).trim();
    const first = out.split('\n').pop();
    if (first) return Number(first) * 1000;
  } catch {}
  return Math.round(statSync(path).mtimeMs);
}

const items = walk(ROOT).map((path) => {
  const [width, height] = dimensions(path);
  return { file: relative(ROOT, path).split(sep).join('/'), size: statSync(path).size, width, height, added: addedAt(path) };
});
items.sort((a, b) => b.added - a.added || a.file.localeCompare(b.file));
writeFileSync(join(ROOT, 'manifest.json'), `${JSON.stringify({ items }, null, 2)}\n`);
console.log(`larp-stuff: indexed ${items.length} file(s)`);
