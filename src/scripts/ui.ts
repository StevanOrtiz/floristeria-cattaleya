import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = <T extends HTMLElement>(s: string) => document.querySelector<T>(s);

/* ---------- mobile menu ---------- */
const menu = $('#mobile-menu');
const openBtn = $('[data-menu-open]');
function setMenu(open: boolean) {
  if (!menu) return;
  menu.hidden = !open;
  openBtn?.setAttribute('aria-expanded', String(open));
  document.body.style.overflow = open ? 'hidden' : '';
  if (open) menu.querySelector<HTMLElement>('a, button')?.focus();
}
openBtn?.addEventListener('click', () => setMenu(true));
$('[data-menu-close]')?.addEventListener('click', () => setMenu(false));
menu?.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu && !menu.hidden) setMenu(false); });

/* ---------- header: shadow + hide on scroll down ---------- */
const header = $('[data-header]');
let lastY = scrollY;
addEventListener('scroll', () => {
  const y = scrollY;
  header?.classList.toggle('scrolled', y > 10);
  header?.classList.toggle('hidden', y > lastY && y > 300);
  lastY = y;
}, { passive: true });

/* ---------- consent + map ---------- */
const KEY = 'cat-consent';
const banner = $('#cookie-banner');
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const write = (v: string) => { try { localStorage.setItem(KEY, v); } catch { /* ignore */ } };

function loadMaps() {
  document.querySelectorAll<HTMLElement>('[data-map]').forEach((box) => {
    if (box.querySelector('iframe') || !box.dataset.src) return;
    const f = document.createElement('iframe');
    f.src = box.dataset.src;
    f.title = 'Mapa de ubicación';
    f.loading = 'lazy';
    f.referrerPolicy = 'no-referrer-when-downgrade';
    box.querySelector('.ph')?.remove();
    box.prepend(f);
  });
}
function applyConsent() { if (read() === 'all') loadMaps(); }
function showBanner() { if (banner) banner.hidden = false; }

if (read() === null) showBanner(); else applyConsent();
document.querySelectorAll<HTMLElement>('[data-consent]').forEach((b) =>
  b.addEventListener('click', () => {
    write(b.dataset.consent!);
    if (banner) banner.hidden = true;
    applyConsent();
  }));
document.querySelectorAll('[data-consent-open]').forEach((b) => b.addEventListener('click', showBanner));

/* ---------- smooth scroll + reveal ---------- */
document.documentElement.classList.add('js-ready');
if (!reduced) {
  gsap.registerPlugin(ScrollTrigger);
  const lenis = new Lenis({ lerp: 0.1 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);

  document.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
    gsap.to(el, {
      opacity: 1, y: 0, duration: 0.8, ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    });
  });
  document.querySelectorAll<HTMLElement>('[data-stagger]').forEach((el) => {
    gsap.from(el.children, {
      opacity: 0, y: 24, duration: 0.7, stagger: 0.09, ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    });
  });
} else {
  document.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => { el.style.opacity = '1'; });
}
