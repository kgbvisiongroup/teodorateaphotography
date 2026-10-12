// Moj profil (slika, ime, email, korisničko ime, lozinka) i korisnici portala (samo administrator).
(function () {
  'use strict';
  const { $, $$, esc, fmt, api, toast, ask, modal } = App;
  const ROLE = { admin: 'Administrator', staff: 'Saradnik' };
  const ROLE_TXT = {
    admin: 'Sve, uključujući podešavanja, izgled sajta i korisnike.',
    staff: 'Zakazivanja, kalendar, klijenti, vaučeri, slanje fotografija i pošta. Bez podešavanja i korisnika.',
  };

  // ---------- moj profil ----------
  function renderProfile(params) {
    const u = App.me.user;
    $('#profileBox').innerHTML = `<div class="profile-grid">
<div class="panel prof-card">
  <div class="prof-photo">${App.avatar(u, 'xl')}</div>
  <input type="file" id="photoFile" accept=".jpg,.jpeg,.png,.webp" hidden>
  <div class="btn-row"><button class="btn primary" id="photoPick">${u.photo ? 'Promeni sliku' : 'Dodaj sliku'}</button>${u.photo ? '<button class="btn" id="photoDel">Ukloni</button>' : ''}</div>
  <p class="sub small center">Slika se prikazuje u krugu, gore desno i kod korisnika portala.</p>
</div>
<div>
  <form class="panel" id="profForm">
    <h2>Lični podaci</h2>
    <div class="row2">
      <label class="f">Ime i prezime<input name="name" value="${esc(u.name)}" required></label>
      <label class="f">Email <small>za novu lozinku i obaveštenja</small><input name="email" type="email" value="${esc(u.email)}"></label>
    </div>
    <p class="small sub">Uloga: <b>${ROLE[u.role]}</b> · ${esc(ROLE_TXT[u.role])}</p>
    <button class="btn primary">Sačuvaj</button>
  </form>
  <form class="panel" id="pwForm2">
    <h2 id="pwHead">Korisničko ime i lozinka</h2>
    <div class="row2">
      <label class="f">Korisničko ime<input name="username" value="${esc(u.username)}" autocomplete="username" required autocapitalize="none" spellcheck="false"></label>
      <label class="f">Trenutna lozinka <small>obavezna za izmenu</small><input type="password" name="current" autocomplete="current-password" required></label>
      <label class="f">Nova lozinka <small>najmanje 8 znakova</small><input type="password" name="next" autocomplete="new-password" minlength="8"></label>
      <label class="f">Ponovite novu lozinku<input type="password" name="next2" autocomplete="new-password" minlength="8"></label>
    </div>
    <p class="small" id="pwMsg2" role="status"></p>
    <div class="btn-row left"><button class="btn primary">Sačuvaj</button><button type="button" class="link" id="pwMail">Zaboravili ste lozinku? Pošalji mi link emailom</button></div>
  </form>
</div></div>`;
    $('#photoPick').onclick = () => $('#photoFile').click();
    $('#photoFile').onchange = async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const fd = new FormData();
      fd.append('photo', f);
      try {
        await api('POST', '/api/admin/profile/photo', fd);
        await App.refreshMe();
        toast('Slika je sačuvana');
        renderProfile();
      } catch (err) {
        toast(err.message);
      }
    };
    $('#photoDel')?.addEventListener('click', async () => {
      await api('DELETE', '/api/admin/profile/photo');
      await App.refreshMe();
      renderProfile();
    });
    $('#profForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api('PUT', '/api/admin/profile', { name: e.target.name.value, email: e.target.email.value });
        await App.refreshMe();
        toast('Podaci su sačuvani');
      } catch (err) {
        toast(err.message);
      }
    });
    $('#pwForm2').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      const m = $('#pwMsg2');
      m.style.color = 'var(--err)';
      if (f.next.value !== f.next2.value) return (m.textContent = 'Nove lozinke se ne poklapaju.');
      try {
        await api('PUT', '/api/admin/account', { current: f.current.value, username: f.username.value, next: f.next.value });
        await App.refreshMe();
        f.current.value = f.next.value = f.next2.value = '';
        m.style.color = 'var(--ok)';
        m.textContent = 'Sačuvano.';
      } catch (err) {
        m.textContent = err.message;
      }
    });
    $('#pwMail').onclick = async () => {
      if (!u.email) return toast('Prvo upišite i sačuvajte svoj email.');
      await api('POST', '/api/auth/forgot', { login: u.username });
      toast(`Link za novu lozinku je poslat na ${u.email}`);
    };
    if (params?.get('pw')) {
      $('#pwHead').scrollIntoView({ block: 'start', behavior: 'smooth' });
      setTimeout(() => $('#pwForm2').current.focus(), 300);
    }
  }
  App.view('profile', { title: 'Moj profil', sub: 'Slika, lični podaci i lozinka.', load: async (p) => (await App.refreshMe(), renderProfile(p)) });

  // ---------- korisnici portala ----------
  let users = [];
  async function loadUsers() {
    users = await api('GET', '/api/admin/users');
    const me = App.me.user.id;
    $('#usersBox').innerHTML = `<div class="panel">
<div class="panel-head"><div><h2>Korisnici</h2><p class="sub small">Svako se prijavljuje svojim korisničkim imenom. Administrator vidi sve; saradnik sve osim podešavanja, izgleda sajta i korisnika.</p></div><button class="btn primary" id="addUser">Dodaj korisnika</button></div>
${users
  .map(
    (u) => `<div class="urow${u.active ? '' : ' off'}" data-id="${u.id}">
${App.avatar(u)}
<div class="u-main"><b>${esc(u.name)}${u.id === me ? ' <span class="tag">vi</span>' : ''}</b><span>${esc(u.username)}${u.email ? ' · ' + esc(u.email) : ''}</span></div>
<div class="u-role"><span class="tag ${u.role === 'admin' ? 'up' : ''}">${ROLE[u.role]}</span>${u.active ? '' : '<span class="tag muted">isključen</span>'}</div>
<div class="u-last small sub">${u.lastLoginAt ? 'prijava ' + fmt.stamp(u.lastLoginAt) : 'još se nije prijavio/la'}</div>
<div class="acts"><button class="btn sm" data-edit>Izmeni</button>${u.email ? '<button class="btn sm" data-reset>Pošalji link za lozinku</button>' : ''}${u.id === me ? '' : '<button class="btn sm danger" data-del>Obriši</button>'}</div>
</div>`
  )
  .join('')}</div>`;
    $('#addUser').onclick = () => editUser();
  }
  $('#usersBox').addEventListener('click', async (e) => {
    const row = e.target.closest('.urow');
    if (!row) return;
    const u = users.find((x) => x.id === row.dataset.id);
    if (e.target.closest('[data-edit]')) editUser(u);
    if (e.target.closest('[data-reset]')) {
      try {
        await api('POST', `/api/admin/users/${u.id}/reset`);
        toast(`Link za novu lozinku je poslat na ${u.email}`);
      } catch (err) {
        toast(err.message);
      }
    }
    if (e.target.closest('[data-del]')) {
      if (!(await ask(`Obrisati korisnika ${u.name}?`, 'Korisnik više neće moći da se prijavi. Podaci koje je uneo ostaju.', 'Obriši', true))) return;
      try {
        await api('DELETE', '/api/admin/users/' + u.id);
        toast('Korisnik je obrisan');
        loadUsers();
      } catch (err) {
        toast(err.message);
      }
    }
  });

  function editUser(u) {
    const isNew = !u;
    u = u || { name: '', username: '', email: '', role: 'staff', active: true };
    modal.open(
      `<form class="mform"><h3>${isNew ? 'Novi korisnik' : 'Izmena korisnika'}</h3>
<div class="row2">
<label class="f">Ime i prezime<input name="name" value="${esc(u.name)}" required></label>
<label class="f">Korisničko ime<input name="username" value="${esc(u.username)}" ${isNew ? 'required' : 'disabled'} autocapitalize="none" spellcheck="false"></label>
</div>
<label class="f">Email<input name="email" type="email" value="${esc(u.email)}" placeholder="za pozivnicu i novu lozinku"></label>
<fieldset class="f"><legend>Uloga</legend><div class="roles">${['staff', 'admin']
        .map((r) => `<label class="role"><input type="radio" name="role" value="${r}" ${u.role === r ? 'checked' : ''}><span><b>${ROLE[r]}</b><small>${ROLE_TXT[r]}</small></span></label>`)
        .join('')}</div></fieldset>
<label class="f">${isNew ? 'Lozinka <small>ostavite prazno da korisnik dobije pozivnicu emailom i sam postavi lozinku</small>' : 'Nova lozinka <small>prazno = ostaje ista</small>'}<input name="password" type="password" minlength="8" autocomplete="new-password"></label>
${isNew ? '' : `<label class="switch"><input type="checkbox" name="active" ${u.active ? 'checked' : ''}><span class="sw"></span><span>Nalog je aktivan (isključen nalog ne može da se prijavi)</span></label>`}
<p class="err"></p>
<div class="btn-row"><span class="grow"></span><button type="button" class="btn" data-close>Odustani</button><button class="btn primary">${isNew ? 'Dodaj korisnika' : 'Sačuvaj'}</button></div></form>`,
      async (f) => {
        const body = { name: f.name.value, email: f.email.value, role: f.role.value, password: f.password.value };
        if (isNew) {
          body.username = f.username.value;
          const r = await api('POST', '/api/admin/users', body);
          toast(r.invite === 'sent' ? `Pozivnica je poslata na ${r.email}` : r.invite ? `Korisnik je dodat, ali pozivnica nije poslata: ${r.invite}` : 'Korisnik je dodat');
        } else {
          body.active = f.active.checked;
          await api('PUT', '/api/admin/users/' + u.id, body);
          toast('Sačuvano');
          if (u.id === App.me.user.id) await App.refreshMe();
        }
        loadUsers();
      }
    );
  }

  App.view('users', { role: 'admin', title: 'Korisnici portala', sub: 'Ko može da se prijavi u administraciju i šta vidi.', load: loadUsers });
})();
