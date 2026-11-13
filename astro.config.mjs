import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import expressiveCode from 'astro-expressive-code';

// Change `site` if you move to a custom domain.
export default defineConfig({
  site: 'https://aashraymt.github.io',
  trailingSlash: 'always',
  integrations: [
    expressiveCode({
      themes: ['github-dark-default', 'github-light-default'],
      themeCssSelector: (theme) => `[data-theme='${theme.type}']`,
      styleOverrides: { borderRadius: '6px', codeFontFamily: "'JetBrains Mono Variable', ui-monospace, monospace" },
    }),
    sitemap(),
  ],
});
