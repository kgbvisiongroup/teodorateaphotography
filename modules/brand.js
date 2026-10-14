// Brend: logo, ikonica, boja (tema) i pozadinske fotografije početne strane.
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const crypto = require('crypto');
const multer = require('multer');
const { themeCss } = require('../lib/util');

module.exports = (ctx) => {
  const { app, store, requireAdmin, adminOnly, sharp, BRAND_DIR, ASSETS } = ctx;

  const brandFile = (kind) => {
    const custom = store.data.brand[kind];
    if (custom && fs.existsSync(path.join(BRAND_DIR, custom))) return path.join(BRAND_DIR, custom);
    return path.join(ASSETS, kind === 'icon' ? 'icon.png' : 'logo.png');
  };
  ctx.brandFile = brandFile;
  ctx.mailer.setLogoResolver(() => brandFile('logo'));
  ctx.site = () => ({ s: store.settings, v: store.data.brand.v, bgs: store.data.backgrounds });

  // Zajednički upload slika (logo, pozadine, scenografije)
  const IMG_TYPES = ['.jpg', '.jpeg', '.png', '.webp'];
  const imageUpload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, BRAND_DIR),
      filename: (req, file, cb) => cb(null, 'up-' + crypto.randomBytes(6).toString('hex') + path.extname(file.originalname).toLowerCase()),
    }),
    limits: { fileSize: 200 * 1024 * 1024, files: 100 },
    fileFilter: (req, file, cb) => {
      if (IMG_TYPES.includes(path.extname(file.originalname).toLowerCase())) return cb(null, true);
      const err = new Error('Dozvoljene su slike JPG, PNG ili WEBP.');
      err.status = 400;
      cb(err);
    },
  });
  ctx.runImageUpload = (mw) => (req, res) =>
    new Promise((resolve) =>
      mw(imageUpload)(req, res, (err) => {
        if (err) res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Slika je prevelika (najviše 200 MB).' : err.message });
        resolve(!err);
      })
    );
  // Smanji i sačuvaj sliku; vraća ime fajla u BRAND_DIR.
  // Za sajt se koristi WebP (upola manji fajlovi uz isti kvalitet, a svi pregledači ga podržavaju).
  const EXT = { png: 'png', webp: 'webp', jpeg: 'jpg' };
  ctx.saveImage = async (tmpPath, prefix, { width = 2600, height = 2600, fmt = 'jpeg', quality } = {}) => {
    const out = `${prefix}-${crypto.randomBytes(6).toString('hex')}.${EXT[fmt] || 'jpg'}`;
    try {
      if (sharp) {
        let img = sharp(tmpPath).rotate().resize({ width, height, fit: 'inside', withoutEnlargement: true });
        if (fmt === 'png') img = img.png();
        else if (fmt === 'webp') img = img.webp({ quality: quality || 82 });
        else img = img.jpeg({ quality: quality || 84, mozjpeg: true });
        await img.toFile(path.join(BRAND_DIR, out));
        await fsp.rm(tmpPath, { force: true });
      } else await fsp.rename(tmpPath, path.join(BRAND_DIR, out));
      return out;
    } catch (e) {
      await fsp.rm(tmpPath, { force: true });
      throw e;
    }
  };

  // ---------- javno ----------
  app.get('/brand/theme.css', (req, res) => {
    res.setHeader('Cache-Control', req.query.v ? 'public, max-age=31536000, immutable' : 'no-cache');
    res.type('css').send(themeCss(store.settings.accentColor));
  });
  for (const kind of ['logo', 'icon']) {
    app.get('/brand/' + kind, (req, res) => {
      res.setHeader('Cache-Control', req.query.v ? 'public, max-age=31536000, immutable' : 'public, max-age=3600');
      res.sendFile(brandFile(kind));
    });
  }
  app.get('/brand/bg/:id', (req, res) => {
    const b = store.data.backgrounds.find((x) => x.id === req.params.id);
    if (!b) return res.status(404).end();
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.sendFile(path.join(BRAND_DIR, b.file));
  });
  // Panel kao aplikacija na telefonu (Dodaj na početni ekran)
  app.get('/admin/manifest.webmanifest', (req, res) => {
    const s = store.settings;
    res.setHeader('Cache-Control', 'no-cache');
    res.type('application/manifest+json').json({
      name: `${s.studioName} – administracija`,
      short_name: s.studioName.split(' ')[0] || 'Studio',
      description: 'Zakazivanja, ponude, vaučeri i slanje fotografija.',
      start_url: '/admin/',
      scope: '/admin/',
      display: 'standalone',
      orientation: 'portrait-primary',
      background_color: '#fdf8f6',
      theme_color: s.accentColor,
      lang: 'sr',
      icons: [
        { src: `/brand/icon?v=${store.data.brand.v}`, sizes: 'any', type: 'image/png', purpose: 'any' },
      ],
    });
  });

  app.get('/api/brand', (req, res) => {
    const s = store.settings;
    res.json({ studioName: s.studioName, accentColor: s.accentColor, v: store.data.brand.v });
  });

  // ---------- admin: logo i ikonica ----------
  app.post('/api/admin/brand/:kind', adminOnly, async (req, res) => {
    const kind = req.params.kind;
    if (!['logo', 'icon'].includes(kind)) return res.status(404).json({ error: 'Nepoznato.' });
    if (!(await ctx.runImageUpload((u) => u.single('file'))(req, res))) return;
    if (!req.file) return res.status(400).json({ error: 'Izaberite sliku.' });
    const out = `${kind}-${Date.now()}.png`;
    try {
      if (sharp) {
        let img = sharp(req.file.path).rotate();
        if (kind === 'logo') img = img.trim().resize({ width: 1400, height: 600, fit: 'inside', withoutEnlargement: true });
        else img = img.resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } });
        await img.png({ compressionLevel: 9 }).toFile(path.join(BRAND_DIR, out));
        await fsp.rm(req.file.path, { force: true });
      } else await fsp.rename(req.file.path, path.join(BRAND_DIR, out));
    } catch {
      await fsp.rm(req.file.path, { force: true });
      return res.status(400).json({ error: 'Slika nije mogla da se obradi.' });
    }
    const old = store.data.brand[kind];
    if (old) await fsp.rm(path.join(BRAND_DIR, old), { force: true });
    store.data.brand[kind] = out;
    store.data.brand.v += 1;
    store.save();
    res.json({ ok: true, v: store.data.brand.v });
  });

  app.delete('/api/admin/brand/:kind', adminOnly, async (req, res) => {
    const kind = req.params.kind;
    if (!['logo', 'icon'].includes(kind)) return res.status(404).json({ error: 'Nepoznato.' });
    const old = store.data.brand[kind];
    if (old) await fsp.rm(path.join(BRAND_DIR, old), { force: true });
    store.data.brand[kind] = null;
    store.data.brand.v += 1;
    store.save();
    res.json({ ok: true, v: store.data.brand.v });
  });

  // ---------- admin: pozadinske fotografije ----------
  const bgList = () => store.data.backgrounds.map((b) => ({ id: b.id, url: `/brand/bg/${b.id}` }));
  app.get('/api/admin/backgrounds', requireAdmin, (req, res) => res.json(bgList()));

  app.post('/api/admin/backgrounds', adminOnly, async (req, res) => {
    if (!(await ctx.runImageUpload((u) => u.array('files', 30))(req, res))) return;
    for (const f of req.files || []) {
      try {
        const file = await ctx.saveImage(f.path, 'bg');
        store.data.backgrounds.push({ id: crypto.randomBytes(6).toString('hex'), file });
      } catch {}
    }
    store.save();
    res.json(bgList());
  });

  app.put('/api/admin/backgrounds/order', adminOnly, (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const map = new Map(store.data.backgrounds.map((b) => [b.id, b]));
    const sorted = ids.map((id) => map.get(id)).filter(Boolean);
    store.data.backgrounds = [...sorted, ...store.data.backgrounds.filter((b) => !ids.includes(b.id))];
    store.save();
    res.json({ ok: true });
  });

  app.delete('/api/admin/backgrounds/:id', adminOnly, async (req, res) => {
    const b = store.data.backgrounds.find((x) => x.id === req.params.id);
    if (!b) return res.status(404).json({ error: 'Ne postoji.' });
    await fsp.rm(path.join(BRAND_DIR, b.file), { force: true });
    store.data.backgrounds = store.data.backgrounds.filter((x) => x !== b);
    store.save();
    res.json({ ok: true });
  });
};
