// Safety check for everything a visitor can read. Scans every .md file under
// src/content/docs and exits 1 if a line looks like private or sensitive data.
// No dependencies. Runs first in `npm run build`, so a failure blocks the deploy.
//
// Output is `file:line  rule` only. The matching text is never printed, because
// the build log of a public repository is public too.
//
// To accept one line on purpose, put <!-- check:allow --> on that line.
// Private terms (organization names and so on) come from
// scripts/blocklist.private.txt and/or the CONTENT_BLOCKLIST environment variable.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DOCS = join(ROOT, 'src', 'content', 'docs');
const BLOCKLIST_FILE = join(ROOT, 'scripts', 'blocklist.private.txt');
const ALLOW_MARKER = '<!-- check:allow -->';

// ---------- blocklist ----------

const blocklist = [
  ...(existsSync(BLOCKLIST_FILE) ? readFileSync(BLOCKLIST_FILE, 'utf8').split(/\r?\n/) : []).filter(
    (line) => !line.trim().startsWith('#'),
  ),
  ...(process.env.CONTENT_BLOCKLIST ?? '').split(','),
]
  .map((term) => term.trim().toLowerCase())
  .filter(Boolean);

const hasBlockedTerm = (text) => blocklist.some((term) => text.toLowerCase().includes(term));

// ---------- IPv4 helpers ----------

// Four dotted numbers that are not part of a longer dotted or word-like token.
const IPV4 = /(?<![\w.])\d{1,3}(?:\.\d{1,3}){3}(?!\w|\.\d)/g;

// Four-part software version numbers that look like addresses. Each one was
// reviewed by hand; add a new one here only after checking it is a version.
const REVIEWED_VERSIONS = new Set(['6.3.0.1', '6.3.0.2']); // Apache Struts2 releases

const ipv4s = (line) =>
  [...line.matchAll(IPV4)]
    .filter((m) => !REVIEWED_VERSIONS.has(m[0]))
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
  return line.slice(start, end === -1 ? line.length : end).includes('://');
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
  ['blocklisted term', (line) => hasBlockedTerm(line)],
];

// ---------- scan ----------

function checkFile(file) {
  const text = readFileSync(file, 'utf8');
  const name = relative(ROOT, file).replaceAll('\\', '/');
  const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const notion = !!frontmatter && /^source:\s*["']?notion["']?\s*$/m.test(frontmatter[1]);
  const problems = [];
  if (hasBlockedTerm(name)) problems.push(`${name}:1  blocklisted term in the file path`);

  let fence = null; // the marker that opened the current code fence, if any
  text.split(/\r?\n/).forEach((line, index) => {
    const marker = line.match(/^\s*(`{3,}|~{3,})/)?.[1];
    const inFence = fence !== null;
    if (inFence) {
      if (marker && marker[0] === fence[0] && marker.length >= fence.length) fence = null;
    } else if (marker) {
      fence = marker;
    }
    if (line.includes(ALLOW_MARKER)) return;
    for (const [label, test] of RULES) {
      if (test(line, { notion, inFence })) problems.push(`${name}:${index + 1}  ${label}`);
    }
  });
  return problems;
}

const files = existsSync(DOCS)
  ? readdirSync(DOCS, { recursive: true })
      .filter((name) => name.endsWith('.md'))
      .map((name) => join(DOCS, name))
      .sort()
  : [];
const problems = files.flatMap(checkFile);

if (problems.length === 0) {
  console.log(`Content check passed: ${files.length} files, ${blocklist.length} blocklist terms.`);
} else {
  console.error(problems.join('\n'));
  console.error(
    `\nContent check failed: ${problems.length} problem(s). Fix each line, ` +
      `or add ${ALLOW_MARKER} to a line you have reviewed and want to keep.`,
  );
  process.exit(1);
}
