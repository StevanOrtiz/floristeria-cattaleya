const overlay = document.getElementById('search-overlay') as HTMLElement | null;
const input = document.getElementById('search-input') as HTMLInputElement | null;
const list = document.getElementById('search-results') as HTMLUListElement | null;
const empty = document.getElementById('search-empty') as HTMLElement | null;

if (overlay && input && list && empty) {
  let timer: number | undefined;
  let ctrl: AbortController | undefined;
  let opener: HTMLElement | null = null;
  let index = -1;

  const items = () => [...list.querySelectorAll<HTMLAnchorElement>('a')];
  const select = (i: number) => {
    const els = items();
    els.forEach((a, n) => a.setAttribute('aria-selected', String(n === i)));
    index = i;
    if (els[i]) input.setAttribute('aria-activedescendant', els[i].id); else input.removeAttribute('aria-activedescendant');
  };

  function open(from?: HTMLElement | null) {
    opener = from ?? null;
    overlay!.hidden = false;
    document.body.style.overflow = 'hidden';
    input!.focus();
  }
  function close() {
    overlay!.hidden = true;
    document.body.style.overflow = '';
    opener?.focus();
  }

  function render(results: any[]) {
    list!.replaceChildren();
    empty!.hidden = results.length > 0 || input!.value.trim().length < 2;
    input!.setAttribute('aria-expanded', String(results.length > 0));
    results.forEach((r, n) => {
      const li = document.createElement('li');
      li.setAttribute('role', 'presentation');
      const a = document.createElement('a');
      a.href = r.url; a.id = `sr-${n}`; a.setAttribute('role', 'option');
      if (r.image) {
        const img = document.createElement('img');
        img.src = r.image; img.alt = ''; img.width = 52; img.height = 52; img.loading = 'lazy';
        a.append(img);
      }
      const t = document.createElement('span'); t.className = 't';
      const name = document.createElement('strong'); name.textContent = r.name;       // textContent: no XSS
      const cat = document.createElement('small'); cat.textContent = r.category;
      t.append(name, cat);
      const pr = document.createElement('span'); pr.className = 'pr'; pr.textContent = r.price;
      a.append(t, pr);
      li.append(a);
      list!.append(li);
    });
    index = -1;
  }

  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 2) { ctrl?.abort(); render([]); return; }
    timer = window.setTimeout(async () => {
      ctrl?.abort();
      ctrl = new AbortController();
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (!res.ok) return;
        render((await res.json()).results ?? []);
      } catch { /* aborted or offline */ }
    }, 160);
  });

  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { close(); return; }
    const els = items();
    if (e.key === 'ArrowDown') { e.preventDefault(); select(Math.min(index + 1, els.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); select(Math.max(index - 1, 0)); }
    else if (e.key === 'Enter' && index >= 0) { e.preventDefault(); els[index].click(); }
    else if (e.key === 'Tab') {                       // focus trap
      const f = overlay.querySelectorAll<HTMLElement>('input, button');
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('[data-search-close]')?.addEventListener('click', close);

  document.querySelectorAll<HTMLElement>('[data-search-open]').forEach((b) =>
    b.addEventListener('click', (e) => { e.preventDefault(); open(b); }));
  addEventListener('keydown', (e) => {
    const tag = (e.target as HTMLElement).tagName;
    if (e.key === '/' && overlay.hidden && !['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) { e.preventDefault(); open(null); }
  });
}
