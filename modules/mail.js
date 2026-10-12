// Pošta: sinhronizacija sa mail serverom preko IMAP-a (folderi, čitanje, premeštanje, spam, brisanje)
// i slanje preko SMTP naloga iz podešavanja. Ništa se ne kopira lokalno – sve izmene su odmah na serveru,
// pa se vide i u telefonu, Gmail-u, Outlook-u...
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const MailComposer = require('nodemailer/lib/mail-composer');
const multer = require('multer');

const SPECIAL = {
  '\\Inbox': ['Primljeno', 0],
  '\\Flagged': ['Sa zvezdicom', 1],
  '\\Sent': ['Poslato', 2],
  '\\Drafts': ['Nacrti', 3],
  '\\Junk': ['Spam', 4],
  '\\Trash': ['Kanta', 5],
  '\\Archive': ['Arhiva', 6],
  '\\All': ['Sve poruke', 7],
};
const PER_PAGE = 40;
const addrOk = (a) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(a);

module.exports = (ctx) => {
  const { app, store, mailer, requireAdmin } = ctx;
  const S = () => store.settings;

  function cfg() {
    const s = S();
    const same = s.imapSameLogin;
    return { host: s.imapHost.trim(), port: Number(s.imapPort) || 993, secure: !!s.imapSecure, user: (same ? s.smtpUser : s.imapUser).trim(), pass: same ? s.smtpPass : s.imapPass };
  }
  const configured = () => {
    const c = cfg();
    return !!(c.host && c.user && c.pass);
  };

  // ---------- jedna stalna veza sa serverom ----------
  let client = null;
  let connecting = null;
  let lastError = null;
  let unread = null;
  let folderCache = null;

  function friendly(e) {
    const m = `${e.message || ''} ${e.responseText || ''} ${e.code || ''}`;
    if (e.authenticationFailed || /AUTHENTICATIONFAILED|Invalid credentials|authentication failed|LOGIN failed/i.test(m))
      return 'Prijava na mail server nije uspela. Proverite korisničko ime i lozinku (za Gmail: lozinka za aplikacije i uključen IMAP).';
    if (/ENOTFOUND|EAI_AGAIN/.test(m)) return 'Mail server nije pronađen. Proverite adresu servera.';
    if (/ECONNREFUSED|ETIMEDOUT|timeout|Timed out/i.test(m)) return 'Mail server ne odgovara. Proverite adresu, port i SSL podešavanje.';
    if (/certificate|SSL|TLS/i.test(m)) return 'Problem sa SSL vezom. Proverite port (993 sa SSL, 143 bez).';
    return e.responseText || e.message || 'Greška na mail serveru.';
  }

  async function getClient() {
    if (!configured()) {
      const e = new Error('Pošta još nije podešena (Email → Pošta).');
      e.status = 400;
      throw e;
    }
    if (client?.usable) return client;
    if (connecting) return connecting;
    connecting = (async () => {
      const c = cfg();
      const cl = new ImapFlow({
        host: c.host,
        port: c.port,
        secure: c.secure,
        auth: { user: c.user, pass: c.pass },
        logger: false,
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 5 * 60 * 1000,
      });
      cl.on('error', (e) => (lastError = friendly(e)));
      cl.on('close', () => {
        if (client === cl) client = null;
      });
      await cl.connect();
      client = cl;
      lastError = null;
      return cl;
    })().catch((e) => {
      lastError = friendly(e);
      throw e;
    }).finally(() => (connecting = null));
    return connecting;
  }

  function reset() {
    const c = client;
    client = null;
    folderCache = null;
    unread = null;
    lastError = null;
    if (c) c.logout().catch(() => c.close());
  }
  ctx.services.mail = { reset, unread: () => unread };

  const isConnErr = (e) => /closed|ECONNRESET|EPIPE|not available|NoConnection|Socket/i.test(`${e.message} ${e.code}`);

  // Posao na serveru, uz jedan ponovni pokušaj ako je veza u međuvremenu pukla
  async function withClient(fn) {
    for (let i = 0; ; i++) {
      const c = await getClient();
      try {
        return await fn(c);
      } catch (e) {
        if (i === 0 && isConnErr(e)) {
          reset();
          continue;
        }
        throw e;
      }
    }
  }
  function withBox(path, fn) {
    return withClient(async (c) => {
      const lock = await c.getMailboxLock(path);
      try {
        return await fn(c, c.mailbox);
      } finally {
        lock.release();
      }
    });
  }

  // Greške pretvaramo u razumljive poruke
  const wrap = (fn) => async (req, res) => {
    try {
      await fn(req, res);
    } catch (e) {
      if (res.headersSent) return;
      res.status(e.status || 502).json({ error: e.status ? e.message : friendly(e) });
    }
  };

  // ---------- folderi ----------
  async function folders(force) {
    if (folderCache && !force && Date.now() - folderCache.at < 20000) return folderCache.list;
    const list = await withClient((c) => c.list({ statusQuery: { messages: true, unseen: true } }));
    const out = list
      .filter((f) => !f.flags?.has('\\Noselect') && !f.flags?.has('\\NonExistent'))
      .map((f) => {
        const sp = f.path.toUpperCase() === 'INBOX' ? '\\Inbox' : f.specialUse || null;
        return {
          path: f.path,
          name: SPECIAL[sp]?.[0] || f.name,
          special: sp,
          total: f.status?.messages || 0,
          unseen: f.status?.unseen || 0,
          delimiter: f.delimiter,
          depth: sp ? 0 : Math.max(0, f.path.split(f.delimiter || '/').length - 1 - (/^\[Gmail\]/.test(f.path) ? 1 : 0)),
        };
      })
      .sort((a, b) => (SPECIAL[a.special]?.[1] ?? 50) - (SPECIAL[b.special]?.[1] ?? 50) || a.path.localeCompare(b.path, 'sr'));
    unread = out.find((f) => f.special === '\\Inbox')?.unseen ?? unread;
    folderCache = { at: Date.now(), list: out };
    return out;
  }
  const special = async (use) => (await folders()).find((f) => f.special === use)?.path || null;

  // ---------- pomoćne za poruke ----------
  const addr = (list) => (list || []).map((a) => ({ name: a.name || '', address: a.address || '' }));
  function hasAttachment(bs) {
    if (!bs) return false;
    if (bs.childNodes) return bs.childNodes.some(hasAttachment);
    const name = bs.dispositionParameters?.filename || bs.parameters?.name;
    return bs.disposition === 'attachment' || (!!name && !/^text\/(plain|html)$/i.test(bs.type));
  }
  function summary(m) {
    const e = m.envelope || {};
    return {
      uid: m.uid,
      seq: m.seq,
      subject: e.subject || '(bez naslova)',
      from: addr(e.from)[0] || { name: '', address: '' },
      to: addr(e.to),
      date: (e.date || m.internalDate || new Date()).valueOf(),
      seen: m.flags?.has('\\Seen') || false,
      flagged: m.flags?.has('\\Flagged') || false,
      answered: m.flags?.has('\\Answered') || false,
      attachment: hasAttachment(m.bodyStructure),
      size: m.size || 0,
    };
  }
  async function fetchList(c, range, byUid) {
    const items = [];
    for await (const m of c.fetch(range, { uid: true, envelope: true, flags: true, size: true, bodyStructure: true, internalDate: true }, { uid: byUid })) items.push(summary(m));
    return items;
  }

  // Raspakovane poruke pamtimo kratko (za priloge i prosleđivanje)
  const parsedCache = new Map();
  async function parsed(folder, uid) {
    const key = folder + '\n' + uid;
    if (parsedCache.has(key)) return parsedCache.get(key);
    const p = await withBox(folder, async (c) => {
      const m = await c.fetchOne(String(uid), { source: true, flags: true }, { uid: true });
      if (!m) {
        const e = new Error('Poruka više ne postoji na serveru.');
        e.status = 404;
        throw e;
      }
      const msg = await simpleParser(m.source);
      msg._seen = m.flags?.has('\\Seen');
      return msg;
    });
    parsedCache.set(key, p);
    if (parsedCache.size > 25) parsedCache.delete(parsedCache.keys().next().value);
    return p;
  }

  // HTML poruke se prikazuje u zaštićenom okviru; slike iz priloga (cid:) ugrađujemo direktno
  function prepareHtml(p) {
    let html = typeof p.html === 'string' ? p.html : '';
    if (!html) return { html: '', remote: false };
    for (const a of p.attachments || []) {
      if (!a.contentId || a.size > 3 * 1024 * 1024) continue;
      const cid = a.contentId.replace(/^<|>$/g, '');
      html = html.split('cid:' + cid).join(`data:${a.contentType};base64,${a.content.toString('base64')}`);
    }
    // Skripte i forme se uklanjaju (dodatno, okvir za prikaz ih ionako ne izvršava)
    html = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<\/?(form|iframe|object|embed)[^>]*>/gi, '').replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    const remote = /<img[^>]+src\s*=\s*["']?\s*https?:|url\(\s*["']?https?:/i.test(html);
    return { html, remote };
  }

  // ---------- API ----------
  app.get('/api/admin/mail/status', requireAdmin, async (req, res) => {
    if (!configured()) return res.json({ configured: false });
    try {
      await getClient();
      res.json({ configured: true, ok: true, user: cfg().user });
    } catch (e) {
      res.json({ configured: true, ok: false, error: friendly(e) });
    }
  });

  app.get('/api/admin/mail/folders', requireAdmin, wrap(async (req, res) => res.json(await folders(true))));

  app.get('/api/admin/mail/messages', requireAdmin, wrap(async (req, res) => {
    const folder = String(req.query.folder || 'INBOX');
    const page = Math.max(1, Number(req.query.page) || 1);
    const q = String(req.query.q || '').trim().slice(0, 100);
    const out = await withBox(folder, async (c, box) => {
      if (q) {
        const uids = ((await c.search({ or: [{ subject: q }, { from: q }, { to: q }, { body: q }] }, { uid: true })) || []).sort((a, b) => b - a);
        const pageUids = uids.slice((page - 1) * PER_PAGE, page * PER_PAGE);
        const items = pageUids.length ? await fetchList(c, pageUids.join(','), true) : [];
        items.sort((a, b) => b.uid - a.uid);
        return { total: uids.length, items };
      }
      const total = box.exists || 0;
      const end = total - (page - 1) * PER_PAGE;
      if (end < 1) return { total, items: [] };
      const items = await fetchList(c, `${Math.max(1, end - PER_PAGE + 1)}:${end}`, false);
      items.sort((a, b) => b.seq - a.seq);
      return { total, items };
    });
    res.json({ ...out, page, pages: Math.max(1, Math.ceil(out.total / PER_PAGE)) });
  }));

  app.get('/api/admin/mail/message', requireAdmin, wrap(async (req, res) => {
    const folder = String(req.query.folder || 'INBOX');
    const uid = Number(req.query.uid);
    const p = await parsed(folder, uid);
    if (!p._seen) {
      await withBox(folder, (c) => c.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true })).catch(() => {});
      p._seen = true;
      folderCache = null;
    }
    const { html, remote } = prepareHtml(p);
    res.json({
      uid,
      folder,
      subject: p.subject || '(bez naslova)',
      from: addr(p.from?.value),
      to: addr(p.to?.value || (Array.isArray(p.to) ? p.to.flatMap((x) => x.value) : [])),
      cc: addr(p.cc?.value),
      replyTo: addr(p.replyTo?.value),
      date: (p.date || new Date()).valueOf(),
      messageId: p.messageId || '',
      references: [].concat(p.references || []),
      html,
      remote,
      text: p.text || '',
      textHtml: p.textAsHtml || '',
      attachments: (p.attachments || [])
        .map((a, i) => ({ idx: i, filename: a.filename || `prilog-${i + 1}`, contentType: a.contentType, size: a.size, inline: !!a.related }))
        .filter((a) => !a.inline),
    });
  }));

  app.get('/api/admin/mail/attachment', requireAdmin, wrap(async (req, res) => {
    const p = await parsed(String(req.query.folder || 'INBOX'), Number(req.query.uid));
    const a = (p.attachments || [])[Number(req.query.idx)];
    if (!a) return res.status(404).json({ error: 'Prilog ne postoji.' });
    res.attachment(a.filename || 'prilog');
    res.type(a.contentType || 'application/octet-stream');
    res.send(a.content);
  }));

  app.post('/api/admin/mail/action', requireAdmin, wrap(async (req, res) => {
    const { folder = 'INBOX', action, target } = req.body || {};
    const uids = (Array.isArray(req.body?.uids) ? req.body.uids : []).map(Number).filter((n) => n > 0);
    if (!uids.length) return res.status(400).json({ error: 'Nije izabrana nijedna poruka.' });
    const range = uids.join(',');
    const o = { uid: true };
    let dest = null;
    if (action === 'move') dest = target;
    if (action === 'spam') {
      dest = await special('\\Junk');
      if (!dest) return res.status(400).json({ error: 'Na ovom nalogu nema Spam foldera.' });
    }
    if (action === 'notspam') dest = 'INBOX';
    let hardDelete = false;
    if (action === 'delete') {
      const trash = await special('\\Trash');
      if (!trash || folder === trash) hardDelete = true;
      else dest = trash;
    }
    await withBox(folder, async (c) => {
      if (action === 'read') await c.messageFlagsAdd(range, ['\\Seen'], o);
      else if (action === 'unread') await c.messageFlagsRemove(range, ['\\Seen'], o);
      else if (action === 'flag') await c.messageFlagsAdd(range, ['\\Flagged'], o);
      else if (action === 'unflag') await c.messageFlagsRemove(range, ['\\Flagged'], o);
      else if (hardDelete) await c.messageDelete(range, o);
      else if (dest) {
        if (dest === folder) return;
        await c.messageMove(range, dest, o);
      } else {
        const e = new Error('Nepoznata radnja.');
        e.status = 400;
        throw e;
      }
    });
    for (const u of uids) parsedCache.delete(folder + '\n' + u);
    folderCache = null;
    res.json({ ok: true, moved: !!dest, deleted: hardDelete });
  }));

  // Sopstveni folderi: novi, preimenovanje, brisanje
  app.post('/api/admin/mail/folders', requireAdmin, wrap(async (req, res) => {
    const name = String(req.body?.name || '').trim().replace(/[/\\]/g, '-').slice(0, 60);
    if (!name) return res.status(400).json({ error: 'Upišite naziv foldera.' });
    const list = await folders();
    const parent = list.find((f) => f.path === req.body?.parent);
    const path = parent ? parent.path + (parent.delimiter || '/') + name : name;
    await withClient((c) => c.mailboxCreate(path));
    folderCache = null;
    res.json(await folders(true));
  }));
  app.put('/api/admin/mail/folders', requireAdmin, wrap(async (req, res) => {
    const list = await folders();
    const f = list.find((x) => x.path === req.body?.path);
    const name = String(req.body?.name || '').trim().replace(/[/\\]/g, '-').slice(0, 60);
    if (!f || f.special) return res.status(400).json({ error: 'Ovaj folder ne može da se preimenuje.' });
    if (!name) return res.status(400).json({ error: 'Upišite naziv foldera.' });
    const parts = f.path.split(f.delimiter || '/');
    parts[parts.length - 1] = name;
    await withClient((c) => c.mailboxRename(f.path, parts.join(f.delimiter || '/')));
    folderCache = null;
    res.json(await folders(true));
  }));
  app.delete('/api/admin/mail/folders', requireAdmin, wrap(async (req, res) => {
    const list = await folders();
    const f = list.find((x) => x.path === req.query.path);
    if (!f || f.special) return res.status(400).json({ error: 'Ovaj folder ne može da se obriše.' });
    await withClient((c) => c.mailboxDelete(f.path));
    folderCache = null;
    res.json(await folders(true));
  }));

  // Adrese za brzi unos: klijenti iz zakazivanja, vaučera i slanja
  app.get('/api/admin/mail/contacts', requireAdmin, (req, res) => {
    const map = new Map();
    const add = (name, email) => {
      if (email && addrOk(email) && !map.has(email.toLowerCase())) map.set(email.toLowerCase(), { name: name || '', email });
    };
    for (const b of store.data.bookings.slice(-500)) add(b.parentName || `${b.firstName} ${b.lastName}`, b.email);
    for (const t of store.data.transfers) add(`${t.firstName} ${t.lastName}`, t.email);
    for (const v of store.data.vouchers) add(v.recipientName, v.email);
    res.json([...map.values()]);
  });

  // ---------- slanje ----------
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024, files: 10 }, defParamCharset: 'utf8' });
  const splitAddr = (v) =>
    String(v || '')
      .split(/[,;]+/)
      .map((x) => x.trim())
      .filter(Boolean);
  const bare = (a) => (a.match(/<([^>]+)>/)?.[1] || a).trim();
  const escHtml = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  app.post('/api/admin/mail/send', requireAdmin, (req, res, next) => upload.array('files', 10)(req, res, (err) => (err ? res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Prilog je veći od 20 MB.' : err.message }) : next())), wrap(async (req, res) => {
    const b = req.body || {};
    const to = splitAddr(b.to), cc = splitAddr(b.cc), bcc = splitAddr(b.bcc);
    const all = [...to, ...cc, ...bcc];
    if (!to.length) return res.status(400).json({ error: 'Upišite kome šaljete.' });
    const bad = all.find((a) => !addrOk(bare(a)));
    if (bad) return res.status(400).json({ error: `Adresa „${bad}“ nije ispravna.` });
    const s = S();
    const sig = s.mailSignature ? '\n\n--\n' + s.mailSignature : '';
    const text = String(b.body || '') + sig;
    const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#222;">${escHtml(text)
      .split(/\n{2,}/)
      .map((p) => `<p style="margin:0 0 12px;">${p.replace(/\n/g, '<br>')}</p>`)
      .join('')}</div>`;
    const attachments = (req.files || []).map((f) => ({ filename: f.originalname, content: f.buffer, contentType: f.mimetype }));
    // Prosleđivanje: prilozi originalne poruke idu uz novu
    if (b.fwdUid && b.fwdFolder && b.fwdAttachments === '1') {
      const orig = await parsed(String(b.fwdFolder), Number(b.fwdUid));
      for (const a of orig.attachments || []) if (!a.related) attachments.push({ filename: a.filename || 'prilog', content: a.content, contentType: a.contentType });
    }
    const mail = {
      from: mailer.from(s),
      to,
      cc: cc.length ? cc : undefined,
      bcc: bcc.length ? bcc : undefined,
      replyTo: s.replyTo || undefined,
      subject: String(b.subject || '').slice(0, 300),
      text,
      html,
      attachments,
      inReplyTo: b.inReplyTo || undefined,
      references: b.references || undefined,
    };
    const raw = await new MailComposer(mail).compile().build();
    await mailer.transport(s).sendMail({ envelope: { from: mail.from.address, to: all.map(bare) }, raw });

    let savedToSent = false;
    if (configured()) {
      try {
        // Gmail sam čuva poslate poruke; ostalim serverima dodajemo kopiju u „Poslato“
        if (!/gmail|googlemail/i.test(cfg().host)) {
          const sent = await special('\\Sent');
          if (sent) {
            await withClient((c) => c.append(sent, raw, ['\\Seen']));
            savedToSent = true;
          }
        }
        if (b.replyUid && b.replyFolder) await withBox(String(b.replyFolder), (c) => c.messageFlagsAdd(String(b.replyUid), ['\\Answered'], { uid: true }));
      } catch (e) {
        console.error('Kopija u Poslato nije sačuvana:', e.message);
      }
      folderCache = null;
    }
    res.json({ ok: true, savedToSent });
  }));

  // ---------- nove poruke → obaveštenje (provera na svaka 2 minuta) ----------
  let checking = false;
  async function checkNew() {
    if (checking) return;
    checking = true;
    try {
      await checkNewInner();
    } finally {
      checking = false;
    }
  }
  setInterval(checkNew, 2 * 60 * 1000).unref();
  ctx.every(checkNew);
  async function checkNewInner() {
    if (!configured()) return;
    try {
      await withClient(async (c) => {
        const st = await c.status('INBOX', { unseen: true, uidNext: true, uidValidity: true });
        unread = st.unseen;
        const ms = (store.data.mailState ||= {});
        const valid = String(st.uidValidity);
        if (ms.uidValidity === valid && ms.uidNext && st.uidNext > ms.uidNext) {
          const lock = await c.getMailboxLock('INBOX');
          try {
            const from = Math.max(ms.uidNext, st.uidNext - 10);
            for await (const m of c.fetch(`${from}:${st.uidNext - 1}`, { uid: true, envelope: true, flags: true }, { uid: true })) {
              if (m.flags?.has('\\Seen')) continue;
              const f = m.envelope?.from?.[0];
              ctx.notify({ type: 'mail', title: `Nova poruka: ${f?.name || f?.address || 'nepoznat pošiljalac'}`, text: m.envelope?.subject || '(bez naslova)', link: '#mail', key: `mail:${valid}:${m.uid}` });
            }
          } finally {
            lock.release();
          }
        }
        ms.uidValidity = valid;
        ms.uidNext = st.uidNext;
        store.save();
      });
    } catch (e) {
      lastError = friendly(e);
    }
  }
};
