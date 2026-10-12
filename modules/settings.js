// Podešavanja (sva polja iz store.DEFAULT_SETTINGS) i probni email. Samo administrator.
module.exports = (ctx) => {
  const { app, store, mailer, adminOnly } = ctx;
  const KEYS = Object.keys(store.DEFAULT_SETTINGS);
  const LIMITS = { retentionDays: [1, 30], processingDays: [1, 60], reminderHour: [0, 23], smtpPort: [1, 65535], imapPort: [1, 65535] };
  const SECRET = ['smtpPass', 'imapPass'];

  app.get('/api/admin/settings', adminOnly, (req, res) => {
    const s = { ...store.settings, smtpPass: '', imapPass: '', hasSmtpPass: !!store.settings.smtpPass, hasImapPass: !!store.settings.imapPass };
    res.json({ settings: s, detectedUrl: `${req.protocol}://${req.get('host')}` });
  });

  app.put('/api/admin/settings', adminOnly, (req, res) => {
    const b = req.body || {};
    const s = store.settings;
    const mailChanged = Object.keys(b).some((k) => k.startsWith('imap') || k.startsWith('smtp'));
    for (const k of KEYS) {
      if (!(k in b)) continue;
      if (SECRET.includes(k) && !b[k]) continue; // prazno = ne menjaj
      const def = store.DEFAULT_SETTINGS[k];
      if (Array.isArray(def)) {
        const arr = Array.isArray(b[k]) ? b[k] : String(b[k] || '').split('\n');
        s[k] = arr.map((x) => String(x).trim().slice(0, 160)).filter(Boolean).slice(0, 30);
      } else if (typeof def === 'boolean') s[k] = !!b[k];
      else if (typeof def === 'number') {
        const n = Math.round(Number(b[k]));
        const [lo, hi] = LIMITS[k] || [-Infinity, Infinity];
        s[k] = Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def;
      } else s[k] = String(b[k] ?? '').slice(0, 5000);
    }
    if (!/^#[0-9a-f]{6}$/i.test(s.accentColor)) s.accentColor = store.DEFAULT_SETTINGS.accentColor;
    s.currency = ['EUR', 'RSD', 'USD', 'CHF'].includes(s.currency) ? s.currency : 'EUR';
    s.cardPrefix = s.cardPrefix.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'TPS';
    store.save();
    if (mailChanged) ctx.services.mail?.reset();
    res.json({ ok: true });
  });

  app.post('/api/admin/settings/test-email', adminOnly, async (req, res) => {
    const to = String(req.body?.to || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return res.status(400).json({ error: 'Unesite ispravnu email adresu.' });
    try {
      await mailer.sendTest(store.settings, to);
      res.json({ ok: true });
    } catch (e) {
      res.status(502).json({ error: e.message });
    }
  });
};
