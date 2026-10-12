// CMS sajta: stranice sa sekcijama, portfolio (albumi) i biblioteka fotografija.
(function () {
  'use strict';
  const { $, $$, esc, api, toast, ask, modal } = App;

  let D = { pages: [], albums: [], images: [], categories: [], siteEnabled: true };
  let openPage = null; // id stranice čije sekcije uređujemo

  const imgUrl = (id) => (D.images.find((i) => i.id === id) || {}).url || '';
  const cats = () => D.categories || [];
  const catName = (k) => (cats().find((c) => c.key === k) || {}).name || '';

  async function loadData() {
    D = await api('GET', '/api/admin/site');
    return D;
  }
  const savePages = async () => {
    await api('PUT', '/api/admin/site/pages', { pages: D.pages });
  };

  // ---------- opis sekcija ----------
  const T = {
    slider: { name: 'Slider sa opisom i dugmetom', hint: 'Fotografije koje se smenjuju, ispod naziv, opis i dugme za zakazivanje – za stranice usluga.', f: ['title', 'text', 'btn', 'href', 'images'] },
    children: { name: 'Kartice podstranica', hint: 'Prikazuje sve stranice koje su u meniju ispod ove (npr. sve usluge).', f: ['title', 'text'] },
    hero: { name: 'Naslovna sa sliderom', hint: 'Velika slika preko ekrana, naslov i dugmad. Slike se smenjuju.', f: ['eyebrow', 'title', 'text', 'btn', 'href', 'btn2', 'href2', 'useBackgrounds', 'images'] },
    head: { name: 'Zaglavlje stranice', hint: 'Naslov stranice i kratak uvod.', f: ['title', 'text'] },
    cats: { name: 'Vrste fotografisanja', hint: 'Kartice svih šest vrsta, vode na portfolio.', f: ['title', 'text', 'covers'] },
    albums: { name: 'Albumi iz portfolija', hint: 'Prikaz albuma u mreži, sa filterima po vrsti.', f: ['title', 'text', 'category', 'limit', 'filters', 'tint'] },
    rich: { name: 'Tekst i slika', hint: 'Pola teksta, pola fotografije.', f: ['eyebrow', 'title', 'text', 'image', 'side', 'btn', 'href', 'tint'] },
    packages: { name: 'Paketi i cene', hint: 'Automatski prikazuje pakete iz „Paketi i scenografije“.', f: ['title', 'text', 'category'] },
    quotes: { name: 'Utisci klijenata', hint: 'Citati mama i tata.', f: ['title', 'text', 'quotes'] },
    gallery: { name: 'Galerija fotografija', hint: 'Slobodna galerija slika sa uvećanjem na klik.', f: ['title', 'text', 'images'] },
    faq: { name: 'Česta pitanja', hint: 'Pitanja i odgovori koji se otvaraju na klik.', f: ['title', 'text', 'cols', 'faq'] },
    cta: { name: 'Poziv na zakazivanje', hint: 'Istaknuta traka sa dugmetom.', f: ['title', 'text', 'btn', 'href'] },
    contact: { name: 'Kontakt i forma', hint: 'Telefon, email, Instagram, adrese i forma za poruku.', f: ['title', 'text', 'form'] },
    booking: { name: 'Forma za zakazivanje', hint: 'Posetilac bira vrstu, datum, vreme i paket; upit stiže u panel.', f: ['title', 'text'] },
    download: { name: 'Preuzimanje fotografija', hint: 'Polje u koje klijent nalepi link iz poruke.', f: ['title', 'text'] },
  };
  const LBL = {
    eyebrow: ['Sitan natpis iznad naslova', 'npr. FOTO STUDIO'],
    title: ['Naslov', ''],
    text: ['Tekst', ''],
    btn: ['Dugme – tekst', 'npr. Zakaži termin'],
    href: ['Dugme – link', 'npr. /zakazivanje'],
    btn2: ['Drugo dugme – tekst', 'npr. Pogledaj portfolio'],
    href2: ['Drugo dugme – link', 'npr. /portfolio'],
    limit: ['Koliko albuma prikazati', 'npr. 6'],
  };

  // Polja koja imaju englesku verziju
  const EN_FIELDS = ['eyebrow', 'title', 'text', 'btn', 'btn2'];
  const enOn = () => !!D.langEnabled;

  function enBox(s, t) {
    if (!enOn()) return '';
    const fields = t.f.filter((k) => EN_FIELDS.includes(k));
    const items = t.f.includes('quotes') ? 'quotes' : t.f.includes('faq') ? 'faq' : '';
    if (!fields.length && !items) return '';
    const en = s.en || {};
    const rows = fields
      .map((k) => {
        const [lbl] = LBL[k] || [k, ''];
        if (k === 'text') return `<label class="f">Tekst (EN)<textarea name="en_text" rows="4">${esc(en.text || '')}</textarea></label>`;
        return `<label class="f">${lbl} (EN)<input name="en_${k}" value="${esc(en[k] || '')}"></label>`;
      })
      .join('');
    const its =
      items === 'quotes'
        ? (s.items || []).map((q, i) => `<label class="f">Utisak ${i + 1} (EN) <small>${esc((q.text || '').slice(0, 40))}…</small><textarea name="en_q_${i}" rows="2">${esc((en.items || [])[i]?.text || '')}</textarea></label>`).join('')
        : items === 'faq'
        ? (s.items || [])
            .map(
              (q, i) => `<div class="f"><span class="lbl">Pitanje ${i + 1} (EN) <small>${esc((q.q || '').slice(0, 40))}…</small></span>
<input name="en_fq_${i}" value="${esc((en.items || [])[i]?.q || '')}" placeholder="Question"><textarea name="en_fa_${i}" rows="2" placeholder="Answer">${esc((en.items || [])[i]?.a || '')}</textarea></div>`
            )
            .join('')
        : '';
    return `<details class="en-box"><summary>Engleska verzija (EN) <small>prazno = prikazuje se srpski tekst</small></summary>${rows}${its}</details>`;
  }

  function sectionSummary(s) {
    const bits = [];
    if (s.title) bits.push(s.title);
    if (s.type === 'albums') bits.push(s.category ? catName(s.category) : 'svi albumi');
    if (s.type === 'gallery' || s.type === 'slider') bits.push(`${(s.images || []).length} fotografija`);
    if (s.type === 'hero') bits.push((s.images || []).length ? `${s.images.length} slika` : 'slike iz „Izgled“');
    if (s.type === 'quotes') bits.push(`${(s.items || []).length} utisaka`);
    if (s.type === 'faq') bits.push(`${(s.items || []).length} pitanja`);
    return bits.filter(Boolean).join(' · ');
  }

  // ---------- STRANICE ----------
  function renderPages() {
    const box = $('#pagesBox');
    const p = D.pages.find((x) => x.id === openPage);
    if (p) return renderSections(box, p);
    box.innerHTML = `<div class="panel">
<div class="panel-head"><div><h2>Stranice sajta</h2><p class="sub small">Svaka stranica je složena od sekcija. Kliknite na stranicu da uredite njen sadržaj.</p></div><button class="btn primary" id="addPage">Nova stranica</button></div>
<div class="cms-list">${D.pages
      .map(
        (x, i) => `<div class="cms-row" data-id="${x.id}">
<div class="ord"><button class="ic" data-up ${i ? '' : 'disabled'} title="Gore">↑</button><button class="ic" data-down ${i < D.pages.length - 1 ? '' : 'disabled'} title="Dole">↓</button></div>
<div class="cms-main"><b>${x.parent ? '<span class="sub small">└ </span>' : ''}${esc(x.title)}</b><span class="small sub">/${esc(x.slug)} · ${(x.sections || []).length} ${(x.sections || []).length === 1 ? 'sekcija' : 'sekcija'}${x.nav ? '' : ' · nije u meniju'}</span></div>
${x.published === false ? '<span class="tag muted">sakrivena</span>' : '<span class="tag ok">objavljena</span>'}
<div class="acts"><a class="btn sm" href="/${esc(x.slug)}" target="_blank" rel="noopener">Pogledaj</a><button class="btn sm" data-meta>Naziv i meni</button><button class="btn sm primary" data-open>Uredi sadržaj</button></div>
</div>`
      )
      .join('')}</div></div>`;
    $('#addPage').onclick = () => editPageMeta();
    $$('#pagesBox .cms-row').forEach((row) => {
      const x = D.pages.find((p2) => p2.id === row.dataset.id);
      row.querySelector('[data-open]').onclick = () => ((openPage = x.id), renderPages());
      row.querySelector('[data-meta]').onclick = () => editPageMeta(x);
      row.querySelector('[data-up]').onclick = () => movePage(x, -1);
      row.querySelector('[data-down]').onclick = () => movePage(x, 1);
    });
  }

  async function movePage(p, d) {
    const i = D.pages.indexOf(p);
    D.pages.splice(i, 1);
    D.pages.splice(i + d, 0, p);
    D.pages.forEach((x, n) => (x.order = n));
    await savePages();
    renderPages();
  }

  function editPageMeta(p) {
    const isNew = !p;
    p = p || { title: '', slug: '', nav: '', published: true, sections: [{ id: '', type: 'head', title: '', text: '' }] };
    modal.open(
      `<form class="mform"><h3>${isNew ? 'Nova stranica' : 'Stranica: ' + esc(p.title)}</h3>
<div class="row2">
<label class="f">Naziv stranice<input name="title" value="${esc(p.title)}" required placeholder="npr. O meni"></label>
<label class="f">Adresa <small>deo posle / u linku</small><input name="slug" value="${esc(p.slug)}" placeholder="npr. o-meni" ${p.slug === '' && !isNew ? 'disabled' : ''}></label>
</div>
<label class="f">Naziv u meniju <small>ostavite prazno da se ne prikazuje u meniju</small><input name="nav" value="${esc(p.nav || '')}" placeholder="npr. O meni"></label>
<label class="f">U meniju ispod stranice <small>za padajući meni, npr. ispod „Usluge“</small><select name="parent"><option value="">Samostalna stavka u meniju</option>${D.pages
        .filter((x) => x.id !== p.id && !x.parent)
        .map((x) => `<option value="${esc(x.id)}" ${p.parent === x.id ? 'selected' : ''}>${esc(x.title)}</option>`)
        .join('')}</select></label>
<div class="f"><span class="lbl">Naslovna fotografija <small>za karticu u spisku usluga; prazno = prva iz slidera</small></span>
<div class="pick-one" id="pgCover">${p.cover ? `<img src="${esc(imgUrl(p.cover))}" alt="">` : '<span class="ph">prva iz slidera</span>'}</div>
<div class="btn-row left"><button type="button" class="btn sm" id="pickPgCover">Izaberi fotografiju</button>${p.cover ? '<button type="button" class="btn sm" id="clearPgCover">Ukloni</button>' : ''}</div></div>
<div class="row2">
<label class="f">SEO naslov <small>za Google, nije obavezno</small><input name="seoTitle" value="${esc(p.seoTitle || '')}"></label>
<label class="f">SEO opis <small>nije obavezno</small><input name="seoDesc" value="${esc(p.seoDesc || '')}"></label>
</div>
<label class="switch"><input type="checkbox" name="published" ${p.published !== false ? 'checked' : ''}><span class="sw"></span><span>Stranica je objavljena</span></label>
${enOn() ? `<details class="en-box"><summary>Engleska verzija (EN) <small>prazno = prikazuje se srpski tekst</small></summary>
<div class="row2"><label class="f">Naziv stranice (EN)<input name="en_title" value="${esc(p.en?.title || '')}"></label>
<label class="f">Naziv u meniju (EN)<input name="en_nav" value="${esc(p.en?.nav || '')}"></label></div>
<div class="row2"><label class="f">SEO naslov (EN)<input name="en_seoTitle" value="${esc(p.en?.seoTitle || '')}"></label>
<label class="f">SEO opis (EN)<input name="en_seoDesc" value="${esc(p.en?.seoDesc || '')}"></label></div></details>` : ''}
<p class="err"></p>
<div class="btn-row">${isNew || p.slug === '' ? '' : '<button type="button" class="btn danger" id="delPage">Obriši stranicu</button>'}<span class="grow"></span><button type="button" class="btn" data-close>Odustani</button><button class="btn primary">Sačuvaj</button></div></form>`,
      async (f) => {
        if (enOn()) {
          const en = { title: f.en_title.value, nav: f.en_nav.value, seoTitle: f.en_seoTitle.value, seoDesc: f.en_seoDesc.value };
          p.en = Object.values(en).some(Boolean) ? en : undefined;
        }
        Object.assign(p, {
          parent: f.parent.value || undefined,
          title: f.title.value,
          slug: p.slug === '' && !isNew ? '' : f.slug.value || f.title.value,
          nav: f.nav.value,
          seoTitle: f.seoTitle.value,
          seoDesc: f.seoDesc.value,
          published: f.published.checked,
        });
        if (isNew) D.pages.push(p);
        await savePages();
        await loadData();
        toast('Sačuvano');
        renderPages();
      }
    );
    $('#pickPgCover')?.addEventListener('click', async () => {
      const [id] = await pickImages({ multi: false, selected: p.cover ? [p.cover] : [] });
      if (!id) return;
      p.cover = id;
      $('#pgCover').innerHTML = `<img src="${imgUrl(id)}" alt="">`;
    });
    $('#clearPgCover')?.addEventListener('click', () => {
      p.cover = '';
      $('#pgCover').innerHTML = '<span class="ph">prva iz slidera</span>';
    });
    $('#delPage')?.addEventListener('click', async () => {
      modal.close();
      if (!(await ask(`Obrisati stranicu „${p.title}“?`, 'Sadržaj stranice se briše i link prestaje da radi.', 'Obriši', true))) return;
      D.pages = D.pages.filter((x) => x !== p);
      await savePages();
      await loadData();
      renderPages();
    });
  }

  // ---------- SEKCIJE JEDNE STRANICE ----------
  function renderSections(box, p) {
    const list = p.sections || (p.sections = []);
    box.innerHTML = `<div class="panel">
<div class="panel-head"><div><button class="link back-link" id="backPages">‹ Sve stranice</button><h2>${esc(p.title)}</h2><p class="sub small">Sekcije se prikazuju ovim redom. Kliknite „Izmeni“ da promenite tekst i slike.</p></div>
<div class="btn-row left"><a class="btn" href="/${esc(p.slug)}" target="_blank" rel="noopener">Pogledaj stranicu</a><button class="btn primary" id="addSec">Dodaj sekciju</button></div></div>
${list.length
        ? `<div class="cms-list">${list
            .map(
              (s, i) => `<div class="cms-row" data-id="${s.id}">
<div class="ord"><button class="ic" data-up ${i ? '' : 'disabled'}>↑</button><button class="ic" data-down ${i < list.length - 1 ? '' : 'disabled'}>↓</button></div>
<div class="cms-main"><b>${esc((T[s.type] || {}).name || s.type)}</b><span class="small sub">${esc(sectionSummary(s))}</span></div>
<div class="acts"><button class="btn sm primary" data-edit>Izmeni</button><button class="btn sm danger" data-del>Ukloni</button></div></div>`
            )
            .join('')}</div>`
        : '<div class="empty">Stranica još nema sekcija.<br><button class="btn primary" id="addSec2">Dodaj prvu sekciju</button></div>'}
</div>`;
    $('#backPages').onclick = () => ((openPage = null), renderPages());
    const add = () => addSection(p);
    $('#addSec').onclick = add;
    $('#addSec2')?.addEventListener('click', add);
    $$('#pagesBox .cms-row').forEach((row) => {
      const s = list.find((x) => x.id === row.dataset.id);
      row.querySelector('[data-edit]').onclick = () => editSection(p, s);
      row.querySelector('[data-up]').onclick = () => moveSec(p, s, -1);
      row.querySelector('[data-down]').onclick = () => moveSec(p, s, 1);
      row.querySelector('[data-del]').onclick = async () => {
        if (!(await ask('Ukloniti sekciju?', 'Sadržaj sekcije se briše sa stranice.', 'Ukloni', true))) return;
        p.sections = p.sections.filter((x) => x !== s);
        await savePages();
        renderSections(box, p);
      };
    });
  }

  async function moveSec(p, s, d) {
    const i = p.sections.indexOf(s);
    p.sections.splice(i, 1);
    p.sections.splice(i + d, 0, s);
    await savePages();
    renderSections($('#pagesBox'), p);
  }

  function addSection(p) {
    modal.open(
      `<form class="mform"><h3>Dodaj sekciju</h3><p class="sub small">Izaberite šta dodajete na stranicu.</p>
<div class="sec-pick">${Object.entries(T)
        .map(([k, t]) => `<label class="pick"><input type="radio" name="type" value="${k}" ${k === 'rich' ? 'checked' : ''}><span><b>${esc(t.name)}</b><small>${esc(t.hint)}</small></span></label>`)
        .join('')}</div>
<p class="err"></p><div class="btn-row"><span class="grow"></span><button type="button" class="btn" data-close>Odustani</button><button class="btn primary">Dodaj</button></div></form>`,
      async (f) => {
        const s = { id: '', type: f.type.value, title: '', text: '' };
        if (s.type === 'quotes' || s.type === 'faq') s.items = [];
        if (s.type === 'gallery' || s.type === 'hero') s.images = [];
        if (s.type === 'albums') s.limit = 6;
        p.sections.push(s);
        await savePages();
        await loadData();
        const fresh = D.pages.find((x) => x.id === p.id);
        renderSections($('#pagesBox'), fresh);
        // sačekamo da se prozor za izbor zatvori, pa otvaramo izmenu nove sekcije
        setTimeout(() => editSection(fresh, fresh.sections[fresh.sections.length - 1]), 80);
      }
    );
  }

  function field(k, s) {
    const [lbl, ph] = LBL[k] || [k, ''];
    if (k === 'text') return `<label class="f">Tekst<textarea name="text" rows="4" placeholder="${esc(ph)}">${esc(s.text || '')}</textarea></label>`;
    if (k === 'limit') return `<label class="f">${lbl}<input name="limit" inputmode="numeric" value="${s.limit || ''}" placeholder="${esc(ph)}"></label>`;
    if (k === 'category')
      return `<label class="f">Vrsta fotografisanja <small>prazno = sve</small><select name="category"><option value="">Sve vrste</option>${cats()
        .map((c) => `<option value="${c.key}" ${s.category === c.key ? 'selected' : ''}>${esc(c.name)}</option>`)
        .join('')}</select></label>`;
    if (k === 'side')
      return `<label class="f">Gde stoji fotografija<select name="side"><option value="right" ${s.side !== 'left' ? 'selected' : ''}>Desno</option><option value="left" ${s.side === 'left' ? 'selected' : ''}>Levo</option></select></label>`;
    if (k === 'cols') return sw('cols', 'Prikaži pitanja u dve kolone', s.cols);
    if (k === 'tint') return sw('tint', 'Svetlo roze pozadina sekcije', s.tint);
    if (k === 'filters') return sw('filters', 'Dugmad za filtriranje po vrsti', s.filters);
    if (k === 'form') return sw('form', 'Prikaži formu za poruku', s.form !== false);
    if (k === 'useBackgrounds') return sw('useBackgrounds', 'Koristi fotografije iz „Izgled“ (ako ne izaberete slike ispod)', s.useBackgrounds !== false);
    if (k === 'image') return `<div class="f"><span class="lbl">Fotografija</span><div class="pick-one" id="pickOne">${s.image ? `<img src="${esc(imgUrl(s.image))}" alt="">` : '<span class="ph">bez fotografije</span>'}</div><div class="btn-row left"><button type="button" class="btn sm" id="pickImg">Izaberi iz biblioteke</button>${s.image ? '<button type="button" class="btn sm" id="clearImg">Ukloni</button>' : ''}</div></div>`;
    if (k === 'images') return `<div class="f"><span class="lbl">Fotografije <small>${(s.images || []).length} izabrano</small></span><div class="pick-many" id="pickMany">${(s.images || []).map((id) => `<img src="${esc(imgUrl(id))}" alt="">`).join('') || '<span class="ph">nijedna nije izabrana</span>'}</div><div class="btn-row left"><button type="button" class="btn sm" id="pickImgs">Izaberi fotografije</button></div></div>`;
    if (k === 'covers')
      return `<div class="f"><span class="lbl">Naslovne fotografije kartica <small>prazno = prva iz albuma te vrste</small></span><div class="covers">${cats()
        .map((c) => `<button type="button" class="cover" data-cover="${c.key}"><span class="cv">${s.covers?.[c.key] ? `<img src="${esc(imgUrl(s.covers[c.key]))}" alt="">` : '<i>+</i>'}</span><small>${esc(c.name)}</small></button>`)
        .join('')}</div></div>`;
    if (k === 'quotes')
      return `<div class="f"><span class="lbl">Utisci</span><div class="rep" id="repQuotes">${(s.items || [])
        .map((q, i) => quoteRow(q, i))
        .join('')}</div><div class="btn-row left"><button type="button" class="btn sm" id="addQuote">Dodaj utisak</button></div></div>`;
    if (k === 'faq')
      return `<div class="f"><span class="lbl">Pitanja i odgovori</span><div class="rep" id="repFaq">${(s.items || []).map((q, i) => faqRow(q, i)).join('')}</div><div class="btn-row left"><button type="button" class="btn sm" id="addFaq">Dodaj pitanje</button></div></div>`;
    return `<label class="f">${lbl}<input name="${k}" value="${esc(s[k] || '')}" placeholder="${esc(ph)}"></label>`;
  }
  const sw = (n, l, on) => `<label class="switch"><input type="checkbox" name="${n}" ${on ? 'checked' : ''}><span class="sw"></span><span>${esc(l)}</span></label>`;
  const quoteRow = (q, i) => `<div class="rep-row"><textarea name="q_text_${i}" rows="2" placeholder="Tekst utiska">${esc(q.text || '')}</textarea><input name="q_name_${i}" value="${esc(q.name || '')}" placeholder="Ime (npr. Ana M.)"><button type="button" class="ic" data-rm>×</button></div>`;
  const faqRow = (q, i) => `<div class="rep-row"><input name="f_q_${i}" value="${esc(q.q || '')}" placeholder="Pitanje"><textarea name="f_a_${i}" rows="2" placeholder="Odgovor">${esc(q.a || '')}</textarea><button type="button" class="ic" data-rm>×</button></div>`;

  function editSection(p, s) {
    const t = T[s.type] || { name: s.type, f: ['title', 'text'] };
    const d = modal.open(
      `<form class="mform wide"><h3>${esc(t.name)}</h3><p class="sub small">${esc(t.hint || '')}</p>
${t.f.map((k) => field(k, s)).join('')}
${enBox(s, t)}
<p class="err"></p><div class="btn-row"><span class="grow"></span><button type="button" class="btn" data-close>Odustani</button><button class="btn primary">Sačuvaj</button></div></form>`,
      async (f) => {
        for (const k of t.f) {
          if (['image', 'images', 'covers', 'quotes', 'faq'].includes(k)) continue;
          const el = f.elements[k];
          if (!el) continue;
          if (el.type === 'checkbox') s[k] = el.checked;
          else if (k === 'limit') s.limit = Number(el.value) || 0;
          else s[k] = el.value;
        }
        if (t.f.includes('quotes')) s.items = [...d.querySelectorAll('#repQuotes .rep-row')].map((r) => ({ text: r.querySelector('textarea').value, name: r.querySelector('input').value })).filter((q) => q.text);
        if (t.f.includes('faq')) s.items = [...d.querySelectorAll('#repFaq .rep-row')].map((r) => ({ q: r.querySelector('input').value, a: r.querySelector('textarea').value })).filter((q) => q.q);
        if (enOn()) {
          const en = {};
          for (const k of EN_FIELDS) if (f.elements['en_' + k]) en[k] = f.elements['en_' + k].value;
          if (t.f.includes('quotes')) en.items = (s.items || []).map((_, i) => ({ text: f.elements['en_q_' + i]?.value || '' }));
          if (t.f.includes('faq')) en.items = (s.items || []).map((_, i) => ({ q: f.elements['en_fq_' + i]?.value || '', a: f.elements['en_fa_' + i]?.value || '' }));
          const any = Object.values(en).some((v) => (Array.isArray(v) ? v.some((x) => Object.values(x).some(Boolean)) : v));
          s.en = any ? en : undefined;
        }
        await savePages();
        await loadData();
        toast('Sačuvano');
        renderSections($('#pagesBox'), D.pages.find((x) => x.id === p.id));
      }
    );

    // slike
    d.querySelector('#pickImg')?.addEventListener('click', async () => {
      const [id] = await pickImages({ multi: false, selected: s.image ? [s.image] : [] });
      if (!id) return;
      s.image = id;
      d.querySelector('#pickOne').innerHTML = `<img src="${imgUrl(id)}" alt="">`;
    });
    d.querySelector('#clearImg')?.addEventListener('click', () => {
      s.image = '';
      d.querySelector('#pickOne').innerHTML = '<span class="ph">bez fotografije</span>';
    });
    d.querySelector('#pickImgs')?.addEventListener('click', async () => {
      const ids = await pickImages({ multi: true, selected: s.images || [] });
      if (!ids) return;
      s.images = ids;
      d.querySelector('#pickMany').innerHTML = ids.map((id) => `<img src="${imgUrl(id)}" alt="">`).join('') || '<span class="ph">nijedna nije izabrana</span>';
    });
    d.querySelectorAll('[data-cover]').forEach((b) =>
      b.addEventListener('click', async () => {
        const [id] = await pickImages({ multi: false, selected: [] });
        if (!id) return;
        s.covers = { ...(s.covers || {}), [b.dataset.cover]: id };
        b.querySelector('.cv').innerHTML = `<img src="${imgUrl(id)}" alt="">`;
      })
    );
    // ponavljajuća polja
    d.querySelector('#addQuote')?.addEventListener('click', () => d.querySelector('#repQuotes').insertAdjacentHTML('beforeend', quoteRow({}, Date.now())));
    d.querySelector('#addFaq')?.addEventListener('click', () => d.querySelector('#repFaq').insertAdjacentHTML('beforeend', faqRow({}, Date.now())));
    d.addEventListener('click', (e) => e.target.closest('[data-rm]') && e.target.closest('.rep-row').remove());
  }

  // ---------- BIBLIOTEKA: izbor slika ----------
  function pickerEl() {
    let el = document.getElementById('picker');
    if (!el) {
      el = document.createElement('dialog');
      el.id = 'picker';
      el.className = 'dlg xwide';
      document.body.appendChild(el);
      el.addEventListener('click', (e) => {
        if (e.target.id === 'picker' || e.target.closest('[data-close]')) el.close();
      });
    }
    return el;
  }

  function pickImages({ multi, selected }) {
    return new Promise((resolve) => {
      let sel = [...(selected || [])];
      let done = false;
      const grid = () =>
        D.images.length
          ? `<div class="lib-grid">${D.images
              .map((im) => `<button type="button" class="lib${sel.includes(im.id) ? ' on' : ''}" data-id="${im.id}"><img src="${esc(im.url)}" alt="" loading="lazy"><span class="n">${sel.indexOf(im.id) + 1 || ''}</span></button>`)
              .join('')}</div>`
          : '<div class="empty">Biblioteka je prazna. Dodajte fotografije dugmetom iznad.</div>';
      const d = pickerEl();
      d.innerHTML = `<div class="mform wide"><h3>${multi ? 'Izaberite fotografije' : 'Izaberite fotografiju'}</h3>
<div class="btn-row left"><button type="button" class="btn sm primary" id="libUp">Dodaj nove fotografije</button><span class="small sub" id="libMsg">${multi ? 'Redosled izbora je redosled prikaza.' : ''}</span></div>
<input type="file" id="libFile" accept=".jpg,.jpeg,.png,.webp" multiple hidden>
<div id="libBox">${grid()}</div>
<div class="btn-row"><span class="grow"></span><button type="button" class="btn" data-close>Odustani</button><button type="button" class="btn primary" id="libOk">Gotovo</button></div></div>`;
      d.showModal();
      const redraw = () => {
        d.querySelector('#libBox').innerHTML = grid();
        bind();
      };
      const bind = () =>
        d.querySelectorAll('.lib').forEach((b) =>
          b.addEventListener('click', () => {
            const id = b.dataset.id;
            if (multi) sel = sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id];
            else sel = [id];
            redraw();
          })
        );
      bind();
      d.querySelector('#libUp').onclick = () => d.querySelector('#libFile').click();
      d.querySelector('#libFile').onchange = async (e) => {
        const files = [...e.target.files];
        if (!files.length) return;
        d.querySelector('#libMsg').textContent = `Šaljem ${files.length} ${files.length === 1 ? 'fotografiju' : 'fotografija'}…`;
        const fd = new FormData();
        files.forEach((f) => fd.append('files', f));
        try {
          await api('POST', '/api/admin/site/images', fd);
          // osvežavamo samo biblioteku slika; stranice ostaju iste da se ne izgube izmene u otvorenoj sekciji
          const fresh = await api('GET', '/api/admin/site');
          D.images = fresh.images;
          d.querySelector('#libMsg').textContent = 'Dodato.';
          redraw();
        } catch (err) {
          d.querySelector('#libMsg').textContent = err.message;
        }
      };
      d.querySelector('#libOk').onclick = () => {
        done = true;
        d.close();
        resolve(sel);
      };
      d.addEventListener('close', () => !done && resolve(null), { once: true });
    });
  }
  App.pickImages = pickImages;

  // ---------- PORTFOLIO ----------
  function renderPortfolio() {
    const list = [...D.albums].sort((a, b) => (a.order || 0) - (b.order || 0));
    $('#portfolioBox').innerHTML = `<div class="panel">
<div class="panel-head"><div><h2>Albumi</h2><p class="sub small">Svaki album je jedna galerija na sajtu, sa svojom vrstom fotografisanja.</p></div><button class="btn primary" id="addAlbum">Novi album</button></div>
${list.length
        ? `<div class="alb-grid">${list
            .map(
              (a) => `<div class="alb" data-id="${a.id}">
<div class="alb-cover">${a.cover ? `<img src="${esc(imgUrl(a.cover))}" alt="" loading="lazy">` : '<span class="ph">bez naslovne</span>'}${a.published === false ? '<span class="tag muted">sakriven</span>' : ''}</div>
<b>${esc(a.title)}</b><span class="small sub">${esc(catName(a.category) || 'bez vrste')} · ${(a.images || []).length} fotografija</span>
<div class="btn-row left"><button class="btn sm primary" data-pics>Fotografije</button><button class="btn sm" data-edit>Izmeni</button><a class="btn sm" href="/portfolio/${esc(a.slug)}" target="_blank" rel="noopener">Pogledaj</a></div></div>`
            )
            .join('')}</div>`
        : '<div class="empty">Još nema albuma.<br><button class="btn primary" id="addAlbum2">Napravi prvi album</button></div>'}
</div>
<div class="panel"><div class="panel-head"><div><h2>Biblioteka fotografija</h2><p class="sub small">Sve fotografije sajta na jednom mestu: ${D.images.length}.</p></div><button class="btn" id="libOpen">Dodaj fotografije</button></div>
<div class="lib-grid small-grid">${D.images.slice(0, 60).map((im) => `<div class="lib"><img src="${esc(im.url)}" alt="" loading="lazy"><button class="x" data-del-img="${im.id}" title="Obriši">×</button></div>`).join('') || '<div class="empty">Biblioteka je prazna.</div>'}</div></div>`;
    const add = () => editAlbum();
    $('#addAlbum').onclick = add;
    $('#addAlbum2')?.addEventListener('click', add);
    $('#libOpen').onclick = async () => {
      await pickImages({ multi: true, selected: [] });
      await loadData();
      renderPortfolio();
    };
    $$('#portfolioBox .alb').forEach((el) => {
      const a = D.albums.find((x) => x.id === el.dataset.id);
      el.querySelector('[data-edit]').onclick = () => editAlbum(a);
      el.querySelector('[data-pics]').onclick = () => albumPics(a);
    });
    $$('[data-del-img]').forEach((b) => (b.onclick = async () => {
      if (!(await ask('Obrisati fotografiju?', 'Uklanja se i sa stranica i iz albuma gde je korišćena.', 'Obriši', true))) return;
      await api('DELETE', '/api/admin/site/images/' + b.dataset.delImg);
      await loadData();
      renderPortfolio();
    }));
  }

  async function albumPics(a) {
    const ids = await pickImages({ multi: true, selected: a.images || [] });
    if (!ids) return;
    await api('PUT', '/api/admin/site/albums/' + a.id, { images: ids, cover: a.cover && ids.includes(a.cover) ? a.cover : ids[0] || '' });
    await loadData();
    toast('Fotografije su sačuvane');
    renderPortfolio();
  }

  function editAlbum(a) {
    const isNew = !a;
    a = a || { title: '', slug: '', category: '', text: '', published: true, images: [] };
    modal.open(
      `<form class="mform"><h3>${isNew ? 'Novi album' : 'Izmena albuma'}</h3>
<div class="row2"><label class="f">Naziv<input name="title" value="${esc(a.title)}" required placeholder="npr. Mila · newborn"></label>
<label class="f">Vrsta fotografisanja<select name="category"><option value="">Bez vrste</option>${cats().map((c) => `<option value="${c.key}" ${a.category === c.key ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label></div>
<label class="f">Kratak opis <small>nije obavezno</small><textarea name="text" rows="2">${esc(a.text || '')}</textarea></label>
${isNew ? '' : `<div class="f"><span class="lbl">Naslovna fotografija</span><div class="pick-one" id="pickOne">${a.cover ? `<img src="${esc(imgUrl(a.cover))}" alt="">` : '<span class="ph">prva iz albuma</span>'}</div><div class="btn-row left"><button type="button" class="btn sm" id="pickCover">Izaberi naslovnu</button></div></div>`}
${enOn() ? `<details class="en-box"><summary>Engleska verzija (EN)</summary>
<label class="f">Naziv (EN)<input name="en_title" value="${esc(a.en?.title || '')}"></label>
<label class="f">Opis (EN)<textarea name="en_text" rows="2">${esc(a.en?.text || '')}</textarea></label></details>` : ''}
<label class="switch"><input type="checkbox" name="published" ${a.published !== false ? 'checked' : ''}><span class="sw"></span><span>Album je vidljiv na sajtu</span></label>
<p class="err"></p>
<div class="btn-row">${isNew ? '' : '<button type="button" class="btn danger" id="delAlbum">Obriši</button>'}<span class="grow"></span><button type="button" class="btn" data-close>Odustani</button><button class="btn primary">${isNew ? 'Napravi album' : 'Sačuvaj'}</button></div></form>`,
      async (f) => {
        const body = { title: f.title.value, category: f.category.value, text: f.text.value, published: f.published.checked };
        if (enOn()) {
          const en = { title: f.en_title.value, text: f.en_text.value };
          if (en.title || en.text) body.en = en;
        }
        if (a.coverPick) body.cover = a.coverPick;
        const saved = await api(isNew ? 'POST' : 'PUT', '/api/admin/site/albums' + (isNew ? '' : '/' + a.id), body);
        await loadData();
        toast(isNew ? 'Album je napravljen' : 'Sačuvano');
        renderPortfolio();
        if (isNew) albumPics(D.albums.find((x) => x.id === saved.id));
      }
    );
    $('#pickCover')?.addEventListener('click', async () => {
      const [id] = await pickImages({ multi: false, selected: a.cover ? [a.cover] : [] });
      if (!id) return;
      a.coverPick = id;
      $('#pickOne').innerHTML = `<img src="${imgUrl(id)}" alt="">`;
    });
    $('#delAlbum')?.addEventListener('click', async () => {
      modal.close();
      if (!(await ask(`Obrisati album „${a.title}“?`, 'Fotografije ostaju u biblioteci.', 'Obriši', true))) return;
      await api('DELETE', '/api/admin/site/albums/' + a.id);
      await loadData();
      renderPortfolio();
    });
  }

  App.view('pages', { role: 'admin', title: 'Stranice sajta', sub: 'Sadržaj javnog sajta: naslovi, tekstovi, slike i sekcije.', load: async () => (await loadData(), renderPages()) });
  App.view('portfolio', { role: 'admin', title: 'Portfolio', sub: 'Albumi sa fotografijama koje se prikazuju na sajtu.', load: async () => (await loadData(), renderPortfolio()) });
})();
