import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { decode } from 'he';
import { parse } from 'parse5';
import sharp from 'sharp';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DOCS = join(ROOT, 'src', 'content', 'docs');
const BLOCKLIST_FILE = join(ROOT, 'scripts', 'blocklist.private.txt');
const DIST = join(ROOT, 'dist');

function normalize(value) {
  const decoded = value.replace(/(?:%[0-9a-f]{2})+/gi, (match) => {
    try { return decodeURIComponent(match); } catch { return match; }
  });
  return decode(decoded).normalize('NFKC').replace(/\p{Cf}/gu, '').replace(/\s+/g, ' ').toLowerCase();
}

// ---------- blocklist ----------

const blocklist = [
  ...(existsSync(BLOCKLIST_FILE) ? readFileSync(BLOCKLIST_FILE, 'utf8').split(/\r?\n/) : []).filter(
    (line) => !line.trim().startsWith('#'),
  ),
  ...(process.env.CONTENT_BLOCKLIST ?? '').split(/[,\r\n]+/),
]
  .map((term) => normalize(term).trim())
  .filter(Boolean);

if (process.env.REQUIRE_CONTENT_BLOCKLIST === '1' && blocklist.length === 0) {
  console.error('Production content check requires a configured private blocklist.');
  process.exit(1);
}

const hasBlockedTerm = (text) => {
  if (!blocklist.length) return false;
  const normalized = normalize(text);
  return blocklist.some((term) => normalized.includes(term));
};

// ---------- IPv4 helpers ----------

// Four dotted numbers that are not part of a longer dotted or word-like token.
const IPV4 = /(?<![\w.])\d{1,3}(?:\.\d{1,3}){3}(?!\w|\.\d)/g;

// Four-part software version numbers that look like addresses. Each one was
// reviewed by hand; add a new one here only after checking it is a version.
const STRUTS_VERSION = /(?:<struts2\.version>|struts2\.version set to |Apache Struts2 |the advisory covers )6\.3\.0\.[12]\b/g;

const ipv4s = (line) =>
  [...line.matchAll(IPV4)]
    .map((m) => m[0].split('.').map(Number))
    .filter((octets) => octets.every((n) => n <= 255));

// 10.0.0.0/8, 127.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
const isPrivate = ([a, b]) => a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);

// Documentation ranges: 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24
const isDocumentation = ([a, b, c]) =>
  (a === 192 && b === 0 && c === 2) || (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113);

// 0.0.0.0 is the "listen on all interfaces" placeholder, not anyone's address.
const isUnspecified = (octets) => octets.every((n) => n === 0);

// ---------- other patterns ----------

const EMAIL = /[A-Za-z0-9._%+-]+@((?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,})/g;
const isAllowedEmail = (domain) => /^example\.(com|org)$/i.test(domain) || /\.htb$/i.test(domain);

// North American number with separators: 555-555-0100, (555) 555-0100, +1 555.555.0100
const PHONE = /(?<![\w.-])(?:\+?1[ .-]?)?(?:\([2-9]\d{2}\)[ .-]?|[2-9]\d{2}[ .-])[2-9]\d{2}[ .-]\d{4}(?![\w-])/;

const LONG_HEX = /(?<![0-9A-Za-z])(?:0x)?[0-9a-fA-F]{32,}(?![0-9A-Za-z])/g;

// True when the match sits inside a whitespace-delimited token that is a URL.
function insideUrl(line, match) {
  const start = line.lastIndexOf(' ', match.index) + 1;
  const end = line.indexOf(' ', match.index);
  const token = line.slice(start, end === -1 ? line.length : end);
  if (/\]\(https:\/\/catalog-education\.oracle\.com\/ords\/certview\/sharebadge\?id=[a-f0-9]+\)$/i.test(token)) return true;
  return /^\[.*\]\(https?:\/\/|^\(?https?:\/\//i.test(token) && !/[?#]/.test(token);
}

// ---------- rules ----------
// Each rule gets the line and { notion, inFence } and returns true on a problem.

const RULES = [
  ['public IPv4 address', (line) => ipv4s(line).some((ip) => !isPrivate(ip) && !isDocumentation(ip) && !isUnspecified(ip))],
  ['IPv4 address outside a code block in a Notion page', (line, at) => at.notion && !at.inFence && ipv4s(line).length > 0],
  ['email address', (line) => [...line.matchAll(EMAIL)].some((m) => !isAllowedEmail(m[1]))],
  ['phone number', (line) => PHONE.test(line)],
  ['hex string of 32 or more characters (hash, key, or token)', (line) => [...line.matchAll(LONG_HEX)].some((m) => !insideUrl(line, m))],
  ['leftover "TODO("', (line) => line.includes('TODO(')],
  ['leftover template tag "{%"', (line) => line.includes('{%')],
  ['local file path "file:///"', (line) => line.includes('file:///')],
  ['em dash or en dash', (line) => /[–—]/.test(line)],
  ['AWS access key id', (line) => /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/.test(line)],
  ['private key header', (line) => line.includes('-----BEGIN')],
  ['Slack token', (line) => /xox[bap]-/.test(line)],
  ['GitHub token', (line) => /\b(?:gh[pousr]_|github_pat_)\w/.test(line)],
];

// ---------- scan ----------

function checkFile(file) {
  const text = readFileSync(file, 'utf8');
  const name = relative(ROOT, file).replaceAll('\\', '/');
  const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const notion = !!frontmatter && /^source:\s*["']?notion["']?\s*$/m.test(frontmatter[1]);
  const problems = [];
  const locator = safePath(name, notion);
  if (hasBlockedTerm(name)) problems.push(`${locator}:1  blocklisted term in the file path`);
  if (hasBlockedTerm(text)) problems.push(`${locator}:1  blocklisted term in source`);

  let fence = null; // the marker that opened the current code fence, if any
  text.split(/\r?\n/).forEach((line, index) => {
    const marker = line.match(/^\s*(`{3,}|~{3,})/)?.[1];
    const inFence = fence !== null;
    if (inFence) {
      if (marker && marker[0] === fence[0] && marker.length >= fence.length) fence = null;
    } else if (marker) {
      fence = marker;
    }
    const checked = name === 'src/content/docs/writeups/web-and-api-security/htb-strutted.md'
      ? line.replace(STRUTS_VERSION, '') : line;
    for (const [label, test] of RULES) {
      if (test(checked, { notion, inFence })) problems.push(`${locator}:${index + 1}  ${label}`);
    }
  });
  return problems;
}

function safePath(path, forceOpaque = false) {
  if (!process.env.CI && !forceOpaque && !hasBlockedTerm(path) && /^[\w/.-]+$/.test(path)) return path;
  return `file ${createHash('sha256').update(path).digest('hex').slice(0, 12)}`;
}

function renderedText(node) {
  if (node.nodeName === '#text') return node.value;
  if (node.tagName === 'style' || node.tagName === 'script') return '';
  const block = /^(?:p|div|li|td|th|br|h[1-6]|section|main|pre|article)$/.test(node.tagName ?? '');
  const children = (node.childNodes ?? []).map(renderedText).join('');
  return block ? ` ${children} ` : children;
}

async function checkOutput(file) {
  const name = relative(ROOT, file).replaceAll('\\', '/');
  const locator = safePath(name);
  if (hasBlockedTerm(name)) return [`${locator}  blocklisted term in public path`];
  if (/\.(?:png|jpe?g|webp|gif|avif)$/i.test(name)) {
    try {
      const { exif, iptc, xmp, comments } = await sharp(file).metadata();
      const fields = [exif, iptc, xmp, ...((comments ?? []).map(({ text }) => text))];
      if (fields.some((field) => field && hasBlockedTerm(field.toString()))) {
        return [`${locator}  blocklisted term in image metadata`];
      }
      if (name.startsWith('dist/notion/') && fields.some(Boolean)) {
        return [`${locator}  unexpected metadata in imported image`];
      }
    } catch {
      return [`${locator}  unreadable public image metadata`];
    }
  } else if (/\.(?:html|xml|svg|txt|json|js|css|map|pf_fragment|pf_meta|pf_index)$/.test(name)) {
    const bytes = readFileSync(file);
    const text = (name.includes('.pf_') ? gunzipSync(bytes) : bytes).toString('utf8');
    if (hasBlockedTerm(text) || (name.endsWith('.html') && hasBlockedTerm(renderedText(parse(text))))) {
      return [`${locator}  blocklisted term in public output`];
    }
  }
  return [];
}

const output = process.argv.includes('--dist');
const directory = output ? DIST : DOCS;
const files = readdirSync(directory, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile() && (output || entry.name.endsWith('.md')))
  .map((entry) => join(entry.parentPath, entry.name)).sort();
const problems = [];
for (const file of files) problems.push(...(output ? await checkOutput(file) : checkFile(file)));

if (problems.length === 0) {
  console.log(`Content check passed: ${files.length} files, ${blocklist.length} blocklist terms.`);
} else {
  console.error(problems.join('\n'));
  console.error(`Content check failed: ${problems.length} problem(s).`);
  process.exit(1);
}
