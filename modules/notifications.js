// Obaveštenja (zvonce gore desno). Drugi moduli ih prave preko ctx.notify({...}).
module.exports = (ctx) => {
  const { app, store, requireAdmin } = ctx;
  const list = () => store.data.notifications;

  // key sprečava da se isto obaveštenje napravi dva puta (npr. 'deadline3:<id>')
  ctx.notify = ({ type = 'info', title, text = '', link = '', key = null, adminOnly = false }) => {
    if (key && list().some((n) => n.key === key)) return;
    list().unshift({ id: store.newId(5), at: Date.now(), type, title, text, link, key, adminOnly, readBy: [] });
    if (list().length > 300) list().length = 300;
    store.save();
  };

  const visible = (u) => list().filter((n) => !n.adminOnly || u.role === 'admin');

  app.get('/api/admin/notifications', requireAdmin, (req, res) => {
    const uid = req.user.id;
    const items = visible(req.user).slice(0, 60).map(({ readBy, key, adminOnly, ...n }) => ({ ...n, read: readBy.includes(uid) }));
    res.json({ items, unread: visible(req.user).filter((n) => !n.readBy.includes(uid)).length, mailUnread: ctx.services.mail?.unread() ?? null });
  });
  app.post('/api/admin/notifications/read', requireAdmin, (req, res) => {
    const uid = req.user.id;
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : null;
    for (const n of visible(req.user)) if ((!ids || ids.includes(n.id)) && !n.readBy.includes(uid)) n.readBy.push(uid);
    store.save();
    res.json({ ok: true });
  });

  // Čuvaju se 60 dana
  ctx.every(() => {
    const cut = Date.now() - 60 * 864e5;
    const before = list().length;
    store.data.notifications = list().filter((n) => n.at > cut);
    if (before !== list().length) store.save();
  });
};
