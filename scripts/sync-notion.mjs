// Pulls Published rows from the "Site Posts" Notion database into
// src/content/docs/ as Markdown files with `source: notion` frontmatter.
//
// Usage: NOTION_TOKEN=... NOTION_DATABASE_ID=... node scripts/sync-notion.mjs
//
// Safety rules this script keeps:
//   - It only writes, overwrites, or deletes files whose frontmatter says
//     `source: notion`. Repo-owned pages are never touched.
//   - A synced file whose row is no longer Published is deleted.
//   - Reviewed images are staged and copied into a stable per-page directory.

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const { NOTION_TOKEN, NOTION_DATABASE_ID } = process.env;
if (!NOTION_TOKEN || !NOTION_DATABASE_ID) {
  console.log('Notion sync skipped: NOTION_TOKEN or NOTION_DATABASE_ID is not set.');
  process.exit(0);
}

// Imported after the check above so a build without Notion never needs these.
const { Client } = await import('@notionhq/client');
const { NotionToMarkdown } = await import('notion-to-md');
const { downloadNotionImage } = await import('./notion-images.mjs');

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DOCS = join(ROOT, 'src', 'content', 'docs');
const IMAGES = join(ROOT, 'public', 'notion');
const STAGING = join(ROOT, '.astro');

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

const notion = new Client({ auth: NOTION_TOKEN, logger: () => {} });
const PRIVATE_BLOCKS = new Set(['synced_block', 'child_page', 'child_database', 'link_to_page', 'audio', 'video', 'file', 'pdf']);
const n2m = new NotionToMarkdown({
  notionClient: {
    blocks: {
      children: {
        async list(args) {
          // Filter before the converter can follow synced blocks or emit signed attachment URLs.
          const response = await notion.blocks.children.list(args);
          return { ...response, results: response.results.filter((block) => !PRIVATE_BLOCKS.has(block.type)) };
        },
      },
    },
  },
});
let currentPage; // Rows are converted sequentially and images are staged per row.

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

const shortDigest = (data) => createHash('sha256').update(data).digest('hex').slice(0, 24);

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
  if (!currentPage.imagesReviewed) {
    console.warn(`  image rejected for row ${currentPage.id}: Images Reviewed is unchecked or missing`);
    throw new Error('Image review is required');
  }
  try {
    const png = await downloadNotionImage(block.image);
    const name = `${shortDigest(png)}.png`;
    await writeFile(join(currentPage.stage, name), png);
    currentPage.images.add(name);
    const alt = plain(block.image.caption).replace(/[\\[\]]/g, '\\$&').replace(/[\r\n]+/g, ' ');
    return `![${alt}](/notion/${currentPage.id}/${name})`;
  } catch {
    console.warn(`  image rejected for row ${currentPage.id}: download or normalization failed`);
    throw new Error('Image import failed');
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
  const sectionName = props.Section?.select?.name;
  const section = Object.hasOwn(SECTIONS, sectionName) ? SECTIONS[sectionName] : SECTIONS.Post;
  const category = props.Category?.select?.name;
  const categoryKey = category?.toLowerCase();
  const writeupFolder = Object.hasOwn(WRITEUP_FOLDERS, categoryKey) ? WRITEUP_FOLDERS[categoryKey] : undefined;
  return {
    title,
    // slugify also strips slashes and dots, so a slug can never escape its folder.
    slug: slugify(plain(props.Slug?.rich_text) || title).slice(0, 160) || shortDigest(page.id),
    kind: section.kind,
    folder: section.kind === 'writeup' && writeupFolder ? `writeups/${writeupFolder}` : section.folder,
    category,
    tags: (props.Tags?.multi_select ?? []).map((tag) => tag.name.trim().toLowerCase()),
    summary: plain(props.Summary?.rich_text),
    date: props.Date?.date?.start?.slice(0, 10),
    imagesReviewed: props['Images Reviewed']?.checkbox === true,
  };
}

// JSON strings are valid YAML double-quoted strings, so JSON.stringify does the escaping.
function frontmatter(row) {
  const lines = [`title: ${JSON.stringify(row.title)}`];
  if (row.summary) lines.push(`description: ${JSON.stringify(row.summary)}`);
  lines.push(`kind: ${row.kind}`);
  if (row.category) lines.push(`category: ${JSON.stringify(row.category)}`);
  lines.push(`tags: [${row.tags.map((tag) => JSON.stringify(tag)).join(', ')}]`);
  if (row.date && /^\d{4}-\d{2}-\d{2}$/.test(row.date)) lines.push(`date: ${row.date}`);
  lines.push('status: published', 'source: notion');
  return `---\n${lines.join('\n')}\n---\n`;
}

// ---------- main ----------

const counts = { created: 0, updated: 0, unchanged: 0, removed: 0, skipped: 0, failed: 0 };
const keptFiles = new Set(); // synced files that belong to a Published row
const keptImages = new Map();

async function syncRows() {
  for (const page of await queryPublished()) {
    const id = shortDigest(page.id);
    let stage;
    try {
      const row = readRow(page);
      const file = join(DOCS, row.folder, `${row.slug}.md`);
      const previous = existsSync(file) ? await readFile(file, 'utf8') : null;
      if (keptFiles.has(file) || (previous !== null && !isNotionFile(previous))) {
        console.warn(`  skipped row ${id}: destination already claimed`);
        counts.skipped++;
        continue;
      }
      keptFiles.add(file);

      await mkdir(STAGING, { recursive: true });
      stage = await mkdtemp(join(STAGING, 'notion-sync-'));
      currentPage = { id, stage, imagesReviewed: row.imagesReviewed, images: new Set() };
      const body = fixHeadings(toMarkdown(await n2m.pageToMarkdown(page.id)), row.title);
      const next = `${frontmatter(row)}\n${body}\n`;

      // Content-addressed names let us stage new images without removing the old
      // files referenced by the current Markdown. Replace that Markdown last.
      const imageFolder = join(IMAGES, id);
      if (currentPage.images.size) await mkdir(imageFolder, { recursive: true });
      for (const name of currentPage.images) {
        await rename(join(stage, name), join(imageFolder, name));
      }
      if (next === previous) {
        counts.unchanged++;
      } else {
        const stagedFile = join(stage, 'page.md');
        await writeFile(stagedFile, next, 'utf8');
        await mkdir(dirname(file), { recursive: true });
        await rename(stagedFile, file);
        counts[previous === null ? 'created' : 'updated']++;
      }
      keptImages.set(id, currentPage.images);
    } catch {
      console.warn(`  failed row ${id}: conversion or staging failed`);
      counts.failed++;
    } finally {
      if (stage) await rm(stage, { recursive: true, force: true });
    }
  }
}

// Unpublish: delete synced files (and image folders) that no Published row claims.
async function removeUnpublished() {
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
    for (const id of await readdir(IMAGES)) {
      const folder = join(IMAGES, id);
      const images = keptImages.get(id);
      if (!images?.size) {
        await rm(folder, { recursive: true, force: true });
        continue;
      }
      for (const name of await readdir(folder)) {
        if (!images.has(name)) await rm(join(folder, name), { recursive: true, force: true });
      }
    }
  }
}

try {
  await syncRows();
  if (counts.failed === 0) await removeUnpublished();
} catch {
  console.error('Notion sync failed while listing rows or cleaning up generated content.');
  counts.failed++;
}

console.log(
  `Notion sync: ${counts.created} created, ${counts.updated} updated, ${counts.unchanged} unchanged, ` +
    `${counts.removed} removed, ${counts.skipped} skipped, ${counts.failed} failed.`,
);
// A page that failed to convert must not silently vanish from the site, so
// fail the run and let the last good deploy stay live.
if (counts.failed > 0) process.exitCode = 1;
