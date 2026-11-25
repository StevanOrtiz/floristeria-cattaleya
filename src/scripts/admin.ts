const root = document.querySelector<HTMLElement>('.adm');
const csrf = root?.dataset.csrf ?? '';

async function api(url: string, method: string, body?: unknown, form?: FormData) {
  const res = await fetch(url, {
    method,
    headers: { 'x-csrf-token': csrf, ...(form ? {} : { 'Content-Type': 'application/json' }) },
    body: form ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

function msg(el: HTMLElement | null, ok: boolean, text: string) {
  if (!el) return;
  el.hidden = false;
  el.className = `form-msg ${ok ? 'ok' : 'err'}`;
  el.textContent = text;
}

/* ---------- login ---------- */
const login = document.querySelector<HTMLFormElement>('[data-login]');
login?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(login);
  const res = await fetch('/api/admin/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: fd.get('email'), password: fd.get('password') }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok) location.href = '/admin';
  else msg(login.querySelector('.form-msg'), false, data.error ?? 'Error al entrar.');
});

/* ---------- logout ---------- */
document.querySelector('[data-logout]')?.addEventListener('click', async () => {
  await api('/api/admin/logout', 'POST');
  location.href = '/admin/login';
});

/* ---------- list filter ---------- */
const q = document.querySelector<HTMLInputElement>('[data-admin-q]');
const cat = document.querySelector<HTMLSelectElement>('[data-admin-cat]');
function filterRows() {
  const term = (q?.value ?? '').toLowerCase().trim();
  document.querySelectorAll<HTMLElement>('[data-row]').forEach((r) => {
    r.hidden = !((r.dataset.name ?? '').includes(term) && (!cat?.value || r.dataset.cat === cat.value));
  });
}
q?.addEventListener('input', filterRows);
cat?.addEventListener('change', filterRows);

/* ---------- product form ---------- */
const form = document.querySelector<HTMLFormElement>('[data-product-form]');
if (form) {
  const slugInput = form.elements.namedItem('slug') as HTMLInputElement;
  const nameInput = form.elements.namedItem('name') as HTMLInputElement;
  const isNew = !form.dataset.id;
  const slugify = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  if (isNew) nameInput.addEventListener('input', () => { if (!slugInput.dataset.touched) slugInput.value = slugify(nameInput.value); });
  slugInput.addEventListener('input', () => { slugInput.dataset.touched = '1'; });

  const out = form.querySelector<HTMLElement>('.form-msg');
  const g = (n: string) => (form.elements.namedItem(n) as HTMLInputElement | HTMLTextAreaElement).value;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      name: g('name'), slug: g('slug'), categoryId: g('categoryId'), subcategory: g('subcategory'), price: g('price'),
      dimensions: g('dimensions'), description: g('description'), composition: g('composition'), care: g('care'),
      watering: g('watering'), occasions: g('occasions'), keywords: g('keywords'),
      published: (form.elements.namedItem('published') as HTMLInputElement).checked,
      featured: (form.elements.namedItem('featured') as HTMLInputElement).checked,
    };
    const r = isNew ? await api('/api/admin/products', 'POST', payload) : await api(`/api/admin/products/${form.dataset.id}`, 'PUT', payload);
    if (!r.ok) return msg(out, false, r.data.error ?? 'No se pudo guardar.');
    if (isNew) location.href = `/admin/productos/${r.data.id}`;
    else msg(out, true, 'Guardado.');
  });

  form.querySelector('[data-delete-product]')?.addEventListener('click', async () => {
    if (!confirm('¿Borrar este producto y todas sus fotos? No se puede deshacer.')) return;
    const r = await api(`/api/admin/products/${form.dataset.id}`, 'DELETE');
    if (r.ok) location.href = '/admin'; else msg(out, false, r.data.error ?? 'No se pudo borrar.');
  });
}

/* ---------- images ---------- */
const box = document.querySelector<HTMLElement>('[data-images]');
if (box) {
  const out = box.querySelector<HTMLElement>('[data-img-msg]');
  const productId = box.dataset.product!;

  // Shrink in the browser first (serverless body limit ~4.5 MB).
  async function shrink(file: File): Promise<Blob> {
    if (file.size < 1.5 * 1024 * 1024) return file;
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
      c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
      return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej()), 'image/jpeg', 0.85));
    } catch { return file; }
  }

  box.querySelector<HTMLInputElement>('[data-upload]')?.addEventListener('change', async (e) => {
    const input = e.target as HTMLInputElement;
    const files = [...(input.files ?? [])];
    if (!files.length) return;
    msg(out, true, 'Subiendo…');
    for (const f of files) {
      const fd = new FormData();
      fd.append('file', await shrink(f), f.name);
      const r = await api(`/api/admin/products/${productId}/images`, 'POST', undefined, fd);
      if (!r.ok) return msg(out, false, r.data.error ?? 'Error al subir.');
    }
    location.reload();
  });

  box.addEventListener('click', async (e) => {
    const t = e.target as HTMLElement;
    const li = t.closest<HTMLElement>('[data-image]');
    if (!li) return;
    const id = li.dataset.image!;
    if (t.matches('[data-del-img]')) {
      if (!confirm('¿Borrar esta foto?')) return;
      const r = await api(`/api/admin/images/${id}`, 'DELETE');
      if (r.ok) location.reload(); else msg(out, false, r.data.error ?? 'Error.');
    } else if (t.matches('[data-move]')) {
      const r = await api(`/api/admin/images/${id}`, 'PATCH', { move: t.dataset.move });
      if (r.ok) location.reload(); else msg(out, false, r.data.error ?? 'Error.');
    }
  });
  box.addEventListener('change', async (e) => {
    const t = e.target as HTMLInputElement;
    if (!t.matches('[data-alt]')) return;
    const id = t.closest<HTMLElement>('[data-image]')!.dataset.image!;
    const r = await api(`/api/admin/images/${id}`, 'PATCH', { alt: t.value });
    msg(out, r.ok, r.ok ? 'Texto alternativo guardado.' : r.data.error ?? 'Error.');
  });
}
