// Javne stranice: početna, preuzimanje, istekao link (stil: fotografija preko celog ekrana + kartica).
const { esc, formatDate, formatSize, photoWord, remaining, socialUrl } = require('./util');

const CSS = `
:root{--ink:#4a3236;--muted:#9c8486;--white:#fff;--peach:#fed6bc;--radius:22px}
*{box-sizing:border-box}
html,body{margin:0;height:100%}
body{font-family:'Jost',system-ui,sans-serif;color:var(--ink);background:var(--blush);-webkit-font-smoothing:antialiased;line-height:1.55}
a{color:inherit}
:focus-visible{outline:2px solid var(--accent-strong);outline-offset:3px}

/* pozadina */
.stage{position:fixed;inset:0;z-index:0;overflow:hidden;background:linear-gradient(135deg,var(--blush) 0%,var(--wash) 55%,var(--peach) 140%)}
.stage .mark{position:absolute;right:7vw;top:50%;width:min(40vw,520px);transform:translateY(-50%);opacity:.22}
.slide{position:absolute;inset:0;background-size:cover;background-position:center;opacity:0;transition:opacity 1.6s ease;transform:scale(1.04)}
.slide.on{opacity:1;animation:drift 14s ease-out forwards}
@keyframes drift{from{transform:scale(1.08)}to{transform:scale(1)}}
.stage.ph::after{content:"";position:absolute;inset:0;z-index:99999;background:linear-gradient(90deg,rgba(74,50,54,.18),rgba(74,50,54,0) 45%)}
@media (prefers-reduced-motion:reduce){.slide,.slide.on{transition:none;animation:none;transform:none}}

/* zaglavlje */
.top{position:fixed;top:0;left:0;right:0;display:flex;align-items:center;justify-content:space-between;padding:18px 24px;z-index:5;pointer-events:none}
.top>*{pointer-events:auto}
.plate{display:block;background:var(--white);border-radius:999px;padding:8px 26px 8px 12px;box-shadow:0 4px 22px rgba(74,50,54,.12)}
.plate img{display:block;height:58px;width:auto}
.top nav{display:flex;gap:8px}
.chip{display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,.92);border-radius:999px;padding:9px 16px;font-size:14px;text-decoration:none;box-shadow:0 4px 18px rgba(74,50,54,.1)}
.chip svg{width:16px;height:16px}

/* kartica */
.wrap{position:relative;z-index:2;min-height:100%;display:flex;align-items:center;padding:100px 0 60px 6vw}
.card{width:min(420px,100%);background:var(--white);border-radius:var(--radius);box-shadow:0 18px 60px rgba(74,50,54,.18);padding:34px 32px 28px;animation:rise .7s cubic-bezier(.2,.7,.2,1) both}
@keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.card{animation:none}}
.card h1{font-family:'Italiana',Georgia,serif;font-weight:400;font-size:38px;line-height:1.12;margin:0 0 10px;letter-spacing:.01em}
.card .lead{margin:0 0 20px;color:var(--muted);font-size:16px}
.note{margin:0 0 22px;padding:14px 16px;background:var(--wash);border-radius:14px;font-size:15px;white-space:pre-line}
.facts{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 18px}
.facts span{background:var(--blush);border-radius:999px;padding:4px 12px;font-size:13px}
.files{list-style:none;margin:0 0 20px;padding:0;max-height:236px;overflow:auto;border-top:1px solid var(--blush-2)}
.files li{display:flex;align-items:center;gap:12px;padding:10px 2px;border-bottom:1px solid var(--blush-2)}
.files .th{width:40px;height:40px;border-radius:10px;object-fit:cover;background:var(--blush);flex:none}
.files .zi{width:40px;height:40px;border-radius:10px;background:var(--blush);display:grid;place-items:center;color:var(--accent-strong);flex:none}
.files .n{flex:1;min-width:0}
.files .n b{display:block;font-weight:500;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.files .n small{color:var(--muted);font-size:12px}
.files a.get{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;color:var(--accent-strong);text-decoration:none;flex:none}
.files a.get:hover{background:var(--blush)}
.files svg{width:18px;height:18px}
.btn{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;background:var(--accent-strong);color:#fff;border:0;border-radius:999px;padding:16px 22px;font:500 16px 'Jost',sans-serif;letter-spacing:.02em;text-decoration:none;cursor:pointer;transition:background .2s}
.btn:hover{background:var(--accent-deep)}
.btn svg{width:19px;height:19px}
.ghost{display:block;width:100%;margin-top:10px;background:none;border:1.5px solid var(--blush-line);color:var(--ink);border-radius:999px;padding:13px;font:500 15px 'Jost',sans-serif;cursor:pointer;text-align:center;text-decoration:none}
.ghost:hover{border-color:var(--accent)}
.fine{margin:16px 0 0;font-size:13px;color:var(--muted);text-align:center}

.open{display:flex;gap:8px;margin:0 0 6px}
.open input{flex:1;min-width:0;border:1.5px solid var(--blush-line);border-radius:999px;padding:13px 18px;font:15px 'Jost',sans-serif;color:var(--ink);outline:none;background:var(--wash)}
.open input:focus{border-color:var(--accent)}
.open button{border:0;border-radius:999px;background:var(--accent-strong);color:#fff;font:500 15px 'Jost',sans-serif;padding:0 22px;cursor:pointer}
.open-err{font-size:13px;color:#b5534c;min-height:18px;margin:0 0 6px 18px}
.contact{margin:18px 0 0;padding:18px 0 0;border-top:1px solid var(--blush-2);display:grid;gap:4px}
.contact a,.contact span{display:flex;align-items:center;gap:12px;padding:6px 0;text-decoration:none;font-size:15px}
.contact a:hover{color:var(--accent-strong)}
.contact svg{width:18px;height:18px;color:var(--accent-strong);flex:none}
.foot{position:fixed;right:24px;bottom:16px;z-index:3;font-size:12px;color:#fff;text-shadow:0 1px 8px rgba(0,0,0,.35)}
.foot.plain{color:var(--muted);text-shadow:none}

/* galerija preko celog ekrana */
.gal{position:fixed;inset:0;z-index:20;background:#fff;overflow:auto;display:none}
.gal.on{display:block}
.gal header{position:sticky;top:0;display:flex;align-items:center;gap:16px;padding:14px 20px;background:rgba(255,255,255,.95);backdrop-filter:blur(8px);border-bottom:1px solid var(--blush-2);z-index:2}
.gal header img{height:34px}
.gal header b{flex:1;font-weight:500}
.gal header .btn{width:auto;padding:11px 20px;font-size:14px}
.x{background:var(--blush);border:0;width:42px;height:42px;border-radius:50%;font-size:22px;line-height:1;cursor:pointer;color:var(--ink);flex:none}
.grid{columns:4 260px;column-gap:8px;padding:8px}
.grid figure{margin:0 0 8px;break-inside:avoid;position:relative;border-radius:6px;overflow:hidden;background:var(--blush);cursor:zoom-in}
.grid img{display:block;width:100%;height:auto}
.grid a{position:absolute;right:8px;bottom:8px;width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.94);display:grid;place-items:center;color:var(--accent-strong);opacity:0;transition:opacity .2s}
.grid figure:hover a,.grid a:focus{opacity:1}
@media (hover:none){.grid a{opacity:1}}
.grid svg{width:17px;height:17px}

.lb{position:fixed;inset:0;z-index:30;background:rgba(40,26,29,.96);display:none;color:#fff}
.lb.on{display:block}
.lb img{position:absolute;inset:60px 12px 76px;margin:auto;max-width:calc(100% - 24px);max-height:calc(100% - 136px);object-fit:contain}
.lb .x{position:absolute;top:12px;right:12px;background:rgba(255,255,255,.12);color:#fff}
.lb .nav{position:absolute;top:50%;transform:translateY(-50%);background:rgba(255,255,255,.12);border:0;color:#fff;width:48px;height:48px;border-radius:50%;font-size:26px;cursor:pointer}
.lb .prev{left:14px}.lb .next{right:14px}
.lb .bar{position:absolute;left:0;right:0;bottom:16px;display:flex;justify-content:center;align-items:center;gap:16px;font-size:14px}
.lb .bar a{background:#fff;color:var(--ink);border-radius:999px;padding:9px 18px;text-decoration:none;font-weight:500}

@media (max-width:760px){
  .stage{position:absolute;height:44vh;bottom:auto}
  .stage.ph::after{background:linear-gradient(0deg,rgba(74,50,54,.12),rgba(74,50,54,0) 50%)}
  .stage .mark{width:60vw;right:50%;transform:translate(50%,-50%)}
  .top{position:absolute;padding:14px}
  .plate img{height:40px}
  .top nav .chip span{display:none}
  .wrap{padding:calc(44vh - 40px) 12px 24px;align-items:flex-start}
  .card{width:100%;padding:26px 22px 22px}
  .card h1{font-size:32px}
  .foot{position:static;text-align:center;color:var(--muted);text-shadow:none;padding:0 0 24px}
  .lb .nav{display:none}
  .gal header b{display:none}
}
`;

const I = {
  dl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11m0 0 4.5-4.5M12 15l-4.5-4.5M5 19.5h14"/></svg>',
  zip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M10 6h2M10 9h2M10 12h2M10 15h2v3h-2z"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6 8.5 7 8.5-7"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
  ig: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',
  fb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M14 21v-8h3l.5-3.5H14V7.5c0-1 .4-1.7 1.8-1.7H18V2.7A20 20 0 0 0 15.3 2.5C12.6 2.5 11 4 11 6.9v2.6H8V13h3v8"/></svg>',
  web: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
};

function themeLink(site) {
  return `/brand/theme.css?v=${site.v}-${encodeURIComponent(String(site.s.accentColor).replace('#', ''))}`;
}

function shell(site, title, { bgs = [], body = '', after = '', footer = true }) {
  const s = site.s;
  const slides = bgs.length
    ? bgs.map((u, i) => `<div class="slide${i === 0 ? ' on' : ''}" ${i === 0 ? `style="background-image:url('${esc(u)}')"` : `data-bg="${esc(u)}"`}></div>`).join('')
    : `<img class="mark" src="/brand/icon?v=${site.v}" alt="">`;
  const ig = socialUrl('instagram', s.instagram);
  const foot = s.footerText || `© ${new Date().getFullYear()} ${s.studioName}`;
  return `<!doctype html><html lang="sr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="theme-color" content="#ffffff">
<link rel="icon" href="/brand/icon?v=${site.v}">
<link rel="apple-touch-icon" href="/brand/icon?v=${site.v}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Italiana&family=Jost:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${themeLink(site)}">
<style>${CSS}</style></head><body>
<div class="stage${bgs.length ? ' ph' : ''}" aria-hidden="true">${slides}</div>
<header class="top"><a class="plate" href="/" aria-label="${esc(s.studioName)} – početna"><img src="/brand/logo?v=${site.v}" alt="${esc(s.studioName)}"></a>
<nav>${ig ? `<a class="chip" href="${esc(ig)}" target="_blank" rel="noopener">${I.ig}<span>Instagram</span></a>` : ''}${s.contactEmail ? `<a class="chip" href="mailto:${esc(s.contactEmail)}">${I.mail}<span>Kontakt</span></a>` : ''}</nav></header>
<main class="wrap">${body}</main>
${footer ? `<div class="foot${bgs.length ? '' : ' plain'}">${esc(foot)}</div>` : ''}
${after}
${bgs.length > 1 ? `<script>(function(){if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;var s=[].slice.call(document.querySelectorAll('.slide')),i=0,z=1;
function load(el){if(el.dataset.bg){el.style.backgroundImage="url('"+el.dataset.bg+"')";el.removeAttribute('data-bg')}}
load(s[1]);setInterval(function(){var a=s[i];i=(i+1)%s.length;var b=s[i];load(b);load(s[(i+1)%s.length]);b.classList.remove('on');b.style.zIndex=++z;void b.offsetWidth;b.classList.add('on');setTimeout(function(){a.classList.remove('on')},1700)},7000)})();</script>` : ''}
</body></html>`;
}

function contactList(s) {
  const rows = [];
  if (s.contactPhone) rows.push(`<a href="tel:${esc(s.contactPhone.replace(/[^\d+]/g, ''))}">${I.phone}${esc(s.contactPhone)}</a>`);
  if (s.contactEmail) rows.push(`<a href="mailto:${esc(s.contactEmail)}">${I.mail}${esc(s.contactEmail)}</a>`);
  const ig = socialUrl('instagram', s.instagram);
  if (ig) rows.push(`<a href="${esc(ig)}" target="_blank" rel="noopener">${I.ig}${esc(s.instagram.startsWith('http') ? 'Instagram' : '@' + s.instagram.replace(/^@/, ''))}</a>`);
  const fb = socialUrl('facebook', s.facebook);
  if (fb) rows.push(`<a href="${esc(fb)}" target="_blank" rel="noopener">${I.fb}Facebook</a>`);
  const web = socialUrl('web', s.website);
  if (web) rows.push(`<a href="${esc(web)}" target="_blank" rel="noopener">${I.web}${esc(s.website.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</a>`);
  if (s.address) rows.push(`<span>${I.pin}${esc(s.address)}</span>`);
  return rows.length ? `<div class="contact">${rows.join('')}</div>` : '';
}

const siteBgs = (site) => site.bgs.map((b) => `/brand/bg/${b.id}`);

function home(site) {
  const s = site.s;
  const body = `<section class="card">
<h1>${esc(s.homeTitle)}</h1>
<p class="lead">${esc(s.homeText)}</p>
<form class="open" id="open"><input name="code" placeholder="Nalepite link iz poruke" aria-label="Link za preuzimanje" autocomplete="off"><button>Otvori</button></form>
<p class="open-err" id="openErr" role="alert"></p>
${contactList(s)}
</section>
<script>document.getElementById('open').addEventListener('submit',function(e){e.preventDefault();var v=this.code.value.trim(),m=v.match(/\\/d\\/([A-Za-z0-9_-]+)/),t=m?m[1]:v.replace(/[^A-Za-z0-9_-]/g,'');
if(t.length<10){document.getElementById('openErr').textContent='Nalepite ceo link koji ste dobili emailom.';return}location.href='/d/'+t});</script>`;
  return shell(site, s.studioName, { bgs: siteBgs(site), body });
}

function download(t, site) {
  const s = site.s;
  const base = `/d/${t.token}`;
  const isPic = (f) => /\.(jpe?g)$/i.test(f.name);
  const imgs = t.files.filter(isPic);
  const zips = t.files.length - imgs.length;
  const isImg = imgs.length > 0;
  const n = t.files.length;
  const what = [imgs.length && `${imgs.length} ${photoWord(imgs.length)}`, zips && (zips === 1 ? 'ZIP arhiva' : `${zips} ZIP arhive`)].filter(Boolean).join(' + ');
  const name = [t.salutation, t.firstName, t.lastName].filter(Boolean).join(' ');

  const list = t.files
    .map(
      (f) => `<li>${isPic(f) ? `<img class="th" loading="lazy" src="${base}/t/${f.id}" alt="">` : `<span class="zi">${I.zip}</span>`}
<span class="n"><b>${esc(f.name)}</b><small>${formatSize(f.size)}</small></span>
<a class="get" href="${base}/f/${f.id}" aria-label="Preuzmi ${esc(f.name)}" title="Preuzmi">${I.dl}</a></li>`
    )
    .join('');

  const main = n > 1 ? `${base}/all` : `${base}/f/${t.files[0].id}`;
  const body = `<section class="card">
<h1>${esc(name)},</h1>
<p class="lead">${esc(s.downloadLead)}</p>
${t.message ? `<p class="note">${esc(t.message)}</p>` : ''}
<div class="facts"><span>${what}</span><span>${formatSize(t.totalSize)}</span><span>Dostupno ${remaining(t.expiresAt)}</span></div>
<ul class="files">${list}</ul>
<a class="btn" href="${main}">${I.dl}${n > 1 ? 'Preuzmi sve' : 'Preuzmi'}</a>
${isImg ? '<button class="ghost" id="openGal" type="button">Pogledaj galeriju</button>' : ''}
<p class="fine">Fotografije se brišu ${esc(formatDate(t.expiresAt))}.</p>
</section>`;

  const bgs = isImg ? imgs.slice(0, 10).map((f) => `${base}/t/${f.id}?s=l`) : siteBgs(site);
  return shell(site, `${s.studioName} – ${t.firstName} ${t.lastName}`, { bgs, body, after: isImg ? gallery({ ...t, files: imgs }, site, base, main) : '' });
}

function gallery(t, site, base, main) {
  const files = JSON.stringify(t.files.map((f) => ({ id: f.id, name: f.name }))).replace(/</g, '\\u003c');
  return `<div class="gal" id="gal" role="dialog" aria-modal="true" aria-label="Galerija">
<header><img src="/brand/logo?v=${site.v}" alt=""><b>${t.files.length} ${photoWord(t.files.length)}</b><a class="btn" href="${main}">${I.dl}Preuzmi sve</a><button class="x" id="galX" aria-label="Zatvori galeriju">&times;</button></header>
<div class="grid" id="grid">${t.files
    .map((f, i) => `<figure data-i="${i}"><img loading="lazy" src="${base}/t/${f.id}" alt="${esc(f.name)}"><a href="${base}/f/${f.id}" aria-label="Preuzmi ${esc(f.name)}">${I.dl}</a></figure>`)
    .join('')}</div></div>
<div class="lb" id="lb" role="dialog" aria-modal="true"><button class="x" aria-label="Zatvori">&times;</button><button class="nav prev" aria-label="Prethodna">&#8249;</button><img alt=""><button class="nav next" aria-label="Sledeća">&#8250;</button><div class="bar"><span id="lbn"></span><a id="lbd" href="#">Preuzmi</a></div></div>
<script>(function(){var F=${files},B=${JSON.stringify(base)},g=document.getElementById('gal'),lb=document.getElementById('lb'),im=lb.querySelector('img'),n=document.getElementById('lbn'),d=document.getElementById('lbd'),i=0,x0=null;
function lock(){document.body.style.overflow=(g.classList.contains('on')||lb.classList.contains('on'))?'hidden':''}
document.getElementById('openGal').onclick=function(){g.classList.add('on');lock();document.getElementById('galX').focus()};
document.getElementById('galX').onclick=function(){g.classList.remove('on');lock()};
function show(k){i=(k+F.length)%F.length;im.src=B+'/f/'+F[i].id+'?inline=1';n.textContent=(i+1)+' / '+F.length;d.href=B+'/f/'+F[i].id;[i+1,i-1].forEach(function(j){j=(j+F.length)%F.length;new Image().src=B+'/f/'+F[j].id+'?inline=1'})}
function close(){lb.classList.remove('on');im.removeAttribute('src');lock()}
document.getElementById('grid').addEventListener('click',function(e){if(e.target.closest('a'))return;var p=e.target.closest('figure');if(p){show(+p.dataset.i);lb.classList.add('on');lock()}});
lb.querySelector('.x').onclick=close;lb.querySelector('.prev').onclick=function(){show(i-1)};lb.querySelector('.next').onclick=function(){show(i+1)};
lb.addEventListener('click',function(e){if(e.target===lb)close()});
document.addEventListener('keydown',function(e){if(lb.classList.contains('on')){if(e.key==='Escape')close();if(e.key==='ArrowLeft')show(i-1);if(e.key==='ArrowRight')show(i+1)}else if(e.key==='Escape'&&g.classList.contains('on')){g.classList.remove('on');lock()}});
lb.addEventListener('touchstart',function(e){x0=e.touches[0].clientX},{passive:true});
lb.addEventListener('touchend',function(e){if(x0===null)return;var dx=e.changedTouches[0].clientX-x0;if(Math.abs(dx)>50)show(i+(dx<0?1:-1));x0=null});})();</script>`;
}

function message(site, title, text) {
  const s = site.s;
  return shell(site, title, {
    bgs: siteBgs(site),
    body: `<section class="card"><h1>${esc(title)}</h1><p class="lead">${text}</p><a class="btn" href="/">Na početnu</a>${contactList(s)}</section>`,
  });
}

const expired = (site) =>
  message(site, 'Link je istekao', 'Fotografije sa ovog linka su obrisane ili link nije ispravan. Ako vam i dalje trebaju, javite nam se i rado ćemo ih poslati ponovo.');
const notFound = (site) => message(site, 'Stranica ne postoji', 'Proverite link koji ste dobili u poruci.');

module.exports = { home, download, expired, notFound };
