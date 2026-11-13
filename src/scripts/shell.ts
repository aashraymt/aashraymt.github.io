// Small in-page shell for the landing terminal. It only reads the page list
// embedded at build time; nothing typed here is sent anywhere. All output is
// written with textContent, so typed text is never treated as HTML.
type ShellFile = { p: string; h: string; t: string; d: string; g: string[] };
type ShellData = { handle: string; files: ShellFile[]; links: { label: string; href: string }[] };

const dataEl = document.getElementById('term-data');
const form = document.getElementById('term-form') as HTMLFormElement | null;
const input = document.getElementById('term-input') as HTMLInputElement | null;
const log = document.getElementById('term-log');
const ps1 = document.getElementById('term-ps1');

if (dataEl && form && input && log && ps1) {
  const data = JSON.parse(dataEl.textContent || '{}') as ShellData;
  const files = data.files;
  const byPath = new Map(files.map((f) => [f.p, f]));
  const dirs = new Set<string>(['']);
  for (const f of files) {
    const parts = f.p.split('/');
    for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join('/'));
  }
  let cwd = '';
  const history: string[] = [];
  let cursor = 0;

  const promptText = () => `${data.handle}:~${cwd ? '/' + cwd : ''}$`;

  const el = (tag: string, cls: string, text = '') => {
    const node = document.createElement(tag);
    node.className = cls;
    if (text) node.textContent = text;
    return node;
  };
  const print = (text: string, cls = 'term-out') => log.append(el('p', cls, text));
  const fail = (text: string) => print(text, 'term-out term-err');
  const printLink = (label: string, href: string, note = '') => {
    const row = el('p', 'term-out term-row');
    const a = el('a', 'term-link', label) as HTMLAnchorElement;
    a.href = href;
    if (/^https?:/.test(href)) a.rel = 'noopener';
    row.append(a);
    if (note) row.append(el('span', 'term-note', note));
    log.append(row);
  };

  // Resolve what the visitor typed against the current folder.
  const resolve = (arg: string): string | null => {
    let raw = arg.trim().replace(/^\.\//, '');
    let base = cwd ? cwd.split('/') : [];
    if (raw.startsWith('~') || raw.startsWith('/')) {
      base = [];
      raw = raw.replace(/^~?\/?/, '');
    }
    for (const part of raw.split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') {
        if (!base.length) return null;
        base.pop();
      } else base.push(part.replace(/\.md$/, ''));
    }
    return base.join('/');
  };

  const children = (dir: string) => {
    const prefix = dir ? dir + '/' : '';
    const names = new Set<string>();
    for (const f of files) {
      if (!f.p.startsWith(prefix)) continue;
      const rest = f.p.slice(prefix.length);
      if (rest) names.add(rest.split('/')[0]);
    }
    return [...names].sort();
  };

  const commands: Record<string, (args: string[]) => void> = {
    help() {
      const rows: [string, string][] = [
        ['ls [folder]', 'list pages and folders'],
        ['cd <folder>', 'move into a folder (cd .. goes back)'],
        ['cat <page>', 'show what a page is about'],
        ['open <page>', 'go to a page'],
        ['grep <word>', 'find pages by title, summary, or tag'],
        ['whoami', 'who this site belongs to'],
        ['links', 'LinkedIn, GitHub, Hack The Box'],
        ['pwd, history, clear', 'the usual'],
      ];
      for (const [cmd, what] of rows) {
        const row = el('p', 'term-out term-row');
        row.append(el('span', 'term-key', cmd), el('span', 'term-note', what));
        log.append(row);
      }
      print('Tab completes names. Up and Down walk through earlier commands.', 'term-out term-dim');
    },
    ls(args) {
      const target = resolve(args[0] ?? '');
      if (target === null || !(dirs.has(target) || byPath.has(target))) {
        return fail(`ls: ${args[0]}: no such page or folder`);
      }
      if (!dirs.has(target)) {
        const f = byPath.get(target)!;
        return printLink(target.split('/').pop()!, f.h, f.t);
      }
      for (const name of children(target)) {
        const path = target ? `${target}/${name}` : name;
        const file = byPath.get(path);
        printLink(dirs.has(path) ? name + '/' : name, file ? file.h : '/' + path + '/', file ? file.t : '');
      }
    },
    cd(args) {
      const target = resolve(args[0] ?? '~');
      if (target === null || !dirs.has(target)) {
        const isPage = target !== null && byPath.has(target);
        return fail(isPage ? `cd: ${args[0]}: that is a page. Try: open ${args[0]}` : `cd: ${args[0]}: no such folder`);
      }
      cwd = target;
      ps1.textContent = promptText();
    },
    pwd() {
      print('~' + (cwd ? '/' + cwd : ''));
    },
    cat(args) {
      if (!args[0]) return fail('cat: give me a page name. Try: ls');
      const target = resolve(args[0]);
      const f = target !== null ? byPath.get(target) : undefined;
      if (!f) return fail(`cat: ${args[0]}: no such page`);
      print(f.t, 'term-out term-title-line');
      if (f.d) print(f.d);
      if (f.g.length) print(f.g.map((g) => '#' + g).join(' '), 'term-out term-dim');
      printLink('read the full page', f.h);
    },
    open(args) {
      if (!args[0]) return fail('open: give me a page name. Try: ls');
      const target = resolve(args[0]);
      const f = target !== null ? byPath.get(target) : undefined;
      if (!f && !(target !== null && dirs.has(target))) return fail(`open: ${args[0]}: no such page`);
      print(`opening ${f ? f.t : '~/' + target} ...`, 'term-out term-dim');
      window.location.href = f ? f.h : '/' + target + '/';
    },
    grep(args) {
      const q = args
        .join(' ')
        .toLowerCase()
        .replace(/^["']|["']$/g, '');
      if (!q) return fail('grep: give me a word to look for');
      const hits = files.filter((f) => `${f.t} ${f.d} ${f.g.join(' ')}`.toLowerCase().includes(q));
      if (!hits.length) return print(`no pages match "${q}"`, 'term-out term-dim');
      for (const f of hits.slice(0, 12)) printLink('~/' + f.p, f.h, f.t);
      if (hits.length > 12) print(`and ${hits.length - 12} more. The / key opens full search.`, 'term-out term-dim');
    },
    whoami() {
      print(document.querySelector('.term h1')?.textContent ?? '', 'term-out term-title-line');
      print(document.querySelector('.term .headline')?.textContent ?? '');
    },
    links() {
      for (const l of data.links) printLink(l.label, l.href);
    },
    history() {
      history.forEach((h, i) => print(`${String(i + 1).padStart(3)}  ${h}`));
    },
    clear() {
      log.replaceChildren();
    },
    echo(args) {
      print(args.join(' '));
    },
    sudo() {
      fail('Nice try. You are not in the sudoers file.');
    },
  };
  commands.dir = commands.ls;
  commands['?'] = commands.help;

  const run = (line: string) => {
    const echoRow = el('p', 'term-out term-echo');
    echoRow.append(el('span', 'ps1-echo', promptText() + ' '), el('span', '', line));
    log.append(echoRow);
    const [name, ...args] = line.trim().split(/\s+/);
    if (!name) return;
    const fn = commands[name.toLowerCase()];
    if (fn) fn(args);
    else fail(`${name}: command not found. Type help.`);
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const line = input.value;
    if (line.trim()) history.push(line.trim());
    cursor = history.length;
    input.value = '';
    run(line);
    log.scrollTop = log.scrollHeight;
    form.scrollIntoView({ block: 'nearest' });
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowUp' && history.length) {
      event.preventDefault();
      cursor = Math.max(0, cursor - 1);
      input.value = history[cursor];
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      cursor = Math.min(history.length, cursor + 1);
      input.value = history[cursor] ?? '';
    } else if (event.key === 'Tab' && input.value) {
      const parts = input.value.split(/\s+/);
      let options: string[] = [];
      let stem = '';
      if (parts.length === 1) {
        options = Object.keys(commands).filter((c) => c.startsWith(parts[0].toLowerCase()));
      } else {
        const word = parts[parts.length - 1];
        const cut = word.lastIndexOf('/');
        stem = cut >= 0 ? word.slice(0, cut + 1) : '';
        const dir = resolve(stem || '.');
        if (dir !== null && dirs.has(dir)) {
          options = children(dir)
            .filter((n) => n.startsWith(word.slice(stem.length)))
            .map((n) => (dirs.has(dir ? `${dir}/${n}` : n) ? n + '/' : n));
        }
      }
      if (!options.length) return;
      event.preventDefault();
      if (options.length === 1) {
        parts[parts.length - 1] = stem + options[0];
        input.value = parts.join(' ') + (parts.length === 1 ? ' ' : '');
      } else {
        let common = options[0];
        for (const o of options) while (!o.startsWith(common)) common = common.slice(0, -1);
        parts[parts.length - 1] = stem + common;
        input.value = parts.join(' ');
        print(options.join('   '), 'term-out term-dim');
      }
    } else if (event.key === 'l' && event.ctrlKey) {
      event.preventDefault();
      commands.clear([]);
    }
  });

  // Clicking empty space in the terminal puts the caret in the prompt.
  document.querySelector('.term-body')?.addEventListener('click', (event) => {
    if ((event.target as HTMLElement).closest('a')) return;
    if (window.getSelection()?.toString()) return;
    input.focus({ preventScroll: true });
  });
}
