// RSS feed: writeups, notes, projects, and posts that have a date, newest first.
import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { site } from '../data/site';
import { entryHref, feedEntries } from '../data/content';

export async function GET(context) {
  const entries = feedEntries(await getCollection('docs')).filter((entry) => entry.data.date);
  return rss({
    title: site.title,
    description: site.description,
    site: context.site,
    items: entries.map((entry) => ({
      title: entry.data.title,
      description: entry.data.description ?? '',
      pubDate: entry.data.date,
      link: entryHref(entry.id),
      categories: entry.data.tags,
    })),
  });
}
