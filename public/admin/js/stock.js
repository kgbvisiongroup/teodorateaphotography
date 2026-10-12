// Magacin: artikli i stanje, poručivanje kod dobavljača i promet (ulaz/izlaz).
(function () {
  'use strict';
  const { $, $$, esc, fmt, api, toast, ask, modal } = App;
  const KINDS = { album: 'Album', book: 'Book', kutija: 'Kutija', ostalo: 'Ostalo' };
  let tab = 'items';
  let products = [];
  let purchases = [];
  let moves = [];

  async function load() {
    [products, purchases, moves] = await Promise.all([
      api('GET', '/api/admin/products'),
      api('GET', '/api/admin/purchases'),
      api('GET', '/api/admin/stock/moves'),
    ]);
    App.cache.products = products;
    render();
  }

  function render() {
    const low = products.filter((p) => p.active !== false && p.low).length;
    const open = purchases.filter((o) => o.status === 'ordered').length;
    $('#stockBox').innerHTML = `<div class="tabs-row" role="tablist">
<button role="tab" data-tab="items" class="${tab === 'items' ? 'on' : ''}">Artikli<span>${products.length}</span></button>
<button role="tab" data-tab="orders" class="${tab === 'orders' ? 'on' : ''}">Porudžbine<span>${open}</span></button>
<button role="tab" data-tab="moves" class="${tab === 'moves' ? 'on' : ''}">Promet</button>
</div>
${low ? `<div class="alert"><span><b>${low} ${low === 1 ? 'artikal je' : 'artikla su'} pri kraju.</b> Poručite na vreme da vas ne zatekne.</span><button class="link" id="orderLow">Poruči</button></div>` : ''}
<div class="panel">${tab === 'items' ? itemsView() : tab === 'orders' ? ordersView() : movesView()}</div>`;
    $$('.tabs-row button').forEach((b) => (b.onclick = () => ((tab = b.dataset.tab), render())));
    if (tab === 'items') {
      $('#addProd').onclick = () => editProduct();
      $$('[data-edit]').forEach((b) => (b.onclick = () => editProduct(products.find((p) => p.id === b.dataset.edit))));
      $$('[data-move]').forEach((b) => (b.onclick = () => stockMove(products.find((p) => p.id === b.dataset.move))));
      $$('[data-order]').forEach((b) => (b.onclick = () => editPurchase(b.dataset.order)));
    }
    if (tab === 'orders') {
      $('#addOrder').onclick = () => editPurchase();
      $$('[data-recv]').forEach((b) => (b.onclick = async () => {
        await api('POST', `/api/admin/purchases/${b.dataset.recv}/receive`);
        toast('Porudžbina je primljena i dodata na stanje');
        load();
      }));
      $$('[data-delo]').forEach((b) => (b.onclick = async () => {
        if (!(await ask('Obrisati porudžbinu?', 'Stanje se ne menja.', 'Obriši', true))) return;
        await api('DELETE', '/api/admin/purchases/' + b.dataset.delo);
        load();
      }));
    }
    $('#orderLow')?.addEventListener('click', () => editPurchase());
  }

  function itemsView() {
    return `<div class="panel-head"><div><h2>Artikli i stanje</h2><p class="sub small">Stanje se samo umanjuje kada označite da je fotografisanje obrađeno, a uvećava kada primite porudžbinu.</p></div><button class="btn primary" id="addProd">Novi artikal</button></div>
${products.length
      ? `<div class="st-list">${products
          .map(
            (p) => `<div class="st-row${p.active === false ? ' off' : ''}">
<div class="st-main"><b>${esc(p.name)}</b><small>${esc(KINDS[p.kind] || p.kind)}${p.sku ? ' · ' + esc(p.sku) : ''}${p.supplier ? ' · ' + esc(p.supplier) : ''}</small></div>
<div class="st-num ${p.low ? 't-err' : ''}"><b>${p.stock}</b><small>na stanju${p.minStock ? ` · min ${p.minStock}` : ''}</small></div>
<div class="st-num"><b>${p.onOrder || 0}</b><small>poručeno</small></div>
<div class="st-num"><b>${p.price ? fmt.money(p.price) : '—'}</b><small>cena klijentu</small></div>
<div class="acts"><button class="btn sm primary" data-move="${p.id}">Promeni stanje</button><button class="btn sm" data-order="${p.id}">Poruči</button><button class="btn sm" data-edit="${p.id}">Izmeni</button></div>
</div>`
          )
          .join('')}</div>`
      : '<div class="empty">Još nema artikala.</div>'}`;
  }

  function ordersView() {
    const ST = { ordered: ['Poručeno', 'warn'], received: ['Primljeno', 'ok'] };
    return `<div class="panel-head"><div><h2>Porudžbine kod dobavljača</h2><p class="sub small">Kada stigne isporuka, kliknite „Primljeno" – količina ide na stanje.</p></div><button class="btn primary" id="addOrder">Nova porudžbina</button></div>
${purchases.length
      ? `<div class="st-list">${purchases
          .map((o) => {
            const [lbl, cls] = ST[o.status] || ST.ordered;
            return `<div class="st-row">
<div class="st-main"><b>${esc(o.productName)} × ${o.qty}</b><small>${esc(o.supplier || 'bez dobavljača')} · poručeno ${fmt.stamp(o.orderedAt)}${o.receivedAt ? ` · primljeno ${fmt.stamp(o.receivedAt)}` : ''}${o.note ? ' · ' + esc(o.note) : ''}</small></div>
<div class="st-num"><b>${o.cost ? fmt.money(o.cost * o.qty) : '—'}</b><small>nabavna vrednost</small></div>
<span class="tag ${cls}">${lbl}</span>
<div class="acts">${o.status === 'ordered' ? `<button class="btn sm primary" data-recv="${o.id}">Primljeno</button>` : ''}<button class="btn sm danger" data-delo="${o.id}">Obriši</button></div>
</div>`;
          })
          .join('')}</div>`
      : '<div class="empty">Nema porudžbina.</div>'}`;
  }

  function movesView() {
    const T = { in: ['Ulaz', 'ok'], out: ['Izlaz', 'up'], fix: ['Popis', 'muted'] };
    return `<div class="panel-head"><div><h2>Promet</h2><p class="sub small">Poslednjih ${moves.length} promena stanja.</p></div></div>
${moves.length
      ? `<div class="st-list">${moves
          .map((m) => {
            const [lbl, cls] = T[m.type] || T.fix;
            return `<div class="st-row">
<div class="st-main"><b>${esc(m.productName)}</b><small>${fmt.stamp(m.at)}${m.note ? ' · ' + esc(m.note) : ''}</small></div>
<div class="st-num"><b class="${m.qty < 0 ? 't-err' : 't-ok'}">${m.qty > 0 ? '+' : ''}${m.qty}</b><small>stanje posle: ${m.stockAfter}</small></div>
<span class="tag ${cls}">${lbl}</span></div>`;
          })
          .join('')}</div>`
      : '<div class="empty">Još nema promena stanja.</div>'}`;
  }

  function editProduct(p) {
    const isNew = !p;
    p = p || { name: '', kind: 'album', sku: '', stock: 0, minStock: 2, price: '', cost: '', supplier: '', note: '', active: true };
    modal.open(
      `<form class="mform"><h3>${isNew ? 'Novi artikal' : 'Izmena artikla'}</h3>
<div class="row2"><label class="f">Naziv<input name="name" value="${esc(p.name)}" required placeholder="npr. Foto album 25×25"></label>
<label class="f">Vrsta<select name="kind">${Object.entries(KINDS).map(([k, l]) => `<option value="${k}" ${p.kind === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
<div class="row2">${isNew ? `<label class="f">Početno stanje<input name="stock" inputmode="numeric" value="${p.stock}"></label>` : ''}
<label class="f">Minimalno stanje <small>upozorenje kada padne na ovo</small><input name="minStock" inputmode="numeric" value="${p.minStock}"></label></div>
<div class="row2"><label class="f">Cena klijentu (${esc(App.meta.currencySymbol)}) <small>dodaje se na zakazivanje</small><input name="price" inputmode="numeric" value="${p.price || ''}"></label>
<label class="f">Nabavna cena<input name="cost" inputmode="numeric" value="${p.cost || ''}"></label></div>
<label class="f">Dobavljač<input name="supplier" value="${esc(p.supplier || '')}" placeholder="npr. IN Album"></label>
<label class="f">Beleška<input name="note" value="${esc(p.note || '')}"></label>
${isNew ? '' : `<label class="switch"><input type="checkbox" name="active" ${p.active !== false ? 'checked' : ''}><span class="sw"></span><span>Artikal se nudi pri zakazivanju</span></label>`}
<p class="err"></p>
<div class="btn-row">${isNew ? '' : '<button type="button" class="btn danger" id="delProd">Obriši</button>'}<span class="grow"></span><button type="button" class="btn" data-close>Odustani</button><button class="btn primary">Sačuvaj</button></div></form>`,
      async (f) => {
        const body = { name: f.name.value, kind: f.kind.value, minStock: f.minStock.value, price: f.price.value, cost: f.cost.value, supplier: f.supplier.value, note: f.note.value };
        if (isNew) body.stock = f.stock.value;
        else body.active = f.active.checked;
        await api(isNew ? 'POST' : 'PUT', '/api/admin/products' + (isNew ? '' : '/' + p.id), body);
        toast('Sačuvano');
        load();
      }
    );
    $('#delProd')?.addEventListener('click', async () => {
      modal.close();
      if (!(await ask(`Obrisati artikal „${p.name}"?`, 'Promet ostaje zabeležen.', 'Obriši', true))) return;
      await api('DELETE', '/api/admin/products/' + p.id);
      load();
    });
  }

  function stockMove(p) {
    modal.open(
      `<form class="mform"><h3>${esc(p.name)}</h3><p class="sub small">Trenutno stanje: <b>${p.stock}</b></p>
<div class="seg stock-seg" id="mvKind"><button type="button" data-k="in" class="on">Ulaz</button><button type="button" data-k="out">Izlaz</button><button type="button" data-k="fix">Popis</button></div>
<label class="f" id="qtyWrap">Količina<input name="qty" inputmode="numeric" value="1" required></label>
<label class="f" id="setWrap" hidden>Novo stanje po popisu<input name="set" inputmode="numeric" value="${p.stock}"></label>
<label class="f">Beleška <small>nije obavezno</small><input name="note" placeholder="npr. nabavka, poklon, oštećeno"></label>
<p class="err"></p>
<div class="btn-row"><span class="grow"></span><button type="button" class="btn" data-close>Odustani</button><button class="btn primary">Sačuvaj</button></div></form>`,
      async (f) => {
        const kind = $('#mvKind .on').dataset.k;
        const body = { note: f.note.value };
        if (kind === 'fix') body.set = f.set.value;
        else body.qty = (kind === 'out' ? -1 : 1) * Math.abs(Number(f.qty.value) || 0);
        await api('POST', `/api/admin/products/${p.id}/stock`, body);
        toast('Stanje je izmenjeno');
        load();
      }
    );
    $$('#mvKind button').forEach((b) => (b.onclick = () => {
      $$('#mvKind button').forEach((x) => x.classList.toggle('on', x === b));
      $('#qtyWrap').hidden = b.dataset.k === 'fix';
      $('#setWrap').hidden = b.dataset.k !== 'fix';
    }));
  }

  function editPurchase(productId) {
    const list = products.filter((p) => p.active !== false);
    modal.open(
      `<form class="mform"><h3>Nova porudžbina</h3>
<div class="row2"><label class="f">Artikal<select name="productId" required>${list.map((p) => `<option value="${p.id}" ${p.id === productId ? 'selected' : ''}>${esc(p.name)} (stanje ${p.stock})</option>`).join('')}</select></label>
<label class="f">Količina<input name="qty" inputmode="numeric" value="10" required></label></div>
<div class="row2"><label class="f">Dobavljač<input name="supplier" placeholder="npr. IN Album"></label>
<label class="f">Nabavna cena po komadu<input name="cost" inputmode="numeric"></label></div>
<label class="f">Beleška<input name="note" placeholder="npr. rok isporuke 7 dana"></label>
<p class="err"></p>
<div class="btn-row"><span class="grow"></span><button type="button" class="btn" data-close>Odustani</button><button class="btn primary">Sačuvaj porudžbinu</button></div></form>`,
      async (f) => {
        await api('POST', '/api/admin/purchases', { productId: f.productId.value, qty: f.qty.value, supplier: f.supplier.value, cost: f.cost.value, note: f.note.value });
        toast('Porudžbina je zabeležena');
        tab = 'orders';
        load();
      }
    );
  }

  App.view('stock', { title: 'Magacin', sub: 'Albumi, book-ovi i kutije: stanje, poručivanje i promet.', load });
})();
