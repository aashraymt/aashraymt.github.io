import { lookup } from 'node:dns';
import { get } from 'node:https';
import { BlockList } from 'node:net';
import sharp from 'sharp';

const MAX_BYTES = 12 * 1024 * 1024;
const MAX_PIXELS = 20_000_000;
const MAX_SIDE = 8_192;
const BUCKETS = ['secure.notion-static.com', 'prod-files-secure'];
const S3_HOST = 's3.us-west-2.amazonaws.com';
const NON_PUBLIC_ADDRESSES = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 3],
]) {
  NON_PUBLIC_ADDRESSES.addSubnet(address, prefix);
}

export function isNotionImageUrl(url) {
  const { protocol, username, password, port, hostname, pathname } = url;
  if (protocol !== 'https:' || username || password || port) return false;
  if (hostname === 'secure.notion-static.com') return true;
  return BUCKETS.some((bucket) => (
    (hostname === S3_HOST && pathname.startsWith(`/${bucket}/`)) ||
    hostname === `${bucket}.${S3_HOST}` || hostname === `${bucket}.s3.amazonaws.com`
  ));
}

function download(url) {
  return new Promise((resolve, reject) => {
    const request = get(url, {
      // Resolve and validate the address in the same operation used to connect.
      // These asset origins support IPv4, so IPv6 special-use ranges are excluded.
      family: 4,
      signal: AbortSignal.timeout(30_000),
      lookup(hostname, options, callback) {
        lookup(hostname, { family: 4 }, (error, address, family) => {
          if (error || NON_PUBLIC_ADDRESSES.check(address)) {
            callback(error ?? new Error('Image host resolved to a restricted address'));
          } else {
            callback(null, address, family);
          }
        });
      },
    }, async (response) => {
      // HTTPS get does not follow redirects. Request a new Notion URL if it expires.
      if (response.statusCode !== 200 || Number(response.headers['content-length']) > MAX_BYTES) {
        response.destroy();
        reject(new Error('Image response rejected'));
        return;
      }
      try {
        const chunks = [];
        let size = 0;
        for await (const chunk of response) {
          size += chunk.length;
          if (size > MAX_BYTES) throw new Error('Image exceeds the download limit');
          chunks.push(chunk);
        }
        resolve(Buffer.concat(chunks, size));
      } catch (error) {
        reject(error);
      }
    });
    request.on('error', reject);
  });
}

export async function normalizeNotionImage(bytes) {
  const isPng = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isJpeg = bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]));
  const isGif = ['GIF87a', 'GIF89a'].includes(bytes.toString('ascii', 0, 6));
  const isWebp = bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!(isPng || isJpeg || isGif || isWebp)) throw new Error('Unsupported raster format');

  const image = sharp(bytes, { limitInputPixels: MAX_PIXELS });
  const { width, height, format } = await image.metadata();
  if (!['png', 'jpeg', 'gif', 'webp'].includes(format) || !width || !height || width > MAX_SIDE || height > MAX_SIDE) {
    throw new Error('Unsupported raster format or dimensions');
  }

  // PNG output strips source metadata and keeps only the first frame of animations.
  const png = await image.rotate().png().toBuffer();
  if (png.length > MAX_BYTES) throw new Error('Image exceeds the output limit');
  return png;
}

export async function downloadNotionImage(image) {
  if (image.type !== 'file' || !image.file?.url) throw new Error('Upload the image to Notion');
  const url = new URL(image.file.url);
  if (!isNotionImageUrl(url)) throw new Error('Image source rejected');
  return normalizeNotionImage(await download(url));
}
