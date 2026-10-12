const TZ = process.env.TZ_DISPLAY || 'Europe/Belgrade';

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formatSize(bytes) {
  if (!bytes) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(u.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const v = bytes / Math.pow(1024, i);
  return (v >= 10 || i === 0 ? Math.round(v) : v.toFixed(1)).toString().replace('.', ',') + ' ' + u[i];
}

const MONTHS = ['januara', 'februara', 'marta', 'aprila', 'maja', 'juna', 'jula', 'avgusta', 'septembra', 'oktobra', 'novembra', 'decembra'];

// npr. "14. oktobra 2026. u 17:16" (srpsko vreme)
function formatDate(ts) {
  const p = {};
  new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  })
    .formatToParts(new Date(ts))
    .forEach((x) => (p[x.type] = x.value));
  return `${Number(p.day)}. ${MONTHS[Number(p.month) - 1]} ${p.year}. u ${p.hour}:${p.minute}`;
}

function fill(tpl, vars) {
  return String(tpl || '').replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}

function photoWord(n) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'fotografije';
  return 'fotografija';
}

function remaining(ts) {
  const ms = ts - Date.now();
  const h = Math.max(1, Math.ceil(ms / 3600000));
  if (h < 24) return `još ${h} ${h === 1 || h === 21 ? 'sat' : (h >= 2 && h <= 4) || (h >= 22 && h <= 24) ? 'sata' : 'sati'}`;
  const d = Math.ceil(h / 24);
  return `još ${d} ${d === 1 ? 'dan' : 'dana'}`;
}

// ---------- boje ----------
function hexToRgb(h) {
  h = String(h || '').trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
const toHex = (rgb) => '#' + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
function lum([r, g, b]) {
  const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
const contrast = (a, b) => {
  const x = lum(a), y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}
function hslToRgb([h, s, l]) {
  if (!s) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => {
    t = (t + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

// Iz jedne izabrane boje pravi celu paletu. Tamnija nijansa zadržava ton (ostaje roze, ne braon),
// a dugmad su uvek čitljiva sa belim tekstom.
function palette(hex) {
  const base = hexToRgb(hex) || hexToRgb('#e79aa2');
  const [h, sat, l] = rgbToHsl(base);
  const s2 = Math.min(0.6, Math.max(sat * 0.7, 0.3)); // prigušeno, da ostane nežno
  let L = l, strong = base;
  while (contrast(strong, [255, 255, 255]) < 4.6 && L > 0.05) {
    L -= 0.01;
    strong = hslToRgb([h, s2, L]);
  }
  const deep = hslToRgb([h, s2, Math.max(0.05, L - 0.08)]);
  const tint = (t) => toHex(base.map((v) => v + (255 - v) * t));
  return {
    accent: toHex(base),
    strong: toHex(strong),
    deep: toHex(deep),
    blush: tint(0.86),
    blush2: tint(0.78),
    line: tint(0.66),
    wash: tint(0.95),
  };
}

function themeCss(hex) {
  const p = palette(hex);
  return `:root{--accent:${p.accent};--accent-strong:${p.strong};--accent-deep:${p.deep};--blush:${p.blush};--blush-2:${p.blush2};--blush-line:${p.line};--wash:${p.wash}}`;
}

function socialUrl(kind, v) {
  v = String(v || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  const h = v.replace(/^@/, '');
  if (kind === 'instagram') return 'https://instagram.com/' + h;
  if (kind === 'facebook') return 'https://facebook.com/' + h;
  return 'https://' + v;
}

const CURRENCY = { EUR: '€', RSD: 'RSD', USD: '$', CHF: 'CHF' };
const currencySymbol = (c) => CURRENCY[c] || c || '€';
const formatMoney = (n, c) => `${Math.round(n || 0).toLocaleString('sr-RS')} ${currencySymbol(c)}`;

module.exports = { currencySymbol, formatMoney, esc, formatSize, formatDate, fill, photoWord, remaining, palette, themeCss, socialUrl };
