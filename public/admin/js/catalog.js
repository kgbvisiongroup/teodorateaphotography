// Paketi (po kategoriji, sa cenom) i scenografije (za novogodišnje fotografisanje).
(function () {
  'use strict';
  const { $, $$, esc, fmt, api, toast, ask, modal } = App;
  let tab = null;

  async function load(params) {
    tab = params.get('cat') || tab || App.meta.categories[0].key;
    await Promise.all([App.load('packages', true), App.load('scenes', true)]);
    render();
  }

  function render() {
    const tabs = [...App.meta.categories.map((c) => [c.key, c.name, (App.cache.packages || []).filter((p) => p.category === c.key).length]), ['scenes', 'Scenografije', (App.cache.scenes || []).length]];
    $('#catalog').innerHTML = `<div class="tabs-row" role="tablist">${tabs
      .map(([k, n, cnt]) => `<button role="tab" data-tab="${k}" class="${tab === k ? 'on' : ''}" ${k !== 'scenes' ? `style="--c:${App.cat(k).color}"` : ''}>${esc(n)}<span>${cnt}</span></button>`)
      .join('')}</div><div class="panel">${tab === 'scenes' ? scenes() : packages()}</div>`;
    $$('.tabs-row button').forEach((b) => (b.onclick = () => {
      tab = b.dataset.tab;
      history.replaceState(null, '', '#catalog?cat=' + tab);
      render();
    }));
    $('#addItem').onclick = () => (tab === 'scenes' ? editScene() : editPackage());
    $$('[data-edit]').forEach((b) => (b.onclick = () => (tab === 'scenes' ? editScene(b.dataset.edit) : editPackage(b.dataset.edit))));
    $$('[data-toggle]').forEach((b) => (b.onchange = async () => {
      const p = App.cache.packages.find((x) => x.id === b.dataset.toggle);
      await api('PUT', '/api/admin/packages/' + p.id, { ...p, active: b.checked });
      await App.load('packages', true);
      toast(b.checked ? 'Paket je aktivan' : 'Paket je sakriven iz zakazivanja');
    }));
  }

  function packages() {
    const c = App.cat(tab);
    const list = (App.cache.packages || []).filter((p) => p.category === tab).sort((a, b) => a.price - b.price);
    const hours = c.fields.some((f) => f.type === 'hours');
    return `<div class="panel-head"><div><h2>Paketi: ${esc(c.name)}</h2><p class="sub small">Paketi se nude pri zakazivanju ove vrste fotografisanja.${hours ? ' Cena dodatnog sata se koristi za „Dodatnu satnicu“.' : ''}</p></div><button class="btn primary" id="addItem">Dodaj paket</button></div>
${list.length ? `<div class="pk-list">${list
      .map(
        (p) => `<div class="pk-row${p.active ? '' : ' off'}">
<div><b>${esc(p.name)}</b>${p.description ? `<small>${esc(p.description)}</small>` : ''}</div>
<div class="pk-price">${fmt.money(p.price)}${p.extraHourPrice ? `<small>+ ${fmt.money(p.extraHourPrice)} po dodatnom satu</small>` : ''}</div>
<label class="switch" title="Prikaži pri zakazivanju"><input type="checkbox" data-toggle="${p.id}" ${p.active ? 'checked' : ''}><span class="sw"></span><span class="small">Aktivan</span></label>
<button class="btn sm" data-edit="${p.id}">Izmeni</button></div>`
      )
      .join('')}</div>` : `<div class="empty">Još nema paketa za ovu kategoriju.</div>`}`;
  }

  function scenes() {
    const list = App.cache.scenes || [];
    return `<div class="panel-head"><div><h2>Scenografije</h2><p class="sub small">Biraju se pri zakazivanju novogodišnjeg fotografisanja. Dodajte fotografiju da je lakše izabrati.</p></div><button class="btn primary" id="addItem">Dodaj scenografiju</button></div>
${list.length ? `<div class="sc-grid">${list
      .map((s) => `<div class="sc-card"><div class="sc-img">${s.image ? `<img src="/media/scene/${s.id}?v=${esc(s.image)}" alt="" loading="lazy">` : App.catIcon('novogodisnje')}</div><b>${esc(s.name)}</b>${s.description ? `<small>${esc(s.description)}</small>` : ''}<button class="btn sm" data-edit="${s.id}">Izmeni</button></div>`)
      .join('')}</div>` : '<div class="empty">Još nema scenografija.</div>'}`;
  }

  function editPackage(id) {
    const p = id ? App.cache.packages.find((x) => x.id === id) : { category: tab, name: '', price: '', extraHourPrice: '', description: '', active: true };
    const c = App.cat(p.category);
    const hours = c.fields.some((f) => f.type === 'hours');
    modal.open(
      `<form class="mform"><h3>${id ? 'Izmena paketa' : 'Novi paket'} · ${esc(c.name)}</h3>
<label class="f">Naziv<input name="name" value="${esc(p.name)}" required placeholder="npr. Standard"></label>
<div class="row2"><label class="f">Cena (${esc(App.meta.currencySymbol)})<input name="price" inputmode="numeric" value="${p.price || ''}" required placeholder="npr. 150"></label>
${hours ? `<label class="f">Cena dodatnog sata<input name="extraHourPrice" inputmode="numeric" value="${p.extraHourPrice || ''}" placeholder="npr. 30"></label>` : ''}</div>
<label class="f">Šta paket uključuje<textarea name="description" rows="3" placeholder="npr. 2 sata, 40 obrađenih fotografija">${esc(p.description)}</textarea></label>
<p class="err"></p>
<div class="btn-row">${id ? '<button type="button" class="btn danger" id="delItem">Obriši</button>' : ''}<span class="grow"></span><button type="button" class="btn" data-close>Odustani</button><button class="btn primary">Sačuvaj</button></div></form>`,
      async (f) => {
        const body = { category: p.category, name: f.name.value, price: f.price.value, extraHourPrice: f.extraHourPrice?.value || 0, description: f.description.value, active: p.active };
        await api(id ? 'PUT' : 'POST', '/api/admin/packages' + (id ? '/' + id : ''), body);
        await App.load('packages', true);
        toast('Paket je sačuvan');
        render();
      }
    );
    $('#delItem')?.addEventListener('click', async () => {
      modal.close();
      if (!(await ask('Obrisati paket?', 'Postojeća zakazivanja zadržavaju naziv i cenu paketa.', 'Obriši', true))) return;
      await api('DELETE', '/api/admin/packages/' + id);
      await App.load('packages', true);
      render();
    });
  }

  function editScene(id) {
    const s = id ? App.cache.scenes.find((x) => x.id === id) : { name: '', description: '' };
    modal.open(
      `<form class="mform"><h3>${id ? 'Izmena scenografije' : 'Nova scenografija'}</h3>
<label class="f">Naziv<input name="name" value="${esc(s.name)}" required placeholder="npr. Zimska bajka"></label>
<label class="f">Opis <small>nije obavezno</small><textarea name="description" rows="2">${esc(s.description || '')}</textarea></label>
<label class="f">Fotografija <small>${s.image ? 'izaberite novu da zamenite postojeću' : 'nije obavezno'}</small><input type="file" name="image" accept=".jpg,.jpeg,.png,.webp"></label>
<p class="err"></p>
<div class="btn-row">${id ? '<button type="button" class="btn danger" id="delItem">Obriši</button>' : ''}<span class="grow"></span><button type="button" class="btn" data-close>Odustani</button><button class="btn primary">Sačuvaj</button></div></form>`,
      async (f) => {
        const fd = new FormData();
        fd.append('name', f.name.value);
        fd.append('description', f.description.value);
        if (f.image.files[0]) fd.append('image', f.image.files[0]);
        await api(id ? 'PUT' : 'POST', '/api/admin/scenes' + (id ? '/' + id : ''), fd);
        await App.load('scenes', true);
        toast('Scenografija je sačuvana');
        render();
      }
    );
    $('#delItem')?.addEventListener('click', async () => {
      modal.close();
      if (!(await ask('Obrisati scenografiju?', 'Postojeća zakazivanja zadržavaju njen naziv.', 'Obriši', true))) return;
      await api('DELETE', '/api/admin/scenes/' + id);
      await App.load('scenes', true);
      render();
    });
  }

  App.view('catalog', {
    title: 'Paketi i scenografije',
    sub: 'Cene i ponuda koje birate pri zakazivanju.',
    role: 'admin',
    load,
  });
})();
