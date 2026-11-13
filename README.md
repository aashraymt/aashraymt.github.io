# aashraymt.github.io

This is the source for my security portfolio and knowledge base: projects, writeups, notes, and posts.

**Stack:** Astro 5 (static output), Expressive Code for code blocks, Pagefind for search, GitHub Actions and GitHub Pages for hosting.

**Where content lives:**

- `src/content/docs/` holds the pages I keep in this repo as Markdown. The file path is the URL.
- Posts I write in Notion are pulled in at build time by `scripts/sync-notion.mjs`. They are not committed here.
- `scripts/check-content.mjs` runs before every build and blocks anything that looks private or sensitive.

**Run it locally:** `npm install`, then `npm run dev`.

How I publish, unpublish, and read a failed build is in [PUBLISHING.md](PUBLISHING.md).
