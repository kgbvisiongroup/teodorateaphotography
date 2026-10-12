// Album: formati albuma, projekti koje klijenti sami slažu na sajtu i porudžbine.
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const crypto = require('crypto');
const { esc, formatMoney } = require('../lib/util');

const clean = (v, n = 200) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, n);
const num = (v, d = 0) => (v === '' || v == null || isNaN(Number(v)) ? d : Number(v));

module.exports = (ctx) => {
  const { app, store, mailer, sharp, requireAdmin, adminOnly, notify } = ctx;
  const S = () => store.settings;
  const data = () => store.data;
  const DIR = path.join(ctx.DATA_DIR, 'albums');
  fs.mkdirSync(DIR, { recursive: true });

  const formats = () => data().albumFormats;
  const projects = () => data().albumProjects;
  const findFormat = (id) => formats().find((f) => f.id === id);
  const byToken = (t) => projects().find((p) => p.token === t);

  // ---------- cena ----------
  function priceOf(p) {
    const f = findFormat(p.formatId);
    if (!f) return 0;
    const extra = Math.max(0, (p.spreads || f.spreads) - f.spreads);
    return Math.round(f.price + extra * (f.extraSpreadPrice || 0));
  }

  // ---------- prazan projekat ----------
  function blankPages(f, spreads) {
    const pages = [{ kind: 'cover', items: [], bg: null }];
    for (let i = 0; i < spreads; i++) pages.push({ kind: 'spread', items: [], bg: null });
    return pages;
  }

  function newProject(formatId) {
    const f = findFormat(formatId);
    if (!f) return null;
    const p = {
      id: store.newId(8),
      token: crypto.randomBytes(9).toString('base64url'),
      formatId: f.id,
      spreads: f.spreads,
      pages: blankPages(f, f.spreads),
      photos: [],
      customer: { name: '', email: '', phone: '', note: '' },
      status: 'draft',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    projects().unshift(p);
    projects().length = Math.min(projects().length, 2000);
    store.save();
    return p;
  }

  const publicProject = (p) => ({
    token: p.token,
    formatId: p.formatId,
    format: findFormat(p.formatId),
    spreads: p.spreads,
    pages: p.pages,
    photos: p.photos.map((x) => ({ id: x.id, w: x.w, h: x.h, url: `/album-photo/${p.token}/${x.id}`, thumb: `/album-photo/${p.token}/${x.id}?s=m` })),
    customer: p.customer,
    status: p.status,
    price: priceOf(p),
    currency: S().currency,
  });

  // ---------- javno: formati i otvaranje projekta ----------
  app.get('/api/album/formats', (req, res) => {
    res.json({
      formats: formats().filter((f) => f.active !== false).sort((a, b) => (a.order || 0) - (b.order || 0)),
      currency: S().currency,
      studio: S().studioName,
    });
  });

  app.post('/api/album/new', (req, res) => {
    if (S().albumEnabled === false) return res.status(403).json({ error: 'Izrada albuma je trenutno isključena.' });
    const p = newProject(clean(req.body?.formatId, 40));
    if (!p) return res.status(400).json({ error: 'Izaberite format albuma.' });
    res.json({ token: p.token });
  });

  app.get('/api/album/:token', (req, res) => {
    const p = byToken(req.params.token);
    if (!p) return res.status(404).json({ error: 'Album ne postoji.' });
    res.json(publicProject(p));
  });

  // Čuvanje izgleda (automatski iz uređivača)
  app.put('/api/album/:token', (req, res) => {
    const p = byToken(req.params.token);
    if (!p) return res.status(404).json({ error: 'Album ne postoji.' });
    if (p.status === 'ordered' || p.status === 'done') return res.status(400).json({ error: 'Album je već poručen.' });
    const b = req.body || {};
    if (Array.isArray(b.pages)) p.pages = JSON.parse(JSON.stringify(b.pages)).slice(0, 60);
    if (b.spreads !== undefined) p.spreads = Math.max(1, Math.min(40, Math.round(num(b.spreads, p.spreads))));
    p.updatedAt = Date.now();
    store.save();
    res.json({ ok: true, price: priceOf(p) });
  });

  // ---------- fotografije klijenta ----------
  const photoDir = (p) => path.join(DIR, p.id);

  app.post('/api/album/:token/photos', async (req, res) => {
    const p = byToken(req.params.token);
    if (!p) return res.status(404).json({ error: 'Album ne postoji.' });
    if (p.photos.length >= 300) return res.status(400).json({ error: 'Dostigli ste najveći broj fotografija (300).' });
    if (!(await ctx.runImageUpload((u) => u.array('files', 40))(req, res))) return;
    await fsp.mkdir(photoDir(p), { recursive: true });
    const added = [];
    for (const f of req.files || []) {
      try {
        const id = crypto.randomBytes(6).toString('hex');
        const big = path.join(photoDir(p), id + '.jpg');
        const small = path.join(photoDir(p), id + '-m.jpg');
        let w = 0;
        let h = 0;
        if (sharp) {
          const img = sharp(f.path).rotate();
          const meta = await img.metadata();
          w = meta.width || 0;
          h = meta.height || 0;
          await img.clone().resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 88, mozjpeg: true }).toFile(big);
          await sharp(f.path).rotate().resize({ width: 700, height: 700, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 76 }).toFile(small);
          await fsp.rm(f.path, { force: true });
        } else {
          await fsp.rename(f.path, big);
          await fsp.copyFile(big, small);
        }
        const rec = { id, w, h, at: Date.now() };
        p.photos.push(rec);
        added.push({ id, w, h, url: `/album-photo/${p.token}/${id}`, thumb: `/album-photo/${p.token}/${id}?s=m` });
      } catch {}
    }
    p.updatedAt = Date.now();
    store.save();
    res.json({ added });
  });

  app.get('/album-photo/:token/:id', (req, res) => {
    const p = byToken(req.params.token);
    const ph = p && p.photos.find((x) => x.id === req.params.id);
    if (!ph) return res.status(404).end();
    const file = path.join(photoDir(p), ph.id + (req.query.s === 'm' ? '-m' : '') + '.jpg');
    if (!fs.existsSync(file)) return res.status(404).end();
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.sendFile(file);
  });

  app.delete('/api/album/:token/photos/:id', async (req, res) => {
    const p = byToken(req.params.token);
    if (!p) return res.status(404).json({ error: 'Album ne postoji.' });
    const ph = p.photos.find((x) => x.id === req.params.id);
    if (ph) {
      for (const f of [ph.id + '.jpg', ph.id + '-m.jpg']) await fsp.rm(path.join(photoDir(p), f), { force: true });
      p.photos = p.photos.filter((x) => x !== ph);
      for (const pg of p.pages) pg.items = (pg.items || []).filter((it) => it.photoId !== ph.id);
      store.save();
    }
    res.json({ ok: true });
  });

  // ---------- porudžbina ----------
  app.post('/api/album/:token/order', async (req, res) => {
    const p = byToken(req.params.token);
    if (!p) return res.status(404).json({ error: 'Album ne postoji.' });
    const b = req.body || {};
    const name = clean(b.name, 120);
    const email = clean(b.email, 160);
    const phone = clean(b.phone, 60);
    if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !phone) return res.status(400).json({ error: 'Popunite ime, ispravan email i telefon.' });
    if (!p.photos.length) return res.status(400).json({ error: 'Album je prazan – dodajte fotografije.' });
    p.customer = { name, email, phone, note: clean(b.note, 2000) };
    p.status = 'ordered';
    p.orderedAt = Date.now();
    p.price = priceOf(p);
    store.save();

    const f = findFormat(p.formatId);
    notify({
      type: 'album',
      title: `Porudžbina albuma: ${name}`,
      text: `${f ? f.name + ' · ' + f.size : ''} · ${p.spreads} duplih strana · ${formatMoney(p.price, S().currency)}`,
      link: '#albums',
      key: 'album:' + p.id,
    });
    sendStudio(p).catch((e) => console.error('Album – email studiju nije poslat:', e.message));
    sendClient(p).catch((e) => console.error('Album – potvrda klijentu nije poslata:', e.message));
    res.json({ ok: true, price: p.price });
  });

  async function sendStudio(p) {
    const s = S();
    const to = s.notifyEmail || s.contactEmail || s.fromEmail;
    const f = findFormat(p.formatId);
    if (!to || !s.smtpHost) return;
    await mailer.sendSimple(s, {
      to,
      subject: `Nova porudžbina albuma – ${p.customer.name}`,
      body: [
        `Format: ${f ? `${f.name} (${f.size})` : '—'}`,
        `Duplih strana: ${p.spreads}`,
        `Fotografija: ${p.photos.length}`,
        `Cena: ${formatMoney(p.price, s.currency)}`,
        `Klijent: ${p.customer.name}, ${p.customer.email}, ${p.customer.phone}`,
        p.customer.note ? `\nPoruka: ${p.customer.note}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
      cta: { label: 'Otvori album', url: `${s.siteUrl || ''}/album/${p.token}` },
    });
  }

  async function sendClient(p) {
    const s = S();
    if (!s.smtpHost) return;
    const f = findFormat(p.formatId);
    await mailer.sendSimple(s, {
      to: p.customer.email,
      toName: p.customer.name,
      subject: `Vaš album je poručen – ${s.studioName}`,
      body:
        `Zdravo ${p.customer.name},\n\n` +
        `primili smo vaš album (${f ? `${f.name}, ${f.size}` : ''}, ${p.spreads} duplih strana).\n` +
        `Cena: ${formatMoney(p.price, s.currency)}\n\n` +
        `Javljamo se u najkraćem roku oko izrade i isporuke. Album možete pogledati i kasnije preko linka ispod.\n\n` +
        `Srdačan pozdrav,\n${s.studioName}`,
      cta: { label: 'Pogledaj svoj album', url: `${s.siteUrl || ''}/album/${p.token}` },
    });
  }

  // ---------- panel: formati ----------
  app.get('/api/admin/album-formats', requireAdmin, (req, res) => {
    res.json(formats().sort((a, b) => (a.order || 0) - (b.order || 0)));
  });

  app.post('/api/admin/album-formats', adminOnly, (req, res) => {
    const b = req.body || {};
    const name = clean(b.name, 60);
    if (!name) return res.status(400).json({ error: 'Upišite naziv formata.' });
    const f = {
      id: store.newId(5),
      name,
      size: clean(b.size, 20) || '21×21cm',
      w: Math.max(50, Math.round(num(b.w, 210))),
      h: Math.max(50, Math.round(num(b.h, 210))),
      spreads: Math.max(1, Math.round(num(b.spreads, 12))),
      price: num(b.price, 0),
      extraSpreadPrice: num(b.extraSpreadPrice, 0),
      cover: clean(b.cover, 60) || 'Tvrdi povez',
      active: b.active !== false,
      order: formats().length,
    };
    formats().push(f);
    store.save();
    res.json(f);
  });

  app.put('/api/admin/album-formats/:id', adminOnly, (req, res) => {
    const f = findFormat(req.params.id);
    if (!f) return res.status(404).json({ error: 'Format ne postoji.' });
    const b = req.body || {};
    for (const k of ['name', 'size', 'cover']) if (b[k] !== undefined) f[k] = clean(b[k], 60) || f[k];
    for (const k of ['w', 'h', 'spreads']) if (b[k] !== undefined) f[k] = Math.max(1, Math.round(num(b[k], f[k])));
    for (const k of ['price', 'extraSpreadPrice']) if (b[k] !== undefined) f[k] = num(b[k], f[k]);
    if (b.active !== undefined) f.active = !!b.active;
    if (b.order !== undefined) f.order = Math.round(num(b.order, f.order));
    store.save();
    res.json(f);
  });

  app.delete('/api/admin/album-formats/:id', adminOnly, (req, res) => {
    data().albumFormats = formats().filter((f) => f.id !== req.params.id);
    store.save();
    res.json({ ok: true });
  });

  // ---------- panel: porudžbine albuma ----------
  app.get('/api/admin/album-projects', requireAdmin, (req, res) => {
    const list = projects()
      .filter((p) => (req.query.all === '1' ? true : p.status !== 'draft'))
      .slice(0, 300)
      .map((p) => ({
        id: p.id,
        token: p.token,
        format: findFormat(p.formatId)?.name || '—',
        size: findFormat(p.formatId)?.size || '',
        spreads: p.spreads,
        photos: p.photos.length,
        customer: p.customer,
        status: p.status,
        price: priceOf(p),
        createdAt: p.createdAt,
        orderedAt: p.orderedAt || null,
        updatedAt: p.updatedAt,
      }));
    res.json(list);
  });

  app.put('/api/admin/album-projects/:id', requireAdmin, (req, res) => {
    const p = projects().find((x) => x.id === req.params.id);
    if (!p) return res.status(404).json({ error: 'Album ne postoji.' });
    if (['ordered', 'done', 'draft'].includes(req.body?.status)) p.status = req.body.status;
    if (req.body?.note !== undefined) p.customer.note = clean(req.body.note, 2000);
    store.save();
    res.json({ ok: true });
  });

  app.delete('/api/admin/album-projects/:id', adminOnly, async (req, res) => {
    const p = projects().find((x) => x.id === req.params.id);
    if (p) {
      await fsp.rm(photoDir(p), { recursive: true, force: true });
      data().albumProjects = projects().filter((x) => x !== p);
      store.save();
    }
    res.json({ ok: true });
  });

  // Fotografije jedne porudžbine za preuzimanje (ZIP se pravi u modulu transfers, ovde samo spisak)
  app.get('/api/admin/album-projects/:id/spec', requireAdmin, (req, res) => {
    const p = projects().find((x) => x.id === req.params.id);
    if (!p) return res.status(404).json({ error: 'Album ne postoji.' });
    res.json({ ...publicProject(p), id: p.id, photosDir: path.join('albums', p.id) });
  });

  // ---------- javne stranice ----------
  const shellFile = path.join(__dirname, '..', 'public', 'album', 'index.html');
  app.use('/album-app', require('express').static(path.join(__dirname, '..', 'public', 'album'), { maxAge: '7d' }));

  app.get(['/album', '/album/:token'], (req, res) => {
    const token = req.params.token;
    if (S().albumEnabled === false && !token) return res.status(404).type('html').send(ctx.renderMessage('Stranica ne postoji', 'Izrada albuma je trenutno isključena.', req));
    if (token && !byToken(token)) return res.status(404).type('html').send(ctx.renderMessage('Album nije pronađen', 'Link je možda istekao ili je album obrisan.', req));
    const html = fs
      .readFileSync(shellFile, 'utf8')
      .replace(/\{\{V\}\}/g, ctx.VERSION)
      .replace(/\{\{TOKEN\}\}/g, token || '')
      .replace(/\{\{STUDIO\}\}/g, esc(S().studioName));
    res.setHeader('Cache-Control', 'no-cache');
    res.type('html').send(html);
  });
};
