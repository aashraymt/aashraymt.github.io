import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'parse5';

const dist = new URL('../dist/', import.meta.url);
const hash = (text) => `'sha256-${createHash('sha256').update(text).digest('base64')}'`;

function collect(node, html, scripts, styles) {
  const location = node.sourceCodeLocation;
  if (location?.startTag && location.endTag) {
    const body = html.slice(location.startTag.endOffset, location.endTag.startOffset).replace(/\r\n?/g, '\n');
    if (node.tagName === 'script' && !node.attrs.some(({ name }) => name === 'src')) scripts.add(hash(body));
    if (node.tagName === 'style') styles.add(hash(body));
  }
  for (const child of node.childNodes ?? []) collect(child, html, scripts, styles);
}

for (const entry of readdirSync(dist, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith('.html')) continue;
  const path = join(entry.parentPath, entry.name);
  const html = readFileSync(path, 'utf8');
  const document = parse(html, { sourceCodeLocationInfo: true });
  const head = document.childNodes.find((node) => node.tagName === 'html').childNodes.find((node) => node.tagName === 'head');
  const charset = head.childNodes.find((node) => node.tagName === 'meta' && node.attrs.some(({ name }) => name === 'charset'));
  const offset = charset?.sourceCodeLocation.endOffset ?? head.sourceCodeLocation.startTag.endOffset;
  const scripts = new Set();
  const styles = new Set();
  collect(document, html, scripts, styles);
  const policy = [
    "default-src 'self'", "base-uri 'none'", "object-src 'none'", "frame-src 'none'", "form-action 'none'",
    "img-src 'self' data:", "font-src 'self'", "connect-src 'self'", "worker-src 'self'",
    `script-src 'self' 'wasm-unsafe-eval' ${[...scripts].join(' ')}`.trim(),
    `style-src 'self' ${[...styles].join(' ')}`.trim(), "style-src-attr 'unsafe-inline'",
  ].join('; ');
  const meta = `<meta http-equiv="Content-Security-Policy" content="${policy}"><meta name="referrer" content="no-referrer">`;
  writeFileSync(path, html.slice(0, offset) + meta + html.slice(offset));
}
