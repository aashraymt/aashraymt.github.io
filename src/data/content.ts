// Small helpers shared by pages and layouts: entry id -> URL, feed sorting, tags.
import type { CollectionEntry } from 'astro:content';

export type DocEntry = CollectionEntry<'docs'>;

// Paths owned by files in src/pages. A collection entry at one of these is not routed.
export const RESERVED_PATHS = new Set(['', 'posts', 'tags', '404']);

export const FEED_KINDS = ['writeup', 'note', 'project', 'post'];

/** "writeups/active-directory/index" -> "writeups/active-directory"; "index" -> "". */
export function entryPath(id: string): string {
  return id
    .replace(/\\/g, '/')
    .replace(/\.md$/, '')
    .replace(/(^|\/)index$/, '')
    .replace(/^\/+|\/+$/g, '');
}

/** Site URL of an entry, always with a trailing slash. */
export function entryHref(id: string): string {
  const path = entryPath(id);
  return path ? `/${path}/` : '/';
}

export function isRoutable(entry: { id: string }): boolean {
  return !RESERVED_PATHS.has(entryPath(entry.id));
}

/** Dated entries first, newest first. Undated entries follow, by order and then title. */
export function sortFeed<T extends DocEntry>(entries: T[]): T[] {
  return [...entries].sort((a, b) => {
    const da = a.data.date?.getTime();
    const db = b.data.date?.getTime();
    if (da !== undefined && db !== undefined && da !== db) return db - da;
    if (da !== undefined && db === undefined) return -1;
    if (da === undefined && db !== undefined) return 1;
    if (a.data.order !== b.data.order) return a.data.order - b.data.order;
    return a.data.title.localeCompare(b.data.title);
  });
}

/** Writeups, notes, projects, and posts, in feed order. */
export function feedEntries(entries: DocEntry[]): DocEntry[] {
  return sortFeed(entries.filter((e) => isRoutable(e) && FEED_KINDS.includes(e.data.kind)));
}

/** Frontmatter dates are parsed as UTC, so the ISO date is the date the author wrote. */
export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function tagSlug(tag: string): string {
  return tag
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function tagHref(tag: string): string {
  return `/tags/${tagSlug(tag)}/`;
}

export interface TagGroup {
  slug: string;
  label: string;
  entries: DocEntry[];
}

/** Every tag used by a routable entry, sorted by name. */
export function tagGroups(entries: DocEntry[]): TagGroup[] {
  const groups = new Map<string, TagGroup>();
  for (const entry of entries) {
    if (!isRoutable(entry)) continue;
    for (const tag of entry.data.tags) {
      const slug = tagSlug(tag);
      if (!slug) continue;
      const group = groups.get(slug) ?? { slug, label: tag.toLowerCase().trim(), entries: [] };
      if (!group.entries.includes(entry)) group.entries.push(entry);
      groups.set(slug, group);
    }
  }
  return [...groups.values()]
    .map((g) => ({ ...g, entries: sortFeed(g.entries) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
