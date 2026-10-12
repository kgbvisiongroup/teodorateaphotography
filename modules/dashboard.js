// Kontrolna tabla: zbirni pregled iz svih modula.
module.exports = (ctx) => {
  const { app, store, requireAdmin, services } = ctx;
  app.get('/api/admin/stats', requireAdmin, (req, res) => {
    const s = store.settings;
    const editing = services.bookings.needsEditing(req);
    res.json({
      ...services.transfers.stats(),
      smtpReady: !!(s.smtpHost && (s.fromEmail || s.smtpUser)),
      defaultPassword: !!req.user.isDefault,
      isAdmin: req.user.role === 'admin',
      hasBackgrounds: store.data.backgrounds.length > 0,
      hasPackages: store.data.packages.length > 0,
      recent: services.transfers.recent(req, 5),
      upcoming: services.bookings.upcoming(req, 14),
      editing,
      overdue: editing.filter((b) => b.status === 'overdue').length,
      newRequests: (store.data.requests || []).filter((r) => r.status === 'new').length,
      lowStock: services.inventory ? services.inventory.lowCount() : 0,
      newAlbums: (store.data.albumProjects || []).filter((p) => p.status === 'ordered').length,
    });
  });
};
