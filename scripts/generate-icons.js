import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createPNG(width, height, drawPixel) {
  const rowSize = width * 4 + 1;
  const rawData = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = drawPixel(x, y, width, height);
      const pixelOffset = rowOffset + 1 + x * 4;
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(rawData);

  function crc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc = crc ^ buf[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function makeChunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(4 + 4 + len + 4);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4, 4, 'ascii');
    data.copy(buf, 8);
    const crcVal = crc32(buf.subarray(4, 8 + len));
    buf.writeUInt32BE(crcVal, 8 + len);
    return buf;
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth: 8
  ihdr[9] = 6; // Color type: RGBA
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace

  return Buffer.concat([
    sig,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0))
  ]);
}

function urutauPixel(x, y, w, h, isMaskable = false) {
  const cx = w / 2;
  const cy = h / 2;
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const maxR = w * 0.45;

  let r = 11, g = 15, b = 18, a = 255;

  if (!isMaskable && dist > maxR) {
    return [0, 0, 0, 0]; // Transparent padding
  }

  if (dist < maxR && dist > maxR * 0.7) {
    const angle = Math.atan2(dy, dx);
    const feather = Math.sin(angle * 12 + dist * 0.2);
    if (feather > 0.4) {
      r = 25; g = 32; b = 38;
    }
  }

  const eyeR = w * 0.26;
  if (dist < eyeR * 1.5 && dist >= eyeR) {
    const factor = (eyeR * 1.5 - dist) / (eyeR * 0.5);
    r = Math.min(255, Math.round(r + 217 * 0.4 * factor));
    g = Math.min(255, Math.round(g + 119 * 0.4 * factor));
    b = Math.min(255, Math.round(b + 6 * 0.4 * factor));
  }

  if (dist < eyeR) {
    const irisDist = dist / eyeR;
    r = Math.round(245 - irisDist * 30);
    g = Math.round(158 - irisDist * 40);
    b = Math.round(11 + irisDist * 10);

    if (dist > eyeR * 0.92) {
      r = 180; g = 83; b = 9;
    }

    const pupilX = Math.abs(dx) / (w * 0.05);
    const pupilY = Math.abs(dy) / (h * 0.20);
    if (pupilX * pupilX + pupilY * pupilY < 1.0) {
      r = 5; g = 7; b = 9; // Black pupil
    }

    const specDx = x - (cx - w * 0.08);
    const specDy = y - (cy - h * 0.08);
    if (specDx * specDx + specDy * specDy < (w * 0.035) * (w * 0.035)) {
      r = 255; g = 255; b = 255;
    }
  }

  return [r, g, b, a];
}

const outDir = path.resolve('./public/icons');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

fs.writeFileSync(path.join(outDir, 'icon-180x180.png'), createPNG(180, 180, (x, y, w, h) => urutauPixel(x, y, w, h, true)));
fs.writeFileSync(path.join(outDir, 'icon-192x192.png'), createPNG(192, 192, (x, y, w, h) => urutauPixel(x, y, w, h, false)));
fs.writeFileSync(path.join(outDir, 'icon-512x512.png'), createPNG(512, 512, (x, y, w, h) => urutauPixel(x, y, w, h, false)));
fs.writeFileSync(path.join(outDir, 'icon-512x512-maskable.png'), createPNG(512, 512, (x, y, w, h) => urutauPixel(x, y, w, h, true)));

console.log('✅ Todos os ícones PNG PWA gerados com sucesso em public/icons/');
