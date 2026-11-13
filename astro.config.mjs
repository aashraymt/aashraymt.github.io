import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import expressiveCode from 'astro-expressive-code';
import { unified } from '@astrojs/markdown-remark';
import rehypeRaw from 'rehype-raw';
import { sanitizeNotion } from './scripts/sanitize-notion.mjs';

// Change `site` if you move to a custom domain.
export default defineConfig({
  site: 'https://aashraymt.github.io',
  trailingSlash: 'always',
  compressHTML: true,
  vite: { build: { assetsInlineLimit: 0 } },
  markdown: { processor: unified({ rehypePlugins: [rehypeRaw, sanitizeNotion] }) },
  integrations: [
    expressiveCode({
      themes: ['github-dark-default', 'github-light-default'],
      themeCssSelector: (theme) => `[data-theme='${theme.type}']`,
      styleOverrides: { borderRadius: '6px', codeFontFamily: "'JetBrains Mono Variable', ui-monospace, monospace" },
    }),
    sitemap(),
  ],
});
