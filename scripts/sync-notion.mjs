// Pulls Published rows from the "Site Posts" Notion database into
// src/content/docs/ as Markdown files with `source: notion` frontmatter.
//
// Usage: NOTION_TOKEN=... NOTION_DATABASE_ID=... node scripts/sync-notion.mjs
//
// Safety rules this script keeps:
//   - It only writes, overwrites, or deletes files whose frontmatter says
//     `source: notion`. Repo-owned pages are never touched.
//   - A synced file whose row is no longer Published is deleted.
//   - Images are copied into public/notion/<slug>/ because Notion file URLs expire.

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const { NOTION_TOKEN, NOTION_DATABASE_ID } = process.env;
if (!NOTION_TOKEN || !NOTION_DATABASE_ID) {
  console.log('Notion sync skipped: NOTION_TOKEN or NOTION_DATABASE_ID is not set.');
  process.exit(0);
}

// Imported after the check above so a build without Notion never needs these.
const { Client } = await import('@notionhq/client');
const { NotionToMarkdown } = await import('notion-to-md');

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DOCS = join(ROOT, 'src', 'content', 'docs');
const IMAGES = join(ROOT, 'public', 'notion');

// Section select option -> frontmatter kind and content folder.
const SECTIONS = {
  Post: { kind: 'post', folder: 'posts' },
  Note: { kind: 'note', folder: 'notes' },
  Project: { kind: 'project', folder: 'projects' },
  Writeup: { kind: 'writeup', folder: 'posts' }, // real folder comes from Category
};

// Category select option (lowercased) -> existing folder under writeups/.
const WRITEUP_FOLDERS = {
  'web & api security': 'web-and-api-security',
  'active directory': 'active-directory',
  'ai & llm security': 'ai-llm-security',
  'ai / llm security': 'ai-llm-security',
  'detection engineering': 'detection-engineering',
  'binary & firmware': 'binary-and-firmware',
};

// Notion callout color prefix -> SPEC callout variant. Anything else is "info".
const CALLOUT_VARIANTS = { red: 'danger', pink: 'danger', yellow: 'warning', orange: 'warning', green: 'success' };

const IMAGE_EXTENSIONS = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/avif': '.avif',
  'image/svg+xml': '.svg',
};

const notion = new Client({ auth: NOTION_TOKEN });
const n2m = new NotionToMarkdown({ notionClient: notion });
let currentSlug = ''; // slug of the page being converted; used by the image transformer

// ---------- small helpers ----------

const plain = (richText = []) => richText.map((t) => t.plain_text).join('').trim();

const slugify = (text) =>
  text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const isNotionFile = (text) => {
  const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return !!frontmatter && /^source:\s*["']?notion["']?\s*$/m.test(frontmatter[1]);
};

const show = (file) => relative(ROOT, file).replaceAll('\\', '/');

// Runs fn on every line that is not inside a fenced code block.
function mapOutsideFences(markdown, fn) {
  let fence = null;
  return markdown
    .split('\n')
    .map((line) => {
      const marker = line.match(/^\s*(`{3,}|~{3,})/)?.[1];
      if (fence) {
        if (marker && marker[0] === fence[0] && marker.length >= fence.length) fence = null;
        return line;
      }
      if (marker) {
        fence = marker;
        return line;
      }
      return fn(line);
    })
    .join('\n');
}

// Drops a leading H1 that repeats the title, then shifts every heading by the
// same amount so the shallowest one is `##` (the layout renders the title).
function fixHeadings(markdown, title) {
  const first = markdown.match(/^# +(.+)\n?/);
  if (first && first[1].trim().toLowerCase() === title.toLowerCase()) {
    markdown = markdown.slice(first[0].length).trimStart();
  }
  let shallowest = 7;
  mapOutsideFences(markdown, (line) => {
    const hashes = line.match(/^(#{1,6}) /)?.[1];
    if (hashes) shallowest = Math.min(shallowest, hashes.length);
    return line;
  });
  if (shallowest === 7 || shallowest === 2) return markdown;
  const shift = 2 - shallowest;
  return mapOutsideFences(markdown, (line) =>
    line.replace(/^(#{1,6}) /, (_, hashes) => '#'.repeat(Math.min(6, hashes.length + shift)) + ' '),
  );
}

// ---------- Notion blocks -> Markdown ----------

// Callout transformers below render their own children, so drop any copies the
// library attached, whichever way its version behaves.
function dropCalloutChildren(blocks) {
  for (const block of blocks) {
    if (block.type === 'callout') block.children = [];
    else dropCalloutChildren(block.children ?? []);
  }
  return blocks;
}

function toMarkdown(mdBlocks) {
  const out = n2m.toMarkdownString(dropCalloutChildren(mdBlocks));
  return (typeof out === 'string' ? out : out.parent ?? '').trim(); // v3.0 returned a string
}

n2m.setCustomTransformer('callout', async (block) => {
  const { rich_text, color = '' } = block.callout;
  const variant = Object.entries(CALLOUT_VARIANTS).find(([prefix]) => color.startsWith(prefix))?.[1] ?? 'info';
  // Render the callout text as a paragraph so links and inline code survive.
  const text = await n2m.blockToMarkdown({ ...block, type: 'paragraph', paragraph: { rich_text } });
  const children = block.has_children ? toMarkdown(await n2m.pageToMarkdown(block.id)) : '';
  const body = [text.trim(), children].filter(Boolean).join('\n\n');
  return `<div class="callout ${variant}">\n\n${body}\n\n</div>`;
});

n2m.setCustomTransformer('image', async (block) => {
  const image = block.image;
  const url = image[image.type]?.url;
  const alt = plain(image.caption).replace(/[[\]]/g, '');
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const type = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    const extension = IMAGE_EXTENSIONS[type];
    if (!extension) throw new Error(`unsupported content type "${type}"`);
    // Stable name: same block always gives the same file, so URLs do not churn.
    const name = createHash('sha1').update(block.id).digest('hex').slice(0, 16) + extension;
    const folder = join(IMAGES, currentSlug);
    await mkdir(folder, { recursive: true });
    await writeFile(join(folder, name), Buffer.from(await response.arrayBuffer()));
    return `![${alt}](/notion/${currentSlug}/${name})`;
  } catch (error) {
    console.warn(`  warning: image skipped in "${currentSlug}" (${error.message})`);
    return '<!-- image skipped: download failed -->';
  }
});

// ---------- Notion rows ----------

async function queryPublished() {
  const pages = [];
  let cursor;
  do {
    const response = await notion.databases.query({
      database_id: NOTION_DATABASE_ID,
      filter: { property: 'Status', select: { equals: 'Published' } },
      start_cursor: cursor,
      page_size: 100,
    });
    pages.push(...response.results);
    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);
  return pages;
}

function readRow(page) {
  const props = page.properties;
  // The title column is found by type, so it works whether it is named Title or Name.
  const title = plain(Object.values(props).find((p) => p.type === 'title')?.title) || 'Untitled';
  const section = SECTIONS[props.Section?.select?.name] ?? SECTIONS.Post;
  const category = props.Category?.select?.name;
  const writeupFolder = WRITEUP_FOLDERS[category?.toLowerCase()];
  return {
    title,
    // slugify also strips slashes and dots, so a slug can never escape its folder.
    slug: slugify(plain(props.Slug?.rich_text) || title) || page.id.replaceAll('-', ''),
    kind: section.kind,
    folder: section.kind === 'writeup' && writeupFolder ? `writeups/${writeupFolder}` : section.folder,
    category,
    tags: (props.Tags?.multi_select ?? []).map((tag) => tag.name.trim().toLowerCase()),
    summary: plain(props.Summary?.rich_text),
    date: props.Date?.date?.start?.slice(0, 10),
  };
}

// JSON strings are valid YAML double-quoted strings, so JSON.stringify does the escaping.
function frontmatter(row) {
  const lines = [`title: ${JSON.stringify(row.title)}`];
  if (row.summary) lines.push(`description: ${JSON.stringify(row.summary)}`);
  lines.push(`kind: ${row.kind}`);
  if (row.category) lines.push(`category: ${JSON.stringify(row.category)}`);
  lines.push(`tags: [${row.tags.map((tag) => JSON.stringify(tag)).join(', ')}]`);
  if (row.date) lines.push(`date: ${row.date}`);
  lines.push('status: published', 'source: notion');
  return `---\n${lines.join('\n')}\n---\n`;
}

// ---------- main ----------

const counts = { created: 0, updated: 0, unchanged: 0, removed: 0, skipped: 0, failed: 0 };
const keptFiles = new Set(); // synced files that belong to a Published row
const keptSlugs = new Set();

for (const page of await queryPublished()) {
  const row = readRow(page);
  const file = join(DOCS, row.folder, `${row.slug}.md`);

  if (keptFiles.has(file)) {
    console.warn(`  skipped: "${row.title}" has the same slug as another row (${show(file)})`);
    counts.skipped++;
    continue;
  }
  const previous = existsSync(file) ? await readFile(file, 'utf8') : null;
  if (previous !== null && !isNotionFile(previous)) {
    console.warn(`  skipped: "${row.title}" would overwrite a repo-owned page (${show(file)})`);
    counts.skipped++;
    continue;
  }
  keptFiles.add(file);
  keptSlugs.add(row.slug);

  try {
    currentSlug = row.slug;
    await rm(join(IMAGES, row.slug), { recursive: true, force: true });
    const body = fixHeadings(toMarkdown(await n2m.pageToMarkdown(page.id)), row.title);
    const next = `${frontmatter(row)}\n${body}\n`;
    if (next === previous) {
      counts.unchanged++;
    } else {
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, next, 'utf8');
      counts[previous === null ? 'created' : 'updated']++;
    }
  } catch (error) {
    console.warn(`  failed: "${row.title}" (${error.message})`);
    counts.failed++;
  }
}

// Unpublish: delete synced files (and image folders) that no Published row claims.
if (existsSync(DOCS)) {
  for (const name of await readdir(DOCS, { recursive: true })) {
    const file = join(DOCS, name);
    if (!name.endsWith('.md') || keptFiles.has(file)) continue;
    if (isNotionFile(await readFile(file, 'utf8'))) {
      await rm(file);
      counts.removed++;
    }
  }
}
if (existsSync(IMAGES)) {
  for (const slug of await readdir(IMAGES)) {
    if (!keptSlugs.has(slug)) await rm(join(IMAGES, slug), { recursive: true, force: true });
  }
}

console.log(
  `Notion sync: ${counts.created} created, ${counts.updated} updated, ${counts.unchanged} unchanged, ` +
    `${counts.removed} removed, ${counts.skipped} skipped, ${counts.failed} failed.`,
);
// A page that failed to convert must not silently vanish from the site, so
// fail the run and let the last good deploy stay live.
if (counts.failed > 0) process.exitCode = 1;
