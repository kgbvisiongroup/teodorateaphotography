// Magacin: artikli (album, book, kutija…), stanje, promet i poručivanje kod dobavljača.
const clean = (v, n = 200) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, n);

module.exports = (ctx) => {
  const { app, store, requireAdmin, adminOnly, notify } = ctx;
  const data = () => store.data;
  const num = (v, d = 0) => (v === '' || v == null || isNaN(Number(v)) ? d : Number(v));
  const KINDS = ['album', 'book', 'kutija', 'ostalo'];

  const findProduct = (id) => data().products.find((p) => p.id === id);

  // ---------- promet ----------
  function move({ productId, qty, type, note = '', bookingId = null, user = null }) {
    const p = findProduct(productId);
    if (!p) return null;
    p.stock = Math.round((p.stock || 0) + qty);
    const m = { id: store.newId(6), productId, qty, type, note: clean(note, 200), bookingId, user, at: Date.now(), stockAfter: p.stock };
    data().stockMoves.unshift(m);
    data().stockMoves = data().stockMoves.slice(0, 3000);
    lowStockWarning(p);
    return m;
  }

  function lowStockWarning(p) {
    if (p.active === false) return;
    const min = num(p.minStock, 0);
    if (p.stock > min) return;
    notify({
      type: 'stock',
      title: p.stock <= 0 ? `Nema više na stanju: ${p.name}` : `Malo na stanju: ${p.name}`,
      text: `Trenutno stanje: ${p.stock} ${p.stock === 1 ? 'komad' : 'komada'}${min ? ` (minimum ${min})` : ''}`,
      link: '#stock',
      key: `stock:${p.id}:${p.stock}`,
    });
  }

  // Skidanje sa stanja kada je fotografisanje obrađeno (jednom po zakazivanju)
  ctx.services.inventory = {
    consumeForBooking(b, user) {
      if (!b || b.stockTaken || !Array.isArray(b.items) || !b.items.length) return [];
      const done = [];
      for (const it of b.items) {
        const p = findProduct(it.productId);
        const qty = Math.max(1, Math.round(num(it.qty, 1)));
        if (!p) continue;
        move({ productId: p.id, qty: -qty, type: 'out', note: `Izrada za ${b.firstName || ''} ${b.lastName || ''}`.trim(), bookingId: b.id, user });
        done.push({ product: p.name, qty });
      }
      if (done.length) {
        b.stockTaken = Date.now();
        store.save();
      }
      return done;
    },
    // Naziv i cena artikla za prikaz u zakazivanju
    describe(items) {
      return (items || [])
        .map((it) => {
          const p = findProduct(it.productId);
          return p ? { productId: p.id, name: p.name, qty: Math.max(1, Math.round(num(it.qty, 1))), price: num(p.price, 0) } : null;
        })
        .filter(Boolean);
    },
    priceOf(items) {
      return this.describe(items).reduce((s, x) => s + x.price * x.qty, 0);
    },
    active: () => data().products.filter((p) => p.active !== false),
    lowCount: () => data().products.filter((p) => p.active !== false && (p.stock || 0) <= num(p.minStock, 0)).length,
  };

  // ---------- artikli ----------
  app.get('/api/admin/products', requireAdmin, (req, res) => {
    const open = data().purchases.filter((o) => o.status === 'ordered');
    res.json(
      data().products.map((p) => ({
        ...p,
        onOrder: open.filter((o) => o.productId === p.id).reduce((s, o) => s + num(o.qty, 0), 0),
        low: (p.stock || 0) <= num(p.minStock, 0),
      }))
    );
  });

  app.post('/api/admin/products', adminOnly, (req, res) => {
    const b = req.body || {};
    const name = clean(b.name, 80);
    if (!name) return res.status(400).json({ error: 'Upišite naziv artikla.' });
    const p = {
      id: store.newId(6),
      name,
      kind: KINDS.includes(b.kind) ? b.kind : 'ostalo',
      sku: clean(b.sku, 40),
      stock: Math.round(num(b.stock, 0)),
      minStock: Math.round(num(b.minStock, 0)),
      price: num(b.price, 0),
      cost: num(b.cost, 0),
      supplier: clean(b.supplier, 120),
      note: clean(b.note, 300),
      active: b.active !== false,
      createdAt: Date.now(),
    };
    data().products.push(p);
    if (p.stock) data().stockMoves.unshift({ id: store.newId(6), productId: p.id, qty: p.stock, type: 'in', note: 'Početno stanje', at: Date.now(), stockAfter: p.stock });
    store.save();
    res.json(p);
  });

  app.put('/api/admin/products/:id', adminOnly, (req, res) => {
    const p = findProduct(req.params.id);
    if (!p) return res.status(404).json({ error: 'Artikal ne postoji.' });
    const b = req.body || {};
    if (b.name !== undefined) p.name = clean(b.name, 80) || p.name;
    if (b.kind !== undefined && KINDS.includes(b.kind)) p.kind = b.kind;
    if (b.sku !== undefined) p.sku = clean(b.sku, 40);
    if (b.minStock !== undefined) p.minStock = Math.round(num(b.minStock, 0));
    if (b.price !== undefined) p.price = num(b.price, 0);
    if (b.cost !== undefined) p.cost = num(b.cost, 0);
    if (b.supplier !== undefined) p.supplier = clean(b.supplier, 120);
    if (b.note !== undefined) p.note = clean(b.note, 300);
    if (b.active !== undefined) p.active = !!b.active;
    store.save();
    res.json(p);
  });

  app.delete('/api/admin/products/:id', adminOnly, (req, res) => {
    data().products = data().products.filter((p) => p.id !== req.params.id);
    store.save();
    res.json({ ok: true });
  });

  // Ručna izmena stanja: ulaz, izlaz ili popis
  app.post('/api/admin/products/:id/stock', requireAdmin, (req, res) => {
    const p = findProduct(req.params.id);
    if (!p) return res.status(404).json({ error: 'Artikal ne postoji.' });
    const b = req.body || {};
    const note = clean(b.note, 200);
    if (b.set !== undefined && b.set !== '') {
      const target = Math.round(num(b.set, p.stock));
      move({ productId: p.id, qty: target - (p.stock || 0), type: 'fix', note: note || 'Popis', user: req.user?.id });
    } else {
      const qty = Math.round(num(b.qty, 0));
      if (!qty) return res.status(400).json({ error: 'Upišite količinu.' });
      move({ productId: p.id, qty, type: qty > 0 ? 'in' : 'out', note, user: req.user?.id });
    }
    store.save();
    res.json(p);
  });

  app.get('/api/admin/stock/moves', requireAdmin, (req, res) => {
    const byProduct = req.query.product;
    const list = data().stockMoves.filter((m) => !byProduct || m.productId === byProduct).slice(0, 200);
    res.json(list.map((m) => ({ ...m, productName: findProduct(m.productId)?.name || '—' })));
  });

  // ---------- poručivanje kod dobavljača ----------
  app.get('/api/admin/purchases', requireAdmin, (req, res) => {
    res.json(data().purchases.map((o) => ({ ...o, productName: findProduct(o.productId)?.name || '—' })));
  });

  app.post('/api/admin/purchases', adminOnly, (req, res) => {
    const b = req.body || {};
    const p = findProduct(clean(b.productId, 40));
    if (!p) return res.status(400).json({ error: 'Izaberite artikal.' });
    const qty = Math.round(num(b.qty, 0));
    if (qty < 1) return res.status(400).json({ error: 'Upišite količinu.' });
    const o = {
      id: store.newId(6),
      productId: p.id,
      qty,
      supplier: clean(b.supplier, 120) || p.supplier,
      cost: num(b.cost, p.cost),
      note: clean(b.note, 300),
      status: 'ordered',
      orderedAt: Date.now(),
      receivedAt: null,
    };
    data().purchases.unshift(o);
    store.save();
    res.json(o);
  });

  app.post('/api/admin/purchases/:id/receive', adminOnly, (req, res) => {
    const o = data().purchases.find((x) => x.id === req.params.id);
    if (!o) return res.status(404).json({ error: 'Porudžbina ne postoji.' });
    if (o.status === 'received') return res.json(o);
    o.status = 'received';
    o.receivedAt = Date.now();
    move({ productId: o.productId, qty: o.qty, type: 'in', note: `Primljena porudžbina${o.supplier ? ' – ' + o.supplier : ''}`, user: req.user?.id });
    store.save();
    res.json(o);
  });

  app.delete('/api/admin/purchases/:id', adminOnly, (req, res) => {
    data().purchases = data().purchases.filter((x) => x.id !== req.params.id);
    store.save();
    res.json({ ok: true });
  });
};
