// Site-wide constants. Facts about the person come from ../gitbook-drafts/README.md only.

export const site = {
  title: 'Aashray Tuladhar',
  handle: 'aashray@uc',
  tagline: 'Detection engineering and offensive security',
  headline:
    'Detection engineering and offensive security. B.S. Cybersecurity, University of Cincinnati, class of 2027.',
  status:
    'Open to full-time roles starting Summer 2027: detection and SecOps engineering, red team and offensive security, application security, AI security.',
  description:
    'Security portfolio and notes by Aashray Tuladhar: detection engineering, offensive security, application security, and AI security. Open to full-time roles starting Summer 2027.',
  // Assumed from the GitHub Pages URL in SPEC.md. Change it if the repository has another name.
  repo: 'https://github.com/aashraymt/aashraymt.github.io',
};

export interface ProfileLink {
  key: string;
  label: string;
  note: string;
  href: string;
}

export const profileLinks: ProfileLink[] = [
  {
    key: 'linkedin',
    label: 'LinkedIn',
    note: 'Best way to reach me',
    href: 'https://www.linkedin.com/in/aashray-tuladhar/',
  },
  { key: 'github', label: 'GitHub', note: 'Project code', href: 'https://github.com/aashraymt' },
  {
    key: 'hackthebox',
    label: 'Hack The Box',
    note: 'Hacker rank, 14 machines rooted',
    href: 'https://app.hackthebox.com/profile/1772828',
  },
];

export interface PrimaryLink {
  label: string;
  href: string;
}

// Header links, written as paths.
export const primaryNav: PrimaryLink[] = [
  { label: './projects', href: '/projects/' },
  { label: './writeups', href: '/writeups/' },
  { label: './notes', href: '/notes/' },
  { label: './experience', href: '/experience/' },
  { label: './certs', href: '/certifications/' },
  { label: './contact', href: '/contact/' },
];
