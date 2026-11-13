import { defaultSchema } from 'rehype-sanitize';
import sanitize from 'rehype-sanitize';
import { visit } from 'unist-util-visit';

const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    div: [['className', 'callout', 'info', 'warning', 'danger', 'success']],
  },
  protocols: { href: ['https', 'mailto'], src: [] },
  strip: ['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'template'],
};

export function sanitizeNotion() {
  return (tree, file) => {
    if (file.data.astro?.frontmatter?.source !== 'notion') return;
    visit(tree, 'element', (node) => {
      if (node.tagName === 'img' && !/^\/notion\/[a-z0-9/_-]+\.png$/.test(node.properties.src ?? '')) {
        delete node.properties.src;
      }
    });
    return sanitize(schema)(tree);
  };
}
