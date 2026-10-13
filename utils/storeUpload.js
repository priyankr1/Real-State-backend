import fs from 'fs/promises';
import path from 'path';

/**
 * Persists a multer temp file on disk and returns the public URL.
 * On cPanel, UPLOAD_DIR is public_html/uploads so File Manager and the site
 * share one folder. UPLOAD_PUBLIC_URL is the prefix stored in the database.
 */

const safeFolder = (folder) => {
  const cleaned = String(folder || 'misc')
    .split(/[\\/]+/)
    .filter((part) => part && part !== '.' && part !== '..' && /^[a-z0-9_-]+$/i.test(part))
    .join('/');
  if (!cleaned) throw new Error('Invalid upload folder');
  return cleaned;
};

export const uploadRoot = () =>
  process.env.UPLOAD_DIR ? path.resolve(process.env.UPLOAD_DIR) : path.resolve('uploads');

export const publicUploadBase = () => {
  const configured = process.env.UPLOAD_PUBLIC_URL;
  if (configured) return configured.replace(/\/+$/, '');
  const port = process.env.PORT || 4000;
  return `http://localhost:${port}/uploads`;
};

const imageSize = (buf) => {
  if (buf.length >= 24 && buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf.length >= 10 && (buf.toString('ascii', 0, 6) === 'GIF87a' || buf.toString('ascii', 0, 6) === 'GIF89a')) {
    return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  }
  if (buf.length >= 30 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const format = buf.toString('ascii', 12, 16);
    if (format === 'VP8X') {
      return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    }
    if (format === 'VP8 ' && buf.length >= 30) {
      return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    }
    if (format === 'VP8L' && buf.length >= 25) {
      const bits = buf.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
  }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buf.length) {
      if (buf[offset] !== 0xff) break;
      const marker = buf[offset + 1];
      if (marker === 0xd8 || marker === 0xd9) {
        offset += 2;
        continue;
      }
      const size = buf.readUInt16BE(offset + 2);
      if (size < 2 || offset + 2 + size > buf.length) break;
      if (marker >= 0xc0 && marker <= 0xc3) {
        return { width: buf.readUInt16BE(offset + 7), height: buf.readUInt16BE(offset + 5) };
      }
      offset += 2 + size;
    }
  }
  return { width: 0, height: 0 };
};

const moveFile = async (from, to) => {
  try {
    await fs.rename(from, to);
  } catch (error) {
    if (error.code !== 'EXDEV') throw error;
    await fs.copyFile(from, to);
    await fs.unlink(from);
  }
};

export async function storeUploadedFile(file, folder) {
  const group = safeFolder(folder);
  const filename = path.basename(file.filename || file.path);
  if (!/^[a-z0-9]+\.[a-z0-9]+$/i.test(filename)) throw new Error('Invalid upload filename');

  const destDir = path.join(uploadRoot(), ...group.split('/'));
  await fs.mkdir(destDir, { recursive: true });
  const dest = path.join(destDir, filename);
  await moveFile(file.path, dest);

  const { width, height } = imageSize(await fs.readFile(dest));
  return { url: `${publicUploadBase()}/${group}/${filename}`, width, height };
}
