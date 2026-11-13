// Sidebar tree. Order and grouping follow ../gitbook-drafts/SUMMARY.md, with the new routes from SPEC.md.
// Pages that exist in the collection but are not listed here are appended under their section by buildNav().
import { entryHref, entryPath, isRoutable, type DocEntry } from './content';

export interface NavNode {
  label: string;
  href?: string;
  children?: NavNode[];
}

const top10 = '/notes/api-security/owasp-api-top-10/';

export const nav: NavNode[] = [
  {
    label: 'Experience',
    href: '/experience/',
    children: [
      { label: 'Vertiv: IT Security Intern', href: '/experience/vertiv/' },
      { label: 'IDamta: Cybersecurity Intern', href: '/experience/idamta/' },
      { label: 'Eminence Ways: Application Security Intern', href: '/experience/eminence-ways/' },
    ],
  },
  {
    label: 'Projects',
    href: '/projects/',
    children: [
      { label: 'Vuln-Firmware Lab', href: '/projects/vuln-firmware-lab/' },
      { label: 'Evo-Fuzz', href: '/projects/evo-fuzz/' },
      { label: 'RiskRank', href: '/projects/riskrank/' },
      { label: 'Red Team Simulation Lab', href: '/projects/red-team-simulation-lab/' },
      { label: 'Multi-Cloud Detection Lab', href: '/projects/multi-cloud-detection-lab/' },
      { label: 'Azure Sentinel Honeypot Lab', href: '/projects/azure-sentinel-honeypot-lab/' },
      { label: 'Active Directory Home Lab', href: '/projects/active-directory-home-lab/' },
      { label: 'PEAS-Hunter', href: '/projects/peas-hunter/' },
      {
        label: 'ML for Security',
        href: '/projects/ml-for-security/',
        children: [
          { label: 'Network Anomaly Detection', href: '/projects/ml-for-security/network-anomaly-detection/' },
          { label: 'SMS Spam Detector', href: '/projects/ml-for-security/sms-spam-detector/' },
          { label: 'Malware Classification', href: '/projects/ml-for-security/malware-classification/' },
        ],
      },
    ],
  },
  {
    label: 'Certifications & CTFs',
    href: '/certifications/',
    children: [
      { label: 'HackTheBox', href: '/certifications/hackthebox/' },
      { label: 'CTF Competitions', href: '/certifications/ctf-competitions/' },
    ],
  },
  {
    label: 'Writeups',
    href: '/writeups/',
    children: [
      {
        label: 'Web & API Security',
        href: '/writeups/web-and-api-security/',
        children: [
          { label: 'HTB Strutted', href: '/writeups/web-and-api-security/htb-strutted/' },
          { label: 'HTB MonitorsFour', href: '/writeups/web-and-api-security/htb-monitorsfour/' },
          { label: 'HTB Cap', href: '/writeups/web-and-api-security/htb-cap/' },
        ],
      },
      {
        label: 'Active Directory',
        href: '/writeups/active-directory/',
        children: [
          { label: 'HTB EscapeTwo', href: '/writeups/active-directory/htb-escapetwo/' },
          { label: 'Forest compromise lab', href: '/writeups/active-directory/forest-compromise-lab/' },
        ],
      },
      {
        label: 'AI / LLM Security',
        href: '/writeups/ai-llm-security/',
        children: [
          { label: 'When the LLM is the filter', href: '/writeups/ai-llm-security/llm-output-attacks/' },
          { label: 'Indirect prompt injection labs', href: '/writeups/ai-llm-security/indirect-prompt-injection/' },
          { label: 'LLM API to OS command injection', href: '/writeups/ai-llm-security/llm-api-command-injection/' },
          { label: 'HTB Artificial', href: '/writeups/ai-llm-security/htb-artificial/' },
        ],
      },
      {
        label: 'Detection Engineering',
        href: '/writeups/detection-engineering/',
        children: [
          {
            label: 'Building a multi-cloud log pipeline',
            href: '/writeups/detection-engineering/multi-cloud-log-pipeline/',
          },
        ],
      },
      {
        label: 'Binary & Firmware',
        href: '/writeups/binary-and-firmware/',
        children: [
          {
            label: 'libFuzzer vs AFL++ on the same parser',
            href: '/writeups/binary-and-firmware/fuzzing-uart-parser/',
          },
          { label: 'AFL++ first steps', href: '/writeups/binary-and-firmware/afl-first-steps/' },
        ],
      },
    ],
  },
  {
    label: 'Research & Notes',
    href: '/notes/',
    children: [
      {
        label: 'API Security',
        href: '/notes/api-security/',
        children: [
          { label: 'API Authentication', href: '/notes/api-security/api-authentication/' },
          {
            label: 'OWASP API Security Top 10',
            href: top10,
            children: [
              { label: 'API2:2023 Broken Authentication', href: `${top10}api2-broken-authentication/` },
              {
                label: 'API3:2023 Broken Object Property Level Authorization',
                href: `${top10}api3-broken-object-property-level-authorization/`,
              },
              {
                label: 'API4:2023 Unrestricted Resource Consumption',
                href: `${top10}api4-unrestricted-resource-consumption/`,
              },
              {
                label: 'API5:2023 Broken Function Level Authorization',
                href: `${top10}api5-broken-function-level-authorization/`,
              },
              {
                label: 'API6:2023 Unrestricted Access to Sensitive Business Flows',
                href: `${top10}api6-unrestricted-access-to-sensitive-business-flows/`,
              },
              { label: 'API7:2023 Server Side Request Forgery', href: `${top10}api7-server-side-request-forgery/` },
              { label: 'API8:2023 Security Misconfiguration', href: `${top10}api8-security-misconfiguration/` },
              {
                label: 'API9:2023 Improper Inventory Management',
                href: `${top10}api9-improper-inventory-management/`,
              },
              { label: 'API10:2023 Unsafe Consumption of APIs', href: `${top10}api10-unsafe-consumption-of-apis/` },
            ],
          },
        ],
      },
      { label: 'LLM guardrails compared', href: '/notes/llm-guardrails-compared/' },
      { label: 'Model extraction basics', href: '/notes/model-extraction-basics/' },
      { label: 'AI security notes', href: '/notes/ai-security-notes/' },
      { label: 'Kerberos and Active Directory reference', href: '/notes/kerberos-and-ad-reference/' },
      { label: 'Regex reference', href: '/notes/regex-reference/' },
    ],
  },
  { label: 'Posts', href: '/posts/' },
  { label: 'Contact', href: '/contact/' },
];

// Listed hrefs that are pages in src/pages, not collection entries.
const STATIC_HREFS = new Set(['/posts/']);

/** The minimum buildNav() needs from a collection entry. */
type NavEntry = { id: string; data: Pick<DocEntry['data'], 'title' | 'order' | 'status'> };

function clone(nodes: NavNode[]): NavNode[] {
  return nodes.map((n) => ({ ...n, children: n.children ? clone(n.children) : undefined }));
}

function collectHrefs(nodes: NavNode[], into: Set<string>): Set<string> {
  for (const node of nodes) {
    if (node.href) into.add(node.href);
    if (node.children) collectHrefs(node.children, into);
  }
  return into;
}

/** Drop listed links whose page does not exist, so the sidebar never links to a 404. */
function prune(nodes: NavNode[], existing: Set<string>): NavNode[] {
  const kept: NavNode[] = [];
  for (const node of nodes) {
    const children = node.children ? prune(node.children, existing) : [];
    const exists = !node.href || existing.has(node.href) || STATIC_HREFS.has(node.href);
    if (!exists && children.length === 0) continue;
    kept.push({
      label: node.label,
      href: exists ? node.href : undefined,
      children: children.length ? children : undefined,
    });
  }
  return kept;
}

/** Deepest listed node whose URL is a parent of `href`. */
function findParent(nodes: NavNode[], href: string): NavNode | undefined {
  for (const node of nodes) {
    if (node.href && node.href !== '/' && href !== node.href && href.startsWith(node.href)) {
      return (node.children && findParent(node.children, href)) || node;
    }
    const deeper = node.children && findParent(node.children, href);
    if (deeper) return deeper;
  }
  return undefined;
}

function titleCase(segment: string): string {
  return segment
    .split('-')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Final sidebar tree: the listed tree, minus links to pages that do not exist,
 * plus every unlisted collection page appended under its section (by order, then title).
 */
export function buildNav(entries: NavEntry[]): NavNode[] {
  const routable = entries.filter(isRoutable);
  const existing = new Set(routable.map((e) => entryHref(e.id)));
  const listed = collectHrefs(nav, new Set<string>());
  const tree = prune(clone(nav), existing);

  const unlisted = routable
    .filter((e) => !listed.has(entryHref(e.id)))
    .sort((a, b) => a.data.order - b.data.order || a.data.title.localeCompare(b.data.title));

  for (const entry of unlisted) {
    const href = entryHref(entry.id);
    const item: NavNode = { label: entry.data.title, href };
    let parent = findParent(tree, href);
    if (!parent) {
      // A section that nav.ts does not know about: give it its own group.
      const section = entryPath(entry.id).split('/')[0];
      const sectionHref = `/${section}/`;
      if (href === sectionHref) {
        tree.push(item);
        continue;
      }
      parent = tree.find((n) => n.href === sectionHref || (!n.href && n.label === titleCase(section)));
      if (!parent) {
        parent = { label: titleCase(section), children: [] };
        tree.push(parent);
      }
    }
    (parent.children ??= []).push(item);
  }
  return tree;
}

/** Every linked node in sidebar order. Used for previous and next links. */
export function flattenNav(nodes: NavNode[]): { label: string; href: string }[] {
  const flat: { label: string; href: string }[] = [];
  for (const node of nodes) {
    if (node.href) flat.push({ label: node.label, href: node.href });
    if (node.children) flat.push(...flattenNav(node.children));
  }
  return flat;
}

/** True when `node` is, or contains, the page at `href`. */
export function containsHref(node: NavNode, href: string): boolean {
  if (node.href === href) return true;
  return !!node.children?.some((child) => containsHref(child, href));
}
