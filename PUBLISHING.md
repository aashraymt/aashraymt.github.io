# Publishing guide

This is your guide to how the site gets built and how you publish to it.

## How the site is built

The site is an Astro static site hosted on GitHub Pages. Content comes from two places:

1. **Repo-owned pages.** Markdown files in `src/content/docs/` that you edit and commit. Experience, projects, existing writeups, notes, and certifications live here.
2. **Notion posts.** Rows in one Notion database called "Site Posts". Only rows with Status set to Published are pulled in.

Every build runs these steps on GitHub, in this order:

1. `scripts/sync-notion.mjs` copies Published rows into `src/content/docs/` as Markdown and downloads their images into `public/notion/`.
2. `scripts/check-content.mjs` scans every Markdown file for private or sensitive content. If it finds anything, the build stops and the live site stays as it was.
3. Astro builds the pages and Pagefind builds the search index.
4. GitHub Pages deploys the result.

The synced Notion files are never committed to the repo. They exist only inside the build. Notion stays the single source for those posts, and unpublishing there is enough to remove a page.

A build starts when you push to `main`, once a day on a schedule, and whenever you press "Run workflow".

## One-time setup

### 1. Create the Site Posts database

In Notion, create a new full-page database named **Site Posts** with exactly these properties. Names and options are case sensitive.

| Property | Type | Options or notes |
|---|---|---|
| Title | Title | The default title column. You can leave it named "Name". |
| Status | Select | `Draft`, `Published`. Use a plain Select, not Notion's built-in Status type. |
| Section | Select | `Post`, `Writeup`, `Note`, `Project` |
| Category | Select | `Web & API Security`, `Active Directory`, `AI / LLM Security`, `Detection Engineering`, `Binary & Firmware` |
| Slug | Text | Optional. The last part of the URL. Left empty, it is made from the title. |
| Summary | Text | One sentence for cards, the feed, and search results. |
| Tags | Multi-select | Short tags. They are lowercased on the site. |
| Date | Date | The publish date shown on the page. |

Where a row ends up:

| Section | URL |
|---|---|
| Post | `/posts/<slug>/` |
| Note | `/notes/<slug>/` |
| Project | `/projects/<slug>/` |
| Writeup | `/writeups/<category folder>/<slug>/` |

Category only matters for writeups. A writeup with no Category, or one that is not in the list above, goes to `/posts/`.

### 2. Create the Notion integration

1. Go to `https://www.notion.so/profile/integrations` and create a new integration.
2. Type: **Internal**. Name it something like "Site sync".
3. Capabilities: tick **Read content** only. Leave update content, insert content, comments, and user information off.
4. Copy the integration secret. Treat it like a password. It goes into GitHub in step 4 and nowhere else.

### 3. Share only the Site Posts database with it

Open the Site Posts database, open the `...` menu, choose **Connections**, and add your integration.

Do this on the Site Posts database only. Do not add the integration to your workspace root, a parent page, or any other page. The integration can read everything under whatever you share with it, so keep Site Posts as a top-level page that has nothing private inside it.

### 4. Add the three repository secrets

In the GitHub repo: **Settings, Secrets and variables, Actions, New repository secret**.

| Secret | Value |
|---|---|
| `NOTION_TOKEN` | The integration secret from step 2. |
| `NOTION_DATABASE_ID` | The 32 character id in the database URL, between the last `/` and `?v=`. |
| `CONTENT_BLOCKLIST` | Comma separated terms that must never appear on the site, such as organization names. Example shape: `Name One,Name Two,codename`. |

The blocklist lives in a secret so the list of private names never sits in the public repo.

### 5. Turn on GitHub Pages

**Settings, Pages, Build and deployment, Source: GitHub Actions.**

The site is configured for `https://aashraymt.github.io/`, so the repo must be named `aashraymt.github.io`.

### 6. Commit a lockfile

The workflow uses `npm ci`, which needs `package-lock.json`. Install Node 20 or newer, run `npm install` once in this folder, and commit the `package-lock.json` it creates.

## The publishing routine

1. Add a row to Site Posts and write the post in the page body. Do not repeat the title as a heading at the top.
2. Set Section, and Category if it is a writeup.
3. Fill in Summary, Tags, and Date.
4. Read it once more against the "never" list below.
5. Set Status to **Published**.
6. Wait for the daily run, or go to **Actions, Build and deploy site, Run workflow** to publish now.

Editing a published post works the same way: change it in Notion and wait for the next run.

Writing tips that keep the build green:

- Use Notion's code block for commands and output, and pick the language.
- Callout blocks become the site's callout boxes. A red callout is "danger", yellow or orange is "warning", green is "success", anything else is "info".
- Images are copied into the site at build time, so pasted screenshots work. Check every screenshot for names, hostnames, and addresses before you publish.
- Do not type em dashes or en dashes. The check rejects them.

## How to unpublish

Set Status back to `Draft` (or delete the row), then run the workflow or wait for the daily run. The page and its images are gone after that deploy. Search engines and web archives may keep a copy for longer, so unpublishing is not a way to take back a leak.

## What the safety check blocks

`scripts/check-content.mjs` fails the build when any Markdown file contains:

- A public IPv4 address. Private ranges (10.x, 127.x, 172.16 to 172.31, 192.168.x) and the documentation ranges (192.0.2.x, 198.51.100.x, 203.0.113.x) are allowed.
- In Notion posts only: any IPv4 address at all outside a code block.
- An email address, except `@example.com`, `@example.org`, and addresses ending in `.htb`.
- A North American phone number.
- A hex string of 32 or more characters that is not part of a URL. This catches hashes, keys, and tokens.
- AWS access key ids, private key headers (`-----BEGIN`), Slack tokens, and GitHub tokens.
- Leftovers: `TODO(`, `{%`, and `file:///`.
- An em dash or en dash.
- Any term from your blocklist.

### Reading a failed run

Open **Actions**, click the failed run, open the **build** job, and expand "Check content and build". You will see lines like this:

```text
src/content/docs/posts/my-post.md:42  email address
```

That is the file, the line number, and the rule. The matching text is not printed on purpose, because the log is public.

For a Notion post, the file path tells you which post it is; fix the text in Notion and run the workflow again. To see the exact line, run the sync and the check locally (see below). For a repo-owned page, fix the file and push.

If you have reviewed a line and it is safe, add `<!-- check:allow -->` to the end of that line. Use it rarely. It does not work well inside code blocks, because the marker would show up in the code.

If "Sync published posts from Notion" is the step that failed, the integration could not read the database or a page failed to convert. Check that the database is still shared with the integration and that both Notion secrets are correct.

GitHub pauses scheduled workflows after 60 days with no commits. If the daily run stops, press "Run workflow" once or push any commit.

## What must never go in Site Posts

The check is a backstop, not a reviewer. These never go in, even as a draft:

- Anything about a real organization's vulnerabilities, including the name of any organization you reported a finding to.
- Employer internals: detections, rule logic, tooling details, hostnames, screenshots, ticket contents, colleague names.
- Flags, answers, or full solutions for active Hack The Box content. Retired content only.
- Credentials of any kind: passwords, API keys, tokens, private keys, session cookies. This includes ones in screenshots.
- Your phone number, email address, home address, or visa details.

Keep Site Posts for finished public writing only. Private notes belong in a different Notion page that the integration cannot see.

## Running the site locally

You need Node 20 or newer.

```bash
npm install
npm run dev
```

Open the address that Astro prints. Without Notion variables set, the site shows repo-owned pages only.

Useful extras:

```bash
npm run check:content   # run the safety check
npm run build           # safety check, then the full build into dist/
npm run preview         # serve the built site
```

To use your private blocklist locally, copy `scripts/blocklist.example.txt` to `scripts/blocklist.private.txt` and put your real terms in it. That file is git-ignored.

To preview Notion posts locally, set `NOTION_TOKEN` and `NOTION_DATABASE_ID` in your terminal session and run `npm run sync:notion`. Do not commit the files it creates: anything with `source: notion` in its frontmatter, and the `public/notion/` folder. Run `git status` before you commit.

## Editing the repo-owned pages

- Pages are Markdown files in `src/content/docs/`. The path is the URL: `src/content/docs/projects/evo-fuzz.md` is served at `/projects/evo-fuzz/`. A folder's `index.md` is the folder's own page.
- Each file starts with frontmatter: `title`, `description`, `kind`, optional `category`, `tags`, optional `date`, `order`, and `status`. Leave `source` out or set it to `repo`. The sync never touches a file unless it says `source: notion`.
- Do not repeat the title as a heading. Body headings start at `##`.
- Sidebar order and grouping are in `src/data/nav.ts`. New pages that are not listed there are added under their section automatically.
- The landing page is `src/pages/index.astro`.
- `SPEC.md` has the full conventions for callouts, cards, links, and voice.
- Commit and push to `main`. The push starts a build and the change is live in a few minutes.
