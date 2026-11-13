import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

// One collection for every page. The folder path is the URL.
// `kind` controls the layout extras and whether the page shows in the feed.
const docs = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/docs' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    kind: z.enum(['page', 'index', 'project', 'writeup', 'note', 'post']).default('page'),
    category: z.string().optional(),       // e.g. "Web & API Security"
    tags: z.array(z.string()).default([]),
    date: z.coerce.date().optional(),      // shown and used for feed sorting when present
    order: z.number().default(100),        // order inside its sidebar group
    status: z.enum(['published', 'in-progress']).default('published'),
    source: z.enum(['repo', 'notion']).default('repo'),
  }),
});

export const collections = { docs };
