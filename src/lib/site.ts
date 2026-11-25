import business from '../data/business.json';

export const SITE_URL = 'https://floristeriacattaleya.es';
export { business };

export const nav = [
  { label: 'Inicio', href: '/' },
  { label: 'Ramos', href: '/ramos-madrid' },
  { label: 'Bodas', href: '/bodas-madrid' },
  { label: 'Cumpleaños', href: '/cumpleanos-madrid' },
  { label: 'San Valentín', href: '/san-valentin-madrid' },
  { label: 'Plantas', href: '/plantas-madrid' },
  { label: 'Galería', href: '/galeria' },
  { label: 'Contacto', href: '/contacto' },
];

export function waLink(message: string, url?: string): string {
  const text = url ? `${message}\n${url}` : message;
  return `https://wa.me/${business.whatsappNumber}?text=${encodeURIComponent(text)}`;
}
