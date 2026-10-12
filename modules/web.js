// Javni sajt (stranice iz CMS-a, portfolio, upiti) i API za uređivanje sajta iz panela.
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const web = require('../lib/web');
const { CATEGORIES, byKey } = require('../lib/categories');
const { esc, formatMoney, fill } = require('../lib/util');
const { zoned, dateLong } = require('../lib/time');

const SIZES = { m: 'thumb', l: 'file', xl: 'file' };
const clean = (v, n = 300) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, n);
const slugify = (v) =>
  clean(v, 80)
    .toLowerCase()
    .replace(/[čć]/g, 'c').replace(/š/g, 's').replace(/ž/g, 'z').replace(/đ/g, 'dj')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'stranica';

module.exports = (ctx) => {
  const { app, store, mailer, requireAdmin, adminOnly, BRAND_DIR, sharp, notify } = ctx;
  const S = () => store.settings;
  const site = () => store.data.site;

  // Kontekst za crtanje stranica (req daje apsolutnu adresu za SEO oznake)
  const view = (req, lang) => ({
    lang: lang === 'en' && S().langEnabled ? 'en' : 'sr',
    s: store.settings,
    v: store.data.brand.v,
    bgs: store.data.backgrounds,
    site: store.data.site,
    packages: store.data.packages,
    base: ((S().siteUrl || (req ? ctx.baseUrl(req) : '')) || '').replace(/\/$/, ''),
    path: req ? req.path : '/',
  });
  ctx.webView = view;
  ctx.renderMessage = (title, text, req) => web.renderMessage(view(req), title, text);

  const findPage = (slug) => (site().pages || []).find((p) => (p.slug || '') === slug && p.published !== false);
  const findAlbum = (slug) => (site().albums || []).find((a) => a.slug === slug && a.published !== false);

  // ---------- slike sajta ----------
  app.get('/site/img/:id', (req, res) => {
    const im = (site().images || []).find((x) => x.id === req.params.id);
    if (!im) return res.status(404).end();
    const key = SIZES[req.query.s] || 'file';
    const name = (key === 'thumb' && im.thumb) || im.file;
    const p = path.join(BRAND_DIR, name);
    if (!fs.existsSync(p)) return res.status(404).end();
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.sendFile(p);
  });

  // ---------- javne stranice ----------
  const RESERVED = ['admin', 'api', 'brand', 'site', 'd', 'media', 'favicon.ico', 'robots.txt'];

  app.get('/robots.txt', (req, res) => {
    const base = S().siteUrl ? S().siteUrl.replace(/\/$/, '') : '';
    res.type('text').send(`User-agent: *\nDisallow: /admin\nDisallow: /d/\n${base ? `Sitemap: ${base}/sitemap.xml\n` : ''}`);
  });

  app.get('/sitemap.xml', (req, res) => {
    const base = (S().siteUrl || ctx.baseUrl(req)).replace(/\/$/, '');
    const paths = (site().pages || []).filter((p) => p.published !== false).map((p) => '/' + (p.slug || ''));
    for (const a of site().albums || []) if (a.published !== false) paths.push(`/portfolio/${a.slug}`);
    const en = !!S().langEnabled;
    const entry = (path) => {
      const sr = base + path;
      const eng = base + (path === '/' ? '/en' : '/en' + path);
      const alt = en ? `<xhtml:link rel="alternate" hreflang="sr" href="${esc(sr)}"/><xhtml:link rel="alternate" hreflang="en" href="${esc(eng)}"/>` : '';
      return `<url><loc>${esc(sr)}</loc>${alt}</url>` + (en ? `\n<url><loc>${esc(eng)}</loc>${alt}</url>` : '');
    };
    res.type('xml').send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${paths.map(entry).join('\n')}\n</urlset>`
    );
  });

  const langOf = (req) => (req.path === '/en' || req.path.startsWith('/en/') ? 'en' : 'sr');

  app.get(['/portfolio/:slug', '/en/portfolio/:slug'], (req, res, next) => {
    const a = findAlbum(req.params.slug);
    if (!a) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.type('html').send(web.renderAlbum(view(req, langOf(req)), a));
  });

  app.get(['/', '/en', '/en/:slug', '/:slug'], (req, res, next) => {
    const lang = langOf(req);
    if (lang === 'en' && !S().langEnabled) return res.redirect(301, '/' + (req.params.slug || ''));
    const slug = req.params.slug || '';
    if (RESERVED.includes(slug)) return next();
    if (!S().siteEnabled && slug !== '') return next();
    const page = findPage(slug);
    if (!page) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.type('html').send(web.renderPage(view(req, lang), page));
  });

  // ---------- upiti sa sajta ----------
  const tooMany = (() => {
    const hits = new Map();
    return (ip) => {
      const now = Date.now();
      const list = (hits.get(ip) || []).filter((t) => now - t < 3600e3);
      list.push(now);
      hits.set(ip, list);
      if (hits.size > 500) hits.clear();
      return list.length > 8;
    };
  })();

  function addRequest(entry) {
    const r = { id: store.newId(6), at: Date.now(), status: 'new', ...entry };
    store.data.requests.unshift(r);
    store.data.requests = store.data.requests.slice(0, 500);
    store.save();
    return r;
  }

  app.post('/api/site/contact', async (req, res) => {
    if (tooMany(req.ip)) return res.status(429).json({ error: 'Previše poruka. Pokušajte kasnije.' });
    const b = req.body || {};
    const name = clean(b.name, 120);
    const email = clean(b.email, 160);
    const message = clean(b.message, 4000);
    if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !message) return res.status(400).json({ error: 'Popunite ime, ispravan email i poruku.' });
    const r = addRequest({ kind: 'contact', name, email, phone: clean(b.phone, 60), message, lang: b.lang === 'en' ? 'en' : 'sr' });
    notify({ type: 'request', title: `Nova poruka sa sajta: ${name}`, text: message.slice(0, 120), link: '#requests', key: 'req:' + r.id });
    sendStudioCopy(r).catch((e) => console.error('Upit – email studiju nije poslat:', e.message));
    res.json({ ok: true });
  });

  app.post('/api/site/request', async (req, res) => {
    if (tooMany(req.ip)) return res.status(429).json({ error: 'Previše upita. Pokušajte kasnije.' });
    const b = req.body || {};
    const cat = byKey[clean(b.category, 30)];
    const name = clean(b.name, 120);
    const email = clean(b.email, 160);
    const phone = clean(b.phone, 60);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : '';
    const time = /^\d{1,2}:\d{2}$/.test(b.time || '') ? String(b.time).padStart(5, '0') : '';
    if (!cat) return res.status(400).json({ error: 'Izaberite vrstu fotografisanja.' });
    if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !phone) return res.status(400).json({ error: 'Popunite ime, ispravan email i telefon.' });
    if (!date) return res.status(400).json({ error: 'Izaberite željeni datum.' });
    const pkg = (store.data.packages || []).find((p) => p.id === clean(b.packageId, 40));
    const r = addRequest({
      kind: 'booking',
      category: cat.key,
      name,
      email,
      phone,
      date,
      time,
      location: clean(b.location, 200),
      packageId: pkg ? pkg.id : '',
      packageName: pkg ? pkg.name : '',
      message: clean(b.message, 4000),
      lang: b.lang === 'en' ? 'en' : 'sr',
    });
    notify({
      type: 'request',
      title: `Upit za ${cat.name}: ${name}`,
      text: `${dateLong(date)}${time ? ' u ' + time : ''}${r.location ? ' · ' + r.location : ''}`,
      link: '#requests',
      key: 'req:' + r.id,
    });
    sendStudioCopy(r).catch((e) => console.error('Upit – email studiju nije poslat:', e.message));
    sendClientReply(r, cat).catch((e) => console.error('Upit – potvrda klijentu nije poslata:', e.message));
    res.json({ ok: true });
  });

  async function sendStudioCopy(r) {
    const s = S();
    const to = s.notifyEmail || s.contactEmail || s.fromEmail;
    if (!to || !s.requestNotify || !s.smtpHost) return;
    const lines = [
      r.kind === 'booking' ? `Vrsta: ${byKey[r.category]?.name || ''}` : 'Poruka sa sajta',
      `Ime: ${r.name}`,
      `Email: ${r.email}`,
      r.phone && `Telefon: ${r.phone}`,
      r.date && `Željeni datum: ${dateLong(r.date)}${r.time ? ' u ' + r.time : ''}`,
      r.location && `Lokacija: ${r.location}`,
      r.packageName && `Paket: ${r.packageName}`,
      r.message && `\n${r.message}`,
    ].filter(Boolean);
    await mailer.sendSimple(s, {
      to,
      subject: r.kind === 'booking' ? `Novi upit za termin – ${r.name}` : `Nova poruka sa sajta – ${r.name}`,
      body: lines.join('\n'),
      cta: null,
    });
  }

  async function sendClientReply(r, cat) {
    const s = S();
    const en = r.lang === 'en';
    const subject = (en && s.requestReplySubjectEn) || s.requestReplySubject;
    const body = (en && s.requestReplyBodyEn) || s.requestReplyBody;
    if (!s.smtpHost || !subject) return;
    const vals = {
      klijent: r.name,
      kategorija: en ? cat.nameEn || cat.name : cat.name,
      datum: en ? r.date : dateLong(r.date),
      vreme: r.time || (en ? 'to be agreed' : 'po dogovoru'),
      lokacija: r.location || (en ? 'to be agreed' : 'po dogovoru'),
      studio: s.studioName,
    };
    await mailer.sendSimple(s, { to: r.email, toName: r.name, subject: fill(subject, vals), body: fill(body, vals) });
  }

  // ---------- panel: upiti ----------
  app.get('/api/admin/requests', requireAdmin, (req, res) => {
    res.json((store.data.requests || []).map((r) => ({ ...r, categoryName: byKey[r.category]?.name || '' })));
  });

  app.put('/api/admin/requests/:id', requireAdmin, (req, res) => {
    const r = (store.data.requests || []).find((x) => x.id === req.params.id);
    if (!r) return res.status(404).json({ error: 'Upit ne postoji.' });
    if (['new', 'done', 'archived'].includes(req.body?.status)) r.status = req.body.status;
    if (req.body?.note !== undefined) r.note = clean(req.body.note, 1000);
    store.save();
    res.json(r);
  });

  app.delete('/api/admin/requests/:id', requireAdmin, (req, res) => {
    store.data.requests = (store.data.requests || []).filter((x) => x.id !== req.params.id);
    store.save();
    res.json({ ok: true });
  });

  // ---------- panel: sadržaj sajta ----------
  app.get('/api/admin/site', requireAdmin, (req, res) => {
    const d = site();
    res.json({
      pages: d.pages,
      albums: d.albums,
      images: (d.images || []).map((i) => ({ id: i.id, url: `/site/img/${i.id}?s=m`, full: `/site/img/${i.id}`, at: i.at })),
      categories: CATEGORIES.map((c) => ({ key: c.key, name: c.name })),
      siteEnabled: S().siteEnabled,
      langEnabled: !!S().langEnabled,
    });
  });

  app.put('/api/admin/site/pages', adminOnly, (req, res) => {
    const pages = Array.isArray(req.body?.pages) ? req.body.pages : null;
    if (!pages) return res.status(400).json({ error: 'Nedostaju stranice.' });
    const seen = new Set();
    for (const p of pages) {
      p.id ||= store.newId(4);
      p.title = clean(p.title, 80) || 'Stranica';
      p.slug = p.slug === '' ? '' : slugify(p.slug || p.title);
      if (seen.has(p.slug)) p.slug = p.slug + '-' + store.newId(2);
      seen.add(p.slug);
      p.nav = clean(p.nav, 40);
      p.parent = clean(p.parent, 40) || undefined;
      p.cover = clean(p.cover, 40) || undefined;
      p.sections = Array.isArray(p.sections) ? p.sections.slice(0, 30) : [];
      for (const s of p.sections) s.id ||= store.newId(3);
      if (p.en && typeof p.en !== 'object') delete p.en;
    }
    for (const p of pages) if (p.parent === p.id) delete p.parent;
    site().pages = pages.slice(0, 60);
    store.save();
    res.json({ ok: true, pages: site().pages });
  });

  // ---------- panel: biblioteka slika ----------
  app.post('/api/admin/site/images', adminOnly, async (req, res) => {
    if (!(await ctx.runImageUpload((u) => u.array('files', 30))(req, res))) return;
    const added = [];
    for (const f of req.files || []) {
      try {
        const file = await ctx.saveImage(f.path, 'site', { width: 2200, height: 2200 });
        let thumb = null;
        if (sharp) {
          thumb = file.replace(/\.jpg$/, '-m.jpg');
          await sharp(path.join(BRAND_DIR, file)).resize({ width: 900, height: 1200, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80, mozjpeg: true }).toFile(path.join(BRAND_DIR, thumb));
        }
        const im = { id: store.newId(6), file, thumb, at: Date.now() };
        site().images.push(im);
        added.push({ id: im.id, url: `/site/img/${im.id}?s=m`, full: `/site/img/${im.id}` });
      } catch {}
    }
    store.save();
    res.json({ added });
  });

  app.delete('/api/admin/site/images/:id', adminOnly, async (req, res) => {
    const im = (site().images || []).find((x) => x.id === req.params.id);
    if (!im) return res.status(404).json({ error: 'Slika ne postoji.' });
    for (const f of [im.file, im.thumb]) if (f) await fsp.rm(path.join(BRAND_DIR, f), { force: true });
    site().images = site().images.filter((x) => x !== im);
    // ukloni je i iz albuma i sekcija
    for (const a of site().albums) {
      a.images = (a.images || []).filter((id) => id !== im.id);
      if (a.cover === im.id) a.cover = a.images[0] || '';
    }
    for (const p of site().pages) for (const s of p.sections || []) {
      if (Array.isArray(s.images)) s.images = s.images.filter((id) => id !== im.id);
      if (s.image === im.id) s.image = '';
    }
    store.save();
    res.json({ ok: true });
  });

  // ---------- panel: albumi ----------
  const albumOut = (a) => ({ ...a, cover: a.cover || (a.images || [])[0] || '' });

  app.post('/api/admin/site/albums', adminOnly, (req, res) => {
    const b = req.body || {};
    const title = clean(b.title, 90);
    if (!title) return res.status(400).json({ error: 'Upišite naziv albuma.' });
    const slugs = new Set(site().albums.map((a) => a.slug));
    let slug = slugify(b.slug || title);
    while (slugs.has(slug)) slug += '-' + store.newId(2);
    const a = {
      id: store.newId(6),
      title,
      slug,
      category: byKey[clean(b.category, 30)] ? b.category : '',
      text: clean(b.text, 600),
      images: [],
      cover: '',
      en: b.en && typeof b.en === 'object' ? { title: clean(b.en.title, 90), text: clean(b.en.text, 600) } : undefined,
      published: b.published !== false,
      order: site().albums.length,
    };
    site().albums.push(a);
    store.save();
    res.json(albumOut(a));
  });

  app.put('/api/admin/site/albums/:id', adminOnly, (req, res) => {
    const a = site().albums.find((x) => x.id === req.params.id);
    if (!a) return res.status(404).json({ error: 'Album ne postoji.' });
    const b = req.body || {};
    if (b.title !== undefined) a.title = clean(b.title, 90) || a.title;
    if (b.slug !== undefined && clean(b.slug)) a.slug = slugify(b.slug);
    if (b.category !== undefined) a.category = byKey[clean(b.category, 30)] ? b.category : '';
    if (b.text !== undefined) a.text = clean(b.text, 600);
    if (b.published !== undefined) a.published = !!b.published;
    if (b.en !== undefined) a.en = b.en && typeof b.en === 'object' ? { title: clean(b.en.title, 90), text: clean(b.en.text, 600) } : undefined;
    if (Array.isArray(b.images)) a.images = b.images.filter((id) => site().images.some((i) => i.id === id)).slice(0, 300);
    if (b.cover !== undefined) a.cover = a.images.includes(b.cover) ? b.cover : a.images[0] || '';
    if (b.order !== undefined) a.order = Number(b.order) || 0;
    store.save();
    res.json(albumOut(a));
  });

  app.put('/api/admin/site/albums', adminOnly, (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    ids.forEach((id, i) => {
      const a = site().albums.find((x) => x.id === id);
      if (a) a.order = i;
    });
    site().albums.sort((x, y) => (x.order || 0) - (y.order || 0));
    store.save();
    res.json({ ok: true });
  });

  app.delete('/api/admin/site/albums/:id', adminOnly, (req, res) => {
    site().albums = site().albums.filter((x) => x.id !== req.params.id);
    store.save();
    res.json({ ok: true });
  });
};
