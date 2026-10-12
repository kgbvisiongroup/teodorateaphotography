// Sajt: logo, ikonica, boja i pozadinske fotografije početne strane.
(function () {
  'use strict';
  const { $, $$, api, toast, ask } = App;
  const refreshBrand = App.refreshBrand;
  const photos = App.fmt.photos;

  // ---------- izgled: logo i ikonica ----------
  $$('[data-pick]').forEach((b) => (b.onclick = () => $('#' + b.dataset.pick).click()));
  async function uploadBrand(kind, file) {
    const fd = new FormData();
    fd.append('file', file);
    try {
      const r = await api('POST', '/api/admin/brand/' + kind, fd);
      refreshBrand(r.v);
      toast(kind === 'logo' ? 'Logo je promenjen' : 'Ikonica je promenjena');
    } catch (err) {
      toast(err.message);
    }
  }
  $('#logoFile').onchange = (e) => e.target.files[0] && uploadBrand('logo', e.target.files[0]).then(() => (e.target.value = ''));
  $('#iconFile').onchange = (e) => e.target.files[0] && uploadBrand('icon', e.target.files[0]).then(() => (e.target.value = ''));
  async function resetBrand(kind) {
    if (!(await ask(kind === 'logo' ? 'Vratiti originalni logo?' : 'Vratiti originalnu ikonicu?', 'Trenutna slika će biti zamenjena originalnom.', 'Vrati'))) return;
    const r = await api('DELETE', '/api/admin/brand/' + kind);
    refreshBrand(r.v);
    toast('Vraćeno na original');
  }
  $('#logoReset').onclick = () => resetBrand('logo');
  $('#iconReset').onclick = () => resetBrand('icon');

  // ---------- izgled: boja (ista formula kao na serveru) ----------
  const hexToRgb = (h) => [0, 2, 4].map((i) => parseInt(h.replace('#', '').slice(i, i + 2), 16));
  const toHex = (c) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
  const lum = (c) => {
    const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
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
  function palette(hex) {
    const base = hexToRgb(hex);
    const [h, sat, l] = rgbToHsl(base);
    const s2 = Math.min(0.6, Math.max(sat * 0.7, 0.3));
    let L = l, strong = base;
    while (1.05 / (lum(strong) + 0.05) < 4.6 && L > 0.05) {
      L -= 0.01;
      strong = hslToRgb([h, s2, L]);
    }
    const tint = (t) => toHex(base.map((v) => v + (255 - v) * t));
    return { strong: toHex(strong), blush: tint(0.86), line: tint(0.66), wash: tint(0.95) };
  }
  function colorDemo() {
    const hex = $('#accent').value;
    const p = palette(hex);
    const d = $('#colorDemo').style;
    d.setProperty('--d-strong', p.strong);
    d.setProperty('--d-blush', p.blush);
    d.setProperty('--d-line', p.line);
    d.setProperty('--d-wash', p.wash);
    $('#accentHex').textContent = hex.toUpperCase();
    $$('#swatches button').forEach((b) => b.classList.toggle('on', b.dataset.c.toLowerCase() === hex.toLowerCase()));
  }
  $$('#swatches button').forEach((b) => {
    b.style.background = b.dataset.c;
    b.setAttribute('aria-label', b.title);
    b.onclick = () => {
      $('#accent').value = b.dataset.c;
      colorDemo();
    };
  });
  $('#accent').addEventListener('input', colorDemo);

  // ---------- izgled: pozadine ----------
  let bgs = [];
  const ICO = {
    l: '<svg viewBox="0 0 24 24"><path d="m14.5 6-6 6 6 6"/></svg>',
    r: '<svg viewBox="0 0 24 24"><path d="m9.5 6 6 6-6 6"/></svg>',
    d: '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/></svg>',
  };
  function renderBgs() {
    $('#bgs').innerHTML = bgs.length
      ? bgs
          .map(
            (b, i) => `<div class="bg" data-id="${b.id}"><img src="${b.url}" alt="" loading="lazy"><span class="no">${i + 1}</span><div class="tools">
<button type="button" data-mv="-1" aria-label="Pomeri levo" ${i === 0 ? 'disabled' : ''}>${ICO.l}</button><button type="button" data-mv="1" aria-label="Pomeri desno" ${i === bgs.length - 1 ? 'disabled' : ''}>${ICO.r}</button><button type="button" class="del" data-del aria-label="Ukloni">${ICO.d}</button></div></div>`
          )
          .join('')
      : '<div class="empty">Još nema fotografija. Dok ih ne dodate, početna strana prikazuje nežnu roze pozadinu sa vašim logom.</div>';
  }
  async function loadBgs() {
    try {
      bgs = await api('GET', '/api/admin/backgrounds');
      renderBgs();
    } catch {}
  }
  $('#bgFile').onchange = async (e) => {
    const list = [...e.target.files];
    if (!list.length) return;
    const fd = new FormData();
    list.forEach((f) => fd.append('files', f));
    toast('Dodajem fotografije…');
    try {
      bgs = await api('POST', '/api/admin/backgrounds', fd);
      renderBgs();
      toast('Fotografije su dodate na početnu stranu');
    } catch (err) {
      toast(err.message);
    }
    e.target.value = '';
  };
  $('#bgs').addEventListener('click', async (e) => {
    const card = e.target.closest('.bg');
    if (!card) return;
    const id = card.dataset.id;
    const mv = e.target.closest('[data-mv]');
    if (mv) {
      const i = bgs.findIndex((b) => b.id === id);
      const j = i + Number(mv.dataset.mv);
      if (j < 0 || j >= bgs.length) return;
      [bgs[i], bgs[j]] = [bgs[j], bgs[i]];
      renderBgs();
      await api('PUT', '/api/admin/backgrounds/order', { ids: bgs.map((b) => b.id) }).catch((err) => toast(err.message));
      return;
    }
    if (e.target.closest('[data-del]')) {
      if (!(await ask('Ukloniti fotografiju?', 'Neće se više prikazivati na početnoj strani.', 'Ukloni', true))) return;
      await api('DELETE', '/api/admin/backgrounds/' + id);
      bgs = bgs.filter((b) => b.id !== id);
      renderBgs();
    }
  });


  App.view('look', { role: 'admin', title: 'Izgled', sub: 'Logo, boja i fotografije na početnoj strani.', load: () => Promise.all([loadBgs(), App.loadSettings()]) });
  App.view('content', { role: 'admin', title: 'Sadržaj i kontakt', sub: 'Tekstovi koje klijenti vide i vaši kontakt podaci.', load: () => App.loadSettings() });
  App.colorDemo = colorDemo;
})();
