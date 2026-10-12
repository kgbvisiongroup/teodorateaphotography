// Prijava u administraciju: više korisnika sa ulogama, potpisan kolačić, zaboravljena lozinka.
// Uloge: 'admin' (sve) i 'staff' (saradnik: sve osim podešavanja, izgleda sajta i korisnika).
const crypto = require('crypto');
const path = require('path');
const fsp = require('fs').promises;
const DAY = 24 * 60 * 60 * 1000;
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

module.exports = function auth(ctx) {
  const { app, store } = ctx;
  const users = () => store.data.users;

  function parseCookies(req) {
    const out = {};
    (req.headers.cookie || '').split(';').forEach((p) => {
      const i = p.indexOf('=');
      if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
    });
    return out;
  }
  // Promena lozinke ili korisničkog imena poništava stare prijave tog korisnika
  const sign = (v, u) => crypto.createHmac('sha256', store.data.secret + u.hash + u.username).update(v).digest('base64url');

  function userFrom(req) {
    const c = parseCookies(req).tt_admin;
    if (!c) return null;
    const [exp, uid, s] = c.split('.');
    if (!exp || !uid || !s || !(Number(exp) > Date.now())) return null;
    const u = store.findUser(uid);
    if (!u || u.active === false) return null;
    const good = sign(exp + '.' + uid, u);
    return s.length === good.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(good)) ? u : null;
  }

  // Koliko prijava traje: obično 14 dana, a uz „Ostani prijavljen" 90 dana.
  const SESSION_DAYS = 14;
  const REMEMBER_DAYS = 90;

  function setSession(req, res, u, days = SESSION_DAYS) {
    const exp = String(Date.now() + days * DAY);
    const secure = req.secure ? '; Secure' : '';
    res.setHeader('Set-Cookie', `tt_admin=${exp}.${u.id}.${sign(exp + '.' + u.id, u)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${days * 86400}${secure}`);
  }

  // Dok se panel koristi, prijava se sama produžava (na telefonu ne traži lozinku svaki put).
  function refreshSession(req, res, u) {
    const c = parseCookies(req).tt_admin;
    const exp = Number((c || '').split('.')[0]);
    if (!exp) return;
    const left = exp - Date.now();
    const full = left > SESSION_DAYS * DAY ? REMEMBER_DAYS : SESSION_DAYS;
    if (left < (full * DAY) / 2 && !res.headersSent) setSession(req, res, u, full);
  }

  // Svaki prijavljeni korisnik
  function requireAdmin(req, res, next) {
    const u = userFrom(req);
    if (!u) return res.status(401).json({ error: 'Niste prijavljeni.' });
    req.user = u;
    refreshSession(req, res, u);
    next();
  }
  // Samo administrator
  function adminOnly(req, res, next) {
    requireAdmin(req, res, () => {
      if (req.user.role !== 'admin') return res.status(403).json({ error: 'Za ovo su potrebna administratorska prava.' });
      next();
    });
  }

  const publicUser = (u) => ({
    id: u.id,
    username: u.username,
    name: u.name || u.username,
    email: u.email || '',
    role: u.role,
    photo: u.photo ? `/media/avatar/${u.id}?v=${encodeURIComponent(u.photo)}` : null,
    active: u.active !== false,
    lastLoginAt: u.lastLoginAt || null,
    createdAt: u.createdAt || null,
  });
  ctx.publicUser = publicUser;

  // ---------- prijava ----------
  const attempts = new Map();
  app.post('/api/admin/login', (req, res) => {
    const ip = req.ip;
    const a = attempts.get(ip) || { n: 0, until: 0 };
    if (a.until > Date.now()) return res.status(429).json({ error: 'Previše pokušaja. Pokušajte ponovo za 15 minuta.' });
    const u = store.verifyLogin(req.body?.username, req.body?.password);
    if (!u) {
      a.n += 1;
      if (a.n >= 8) Object.assign(a, { n: 0, until: Date.now() + 15 * 60 * 1000 });
      attempts.set(ip, a);
      return res.status(401).json({ error: 'Pogrešno korisničko ime ili lozinka.' });
    }
    attempts.delete(ip);
    u.lastLoginAt = Date.now();
    store.save();
    setSession(req, res, u, req.body?.remember ? REMEMBER_DAYS : SESSION_DAYS);
    res.json({ ok: true });
  });

  app.post('/api/admin/logout', (req, res) => {
    res.setHeader('Set-Cookie', 'tt_admin=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0');
    res.json({ ok: true });
  });

  app.get('/api/admin/me', (req, res) => {
    const u = userFrom(req);
    res.json(u ? { authed: true, user: publicUser(u), username: u.username, defaultPassword: !!u.isDefault } : { authed: false });
  });

  // ---------- zaboravljena lozinka / pozivnica ----------
  function makeToken(u, hours) {
    const token = crypto.randomBytes(32).toString('base64url');
    store.data.resetTokens = store.data.resetTokens.filter((t) => t.exp > Date.now() && t.uid !== u.id);
    store.data.resetTokens.push({ hash: sha(token), uid: u.id, exp: Date.now() + hours * 3600e3 });
    store.save();
    return token;
  }
  async function sendResetLink(req, u, invite) {
    const s = store.settings;
    const link = `${ctx.baseUrl(req)}/admin/#reset=${makeToken(u, invite ? 72 : 1)}`;
    await ctx.mailer.sendSimple(s, {
      to: u.email,
      toName: u.name,
      subject: invite ? `Pozivnica za administraciju – ${s.studioName}` : `Nova lozinka – ${s.studioName}`,
      body: invite
        ? `Zdravo ${u.name || u.username},\n\notvoren vam je nalog u administraciji studija ${s.studioName}.\n\nKorisničko ime: ${u.username}\n\nKliknite na dugme ispod i postavite svoju lozinku. Link važi 3 dana.`
        : `Zdravo ${u.name || u.username},\n\nzatražena je nova lozinka za vaš nalog (${u.username}). Kliknite na dugme ispod i postavite novu lozinku. Link važi 1 sat.\n\nAko niste vi tražili promenu, slobodno zanemarite ovu poruku.`,
      cta: { url: link, text: invite ? 'Postavi lozinku' : 'Postavi novu lozinku' },
    });
  }
  ctx.sendResetLink = sendResetLink;

  const forgotHits = new Map();
  app.post('/api/auth/forgot', async (req, res) => {
    const ip = req.ip;
    const n = (forgotHits.get(ip) || 0) + 1;
    forgotHits.set(ip, n);
    setTimeout(() => forgotHits.delete(ip), 15 * 60 * 1000).unref();
    if (n > 5) return res.status(429).json({ error: 'Previše zahteva. Pokušajte ponovo kasnije.' });
    const u = store.findLogin(req.body?.login);
    // Isti odgovor bilo da nalog postoji ili ne
    const msg = 'Ako nalog postoji i ima upisan email, poslali smo link za novu lozinku.';
    if (u && u.email) {
      try {
        await sendResetLink(req, u, false);
      } catch (e) {
        console.error('Link za lozinku nije poslat:', e.message);
      }
    }
    res.json({ ok: true, message: msg });
  });

  app.post('/api/auth/reset', (req, res) => {
    const { token, password } = req.body || {};
    const t = store.data.resetTokens.find((x) => x.hash === sha(token || '') && x.exp > Date.now());
    const u = t && store.findUser(t.uid);
    if (!u) return res.status(400).json({ error: 'Link je istekao ili je već iskorišćen. Zatražite novi.' });
    if (!password || String(password).length < 8) return res.status(400).json({ error: 'Lozinka mora imati bar 8 znakova.' });
    store.setPassword(u, password);
    u.active = true;
    store.data.resetTokens = store.data.resetTokens.filter((x) => x !== t);
    store.save();
    setSession(req, res, u);
    res.json({ ok: true });
  });

  // ---------- moj profil ----------
  const emailOk = (e) => !e || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  const usernameOk = (u) => /^[\p{L}\d._@-]{3,40}$/u.test(u);

  app.put('/api/admin/profile', requireAdmin, (req, res) => {
    const u = req.user;
    const name = String(req.body?.name ?? u.name).trim().slice(0, 80);
    const email = String(req.body?.email ?? u.email).trim().slice(0, 200);
    if (!emailOk(email)) return res.status(400).json({ error: 'Email adresa nije ispravna.' });
    if (email && users().some((x) => x !== u && x.email && x.email.toLowerCase() === email.toLowerCase()))
      return res.status(400).json({ error: 'Taj email već koristi drugi korisnik.' });
    Object.assign(u, { name, email });
    store.save();
    res.json(publicUser(u));
  });

  app.put('/api/admin/account', requireAdmin, (req, res) => {
    const u = req.user;
    const { current, username, next } = req.body || {};
    if (!store.checkHash(u, current || '')) return res.status(400).json({ error: 'Trenutna lozinka nije tačna.' });
    const un = String(username ?? u.username).trim();
    if (!usernameOk(un)) return res.status(400).json({ error: 'Korisničko ime: 3 do 40 znakova, bez razmaka.' });
    if (users().some((x) => x !== u && x.username.toLowerCase() === un.toLowerCase())) return res.status(400).json({ error: 'To korisničko ime je zauzeto.' });
    if (next && String(next).length < 8) return res.status(400).json({ error: 'Nova lozinka mora imati bar 8 znakova.' });
    u.username = un;
    if (next) store.setPassword(u, next);
    store.save();
    setSession(req, res, u);
    res.json({ ok: true, user: publicUser(u) });
  });

  // Slika profila (kvadrat 256 px, prikazuje se u krugu)
  app.post('/api/admin/profile/photo', requireAdmin, async (req, res) => {
    if (!(await ctx.runImageUpload((up) => up.single('photo'))(req, res))) return;
    if (!req.file) return res.status(400).json({ error: 'Izaberite sliku.' });
    const u = req.user;
    const out = `avatar-${u.id}-${Date.now()}.jpg`;
    try {
      if (ctx.sharp) {
        await ctx.sharp(req.file.path).rotate().resize(256, 256, { fit: 'cover', position: 'attention' }).jpeg({ quality: 85 }).toFile(path.join(ctx.BRAND_DIR, out));
        await fsp.rm(req.file.path, { force: true });
      } else await fsp.rename(req.file.path, path.join(ctx.BRAND_DIR, out));
    } catch {
      await fsp.rm(req.file.path, { force: true });
      return res.status(400).json({ error: 'Slika nije mogla da se obradi.' });
    }
    if (u.photo) await fsp.rm(path.join(ctx.BRAND_DIR, u.photo), { force: true });
    u.photo = out;
    store.save();
    res.json(publicUser(u));
  });
  app.delete('/api/admin/profile/photo', requireAdmin, async (req, res) => {
    const u = req.user;
    if (u.photo) await fsp.rm(path.join(ctx.BRAND_DIR, u.photo), { force: true });
    u.photo = null;
    store.save();
    res.json(publicUser(u));
  });
  app.get('/media/avatar/:id', requireAdmin, (req, res) => {
    const u = store.findUser(req.params.id);
    if (!u?.photo) return res.status(404).end();
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    res.sendFile(path.join(ctx.BRAND_DIR, u.photo));
  });

  // ---------- korisnici portala (samo administrator) ----------
  const admins = () => users().filter((u) => u.role === 'admin' && u.active !== false);
  app.get('/api/admin/users', adminOnly, (req, res) => res.json(users().map(publicUser)));

  app.post('/api/admin/users', adminOnly, async (req, res) => {
    const b = req.body || {};
    const username = String(b.username || '').trim();
    const email = String(b.email || '').trim();
    if (!usernameOk(username)) return res.status(400).json({ error: 'Korisničko ime: 3 do 40 znakova, bez razmaka.' });
    if (users().some((x) => x.username.toLowerCase() === username.toLowerCase())) return res.status(400).json({ error: 'To korisničko ime je zauzeto.' });
    if (!emailOk(email)) return res.status(400).json({ error: 'Email adresa nije ispravna.' });
    if (email && users().some((x) => x.email && x.email.toLowerCase() === email.toLowerCase())) return res.status(400).json({ error: 'Taj email već koristi drugi korisnik.' });
    if (!b.password && !email) return res.status(400).json({ error: 'Upišite lozinku ili email na koji stiže pozivnica.' });
    if (b.password && String(b.password).length < 8) return res.status(400).json({ error: 'Lozinka mora imati bar 8 znakova.' });
    const u = {
      id: crypto.randomBytes(6).toString('hex'),
      username,
      name: String(b.name || '').trim().slice(0, 80) || username,
      email,
      role: b.role === 'admin' ? 'admin' : 'staff',
      ...store.hashPassword(b.password || crypto.randomBytes(24).toString('hex')),
      photo: null,
      active: true,
      createdAt: Date.now(),
    };
    users().push(u);
    store.save();
    let invite = null;
    if (!b.password && email) {
      try {
        await sendResetLink(req, u, true);
        invite = 'sent';
      } catch (e) {
        invite = e.message;
      }
    }
    res.json({ ...publicUser(u), invite });
  });

  app.put('/api/admin/users/:id', adminOnly, (req, res) => {
    const u = store.findUser(req.params.id);
    if (!u) return res.status(404).json({ error: 'Korisnik ne postoji.' });
    const b = req.body || {};
    const role = b.role === 'admin' ? 'admin' : b.role === 'staff' ? 'staff' : u.role;
    const active = b.active === undefined ? u.active !== false : !!b.active;
    if (u.role === 'admin' && (role !== 'admin' || !active) && admins().length <= 1) return res.status(400).json({ error: 'Mora postojati bar jedan aktivan administrator.' });
    const email = String(b.email ?? u.email).trim();
    if (!emailOk(email)) return res.status(400).json({ error: 'Email adresa nije ispravna.' });
    Object.assign(u, { name: String(b.name ?? u.name).trim().slice(0, 80), email, role, active });
    if (b.password) {
      if (String(b.password).length < 8) return res.status(400).json({ error: 'Lozinka mora imati bar 8 znakova.' });
      store.setPassword(u, b.password);
    }
    store.save();
    res.json(publicUser(u));
  });

  app.post('/api/admin/users/:id/reset', adminOnly, async (req, res) => {
    const u = store.findUser(req.params.id);
    if (!u) return res.status(404).json({ error: 'Korisnik ne postoji.' });
    if (!u.email) return res.status(400).json({ error: 'Korisnik nema upisan email.' });
    try {
      await sendResetLink(req, u, false);
      res.json({ ok: true });
    } catch (e) {
      res.status(502).json({ error: 'Email nije poslat: ' + e.message });
    }
  });

  app.delete('/api/admin/users/:id', adminOnly, async (req, res) => {
    const u = store.findUser(req.params.id);
    if (!u) return res.status(404).json({ error: 'Korisnik ne postoji.' });
    if (u === req.user) return res.status(400).json({ error: 'Ne možete obrisati sopstveni nalog.' });
    if (u.role === 'admin' && admins().length <= 1) return res.status(400).json({ error: 'Mora postojati bar jedan aktivan administrator.' });
    if (u.photo) await fsp.rm(path.join(ctx.BRAND_DIR, u.photo), { force: true });
    store.data.users = users().filter((x) => x !== u);
    store.save();
    res.json({ ok: true });
  });

  ctx.every(() => {
    const before = store.data.resetTokens.length;
    store.data.resetTokens = store.data.resetTokens.filter((t) => t.exp > Date.now());
    if (before !== store.data.resetTokens.length) store.save();
  });

  return { requireAdmin, adminOnly, userFrom };
};
