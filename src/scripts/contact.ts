document.querySelectorAll<HTMLFormElement>('[data-contact-form]').forEach((form) => {
  const msg = form.querySelector<HTMLElement>('.form-msg')!;
  const ts = form.querySelector<HTMLInputElement>('input[name="ts"]')!;
  ts.value = String(Date.now());

  const show = (ok: boolean, text: string) => {
    msg.hidden = false;
    msg.className = `form-msg ${ok ? 'ok' : 'err'}`;
    msg.textContent = text;
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const data = Object.fromEntries(new FormData(form).entries());
    const btn = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    btn.disabled = true;
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          kind: form.dataset.kind,
          consentimiento: form.querySelector<HTMLInputElement>('input[name="consentimiento"]')!.checked,
        }),
      });
      const out = await res.json().catch(() => ({}));
      if (res.ok) { show(true, 'Gracias, hemos recibido tu mensaje. Te respondemos lo antes posible.'); form.reset(); ts.value = String(Date.now()); }
      else show(false, out.error ?? 'No se pudo enviar. Inténtalo de nuevo o escríbenos por WhatsApp.');
    } catch {
      show(false, 'Sin conexión. Inténtalo de nuevo o escríbenos por WhatsApp.');
    } finally {
      btn.disabled = false;
    }
  });
});
