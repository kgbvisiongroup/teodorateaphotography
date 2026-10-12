// Javni sajt: zaglavlje, sekcije stranica, portfolio, zakazivanje i kontakt.
// Sav sadržaj dolazi iz panela (data.site), a boje iz teme (/brand/theme.css).
const { esc, socialUrl, formatMoney, currencySymbol } = require('./util');
const { CATEGORIES } = require('./categories');

const I = {
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6 8.5 7 8.5-7"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
  ig: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',
  fb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M14 21v-8h3l.5-3.5H14V7.5c0-1 .4-1.7 1.8-1.7H18V2.7A20 20 0 0 0 15.3 2.5C12.6 2.5 11 4 11 6.9v2.6H8V13h3v8"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.2 2"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13m0 0-5-5m5 5-5 5"/></svg>',
};

const CSS = `
:root{--ink:#4a3236;--muted:#9c8486;--peach:#fed6bc}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;font-family:'Jost',system-ui,sans-serif;color:var(--ink);background:#fff;line-height:1.6;-webkit-font-smoothing:antialiased}
img{max-width:100%;display:block}
a{color:inherit;text-decoration:none}
:focus-visible{outline:2px solid var(--accent-strong);outline-offset:3px}
h1,h2,h3{font-family:'Italiana',Georgia,serif;font-weight:400;letter-spacing:.01em;margin:0}
h1{font-size:clamp(38px,6vw,68px);line-height:1.08}
h2{font-size:clamp(28px,3.6vw,44px);line-height:1.15}
h3{font-size:22px}
p{margin:0}
.wrap{width:min(1180px,100% - 48px);margin-inline:auto}
.sec{padding:clamp(56px,7vw,104px) 0}
.sec.tint{background:linear-gradient(180deg,var(--wash),#fff)}
.sec.blush{background:var(--blush)}
.lead{color:var(--muted);font-size:17px;max-width:62ch}
.eyebrow{display:block;font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:var(--accent-strong);margin-bottom:12px}
.sec-head{margin-bottom:clamp(28px,4vw,48px)}
.sec-head.center{text-align:center}
.sec-head.center .lead{margin-inline:auto}
.sec-head h2+.lead{margin-top:14px}

/* dugmad */
.btn{display:inline-flex;align-items:center;gap:10px;border:0;border-radius:999px;background:var(--accent-strong);color:#fff;padding:15px 30px;font:500 16px 'Jost',sans-serif;cursor:pointer;transition:background .2s,transform .2s}
.btn:hover{background:var(--accent-deep);transform:translateY(-1px)}
.btn svg{width:18px;height:18px}
.btn.ghost{background:transparent;color:var(--ink);box-shadow:inset 0 0 0 1.5px var(--blush-line)}
.btn.ghost:hover{background:#fff;box-shadow:inset 0 0 0 1.5px var(--accent)}
.btn.light{background:rgba(255,255,255,.94);color:var(--ink)}
.btn.light:hover{background:#fff}
.btn.block{width:100%;justify-content:center}

/* zaglavlje */
.hdr{position:fixed;top:0;left:0;right:0;z-index:40;transition:background .3s,box-shadow .3s,padding .3s;padding:14px 0}
.hdr .wrap{display:flex;align-items:center;gap:20px}
.hdr .logo{display:block;border-radius:999px;padding:0;transition:background .3s,padding .3s,box-shadow .3s}
.hdr .logo img{height:54px;width:auto;transition:height .3s}
.hdr nav{margin-left:auto;display:flex;align-items:center;gap:6px}
.hdr nav a{padding:10px 14px;border-radius:999px;font-size:15px;transition:background .2s,color .2s}
.hdr nav a:hover,.hdr nav a[aria-current]{background:rgba(255,255,255,.22)}
.hdr .btn{padding:11px 22px;font-size:15px}
.hdr.solid{background:rgba(255,255,255,.96);backdrop-filter:blur(10px);box-shadow:0 2px 24px rgba(74,50,54,.09);padding:8px 0}
.hdr.solid .logo img{height:44px}
.hdr.solid nav a:hover,.hdr.solid nav a[aria-current]{background:var(--blush)}
.hdr.over nav a,.hdr.over .burger{color:#fff;text-shadow:0 1px 12px rgba(40,26,29,.45)}
.hdr.over .logo{background:rgba(255,255,255,.94);padding:6px 20px;box-shadow:0 6px 24px rgba(40,26,29,.18)}
/* prekidač jezika */
.lang{display:flex;align-items:center;gap:2px;border:1px solid rgba(154,132,134,.35);border-radius:999px;padding:3px;font-size:13px;letter-spacing:.04em}
.lang a{padding:5px 10px;border-radius:999px;color:inherit;opacity:.72}
.lang a:hover{opacity:1}
.lang a.on{background:var(--accent-strong);color:#fff;opacity:1}
.hdr.over .lang{border-color:rgba(255,255,255,.5)}
.hdr.over .lang a{color:#fff}
.mnav .lang{align-self:flex-start;margin-top:18px;border-color:var(--blush-line)}
.mnav .lang a{font-size:15px;font-family:'Jost',sans-serif;border:0;padding:8px 16px}
/* padajući meni */
.hdr .has-sub{position:relative;display:flex;align-items:center}
.hdr .has-sub .caret{width:15px;height:15px;margin-left:-8px;pointer-events:none;opacity:.8}
.hdr .sub{position:absolute;top:100%;left:0;min-width:270px;background:#fff;border-radius:16px;box-shadow:0 18px 48px rgba(74,50,54,.18);padding:8px;display:none;flex-direction:column;gap:2px}
.hdr .has-sub:hover .sub,.hdr .has-sub:focus-within .sub{display:flex}
.hdr .sub a{display:block;padding:10px 14px;border-radius:10px;font-size:14.5px;color:var(--ink);white-space:nowrap}
.hdr .sub a:hover,.hdr .sub a[aria-current]{background:var(--blush)}
.mnav .sub-link{padding-left:18px;font-size:17px;color:var(--muted)}

.burger{display:none;margin-left:auto;background:none;border:0;color:var(--ink);padding:8px;cursor:pointer}
.burger svg{width:28px;height:28px}
.mnav{position:fixed;inset:0;z-index:50;background:#fff;transform:translateX(100%);transition:transform .3s;display:flex;flex-direction:column;padding:18px 24px 32px;overflow:auto}
.mnav.on{transform:none}
.mnav .x{align-self:flex-end;background:var(--blush);border:0;width:44px;height:44px;border-radius:50%;font-size:24px;cursor:pointer;color:var(--ink)}
.mnav a{padding:16px 4px;font-size:22px;font-family:'Italiana',serif;border-bottom:1px solid var(--blush-2)}
.mnav .btn{margin-top:22px;justify-content:center}

/* slider usluge */
.srv{padding-top:clamp(104px,13vw,150px)}
.srv-slider{position:relative;border-radius:26px;overflow:hidden;background:linear-gradient(135deg,var(--blush),var(--wash));aspect-ratio:16/9}
.srv-slider .sl{position:absolute;inset:0;background-size:cover;background-position:center;opacity:0;transition:opacity .8s ease}
.srv-slider .sl.on{opacity:1}
.srv-slider .ar{position:absolute;top:50%;transform:translateY(-50%);width:46px;height:46px;border-radius:50%;border:0;background:rgba(255,255,255,.9);color:var(--ink);font-size:22px;cursor:pointer;display:grid;place-items:center;box-shadow:0 6px 18px rgba(74,50,54,.18)}
.srv-slider .ar.prev{left:14px}
.srv-slider .ar.next{right:14px}
.srv-slider .dots{position:absolute;left:0;right:0;bottom:14px;display:flex;justify-content:center;gap:7px}
.srv-slider .dots button{width:8px;height:8px;border-radius:50%;border:0;background:rgba(255,255,255,.6);cursor:pointer;padding:0}
.srv-slider .dots button.on{background:#fff;width:22px;border-radius:999px}
.srv-body{text-align:center;max-width:74ch;margin:clamp(26px,3.4vw,42px) auto 0}
.srv-body.bare{margin-top:0}
.srv-body h1{margin-bottom:16px}
.srv-body p{color:var(--muted);font-size:17px;white-space:pre-line}
.srv-body .btn{margin-top:26px}

/* kartice usluga */
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:clamp(16px,2vw,26px)}
.card-s{display:block;border-radius:20px;overflow:hidden;background:var(--wash);box-shadow:0 10px 30px rgba(74,50,54,.08);transition:transform .25s,box-shadow .25s}
.card-s:hover{transform:translateY(-3px);box-shadow:0 18px 44px rgba(74,50,54,.14)}
.card-s .ph{aspect-ratio:4/3;background:linear-gradient(135deg,var(--blush),var(--wash))}
.card-s .ph img{width:100%;height:100%;object-fit:cover}
.card-s .t{display:block;padding:16px 18px 20px;background:#fff}
.card-s .t b{display:block;font-family:'Italiana',Georgia,serif;font-size:21px;font-weight:400}
.card-s .t small{display:block;color:var(--muted);font-size:14px;margin-top:6px}

/* hero */
.hero{position:relative;min-height:min(92vh,860px);display:flex;align-items:flex-end;overflow:hidden;background:var(--blush)}
.hero.short{min-height:48vh}
.hero .slides{position:absolute;inset:0}
.hero .slide{position:absolute;inset:0;background-size:cover;background-position:center;opacity:0;transition:opacity 1.5s ease}
.hero .slide.on{opacity:1;animation:drift 12s ease-out forwards}
@keyframes drift{from{transform:scale(1.07)}to{transform:scale(1)}}
.hero::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(40,26,29,.42) 0,rgba(40,26,29,.08) 38%,rgba(40,26,29,.58) 100%)}
.hero .inner{position:relative;z-index:2;color:#fff;padding:0 0 clamp(54px,8vw,96px);width:min(1180px,100% - 48px);margin-inline:auto}
.hero h1{max-width:16ch;text-shadow:0 2px 30px rgba(40,26,29,.35)}
.hero p{margin-top:18px;max-width:52ch;font-size:18px;color:rgba(255,255,255,.93);text-shadow:0 1px 16px rgba(40,26,29,.4)}
.hero .acts{display:flex;flex-wrap:wrap;gap:12px;margin-top:30px}
.hero .dots{position:absolute;right:max(24px,calc((100% - 1180px)/2));bottom:clamp(54px,8vw,96px);z-index:2;display:flex;gap:8px}
.hero .dots button{width:9px;height:9px;padding:0;border-radius:50%;border:0;background:rgba(255,255,255,.45);cursor:pointer}
.hero .dots button.on{background:#fff;width:26px;border-radius:999px}
.page-head{padding:clamp(120px,16vw,190px) 0 clamp(34px,5vw,60px);background:linear-gradient(180deg,var(--blush),#fff);text-align:center}
.page-head .lead{margin:14px auto 0}
.page-head+.sec{padding-top:clamp(28px,3vw,44px)}

/* kategorije */
.cats{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:18px}
.cat{position:relative;border-radius:20px;overflow:hidden;aspect-ratio:3/4;background:var(--blush-2);display:flex;align-items:flex-end;color:#fff;isolation:isolate}
.cat img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-2;transition:transform .6s}
.cat::after{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,rgba(40,26,29,0) 35%,rgba(40,26,29,.68))}
.cat:hover img{transform:scale(1.05)}
.cat .t{padding:20px 22px}
.cat b{font-family:'Italiana',serif;font-weight:400;font-size:26px;display:block}
.cat small{opacity:.88;font-size:14px}
.cat.empty{background:linear-gradient(140deg,var(--blush),var(--wash));color:var(--ink)}
.cat.empty::after{display:none}

/* portfolio */
.filters{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-bottom:28px}
.filters button{border:0;background:var(--wash);color:var(--ink);border-radius:999px;padding:9px 18px;font:400 15px 'Jost',sans-serif;cursor:pointer}
.filters button.on{background:var(--accent-strong);color:#fff}
.albums{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:20px}
.album{display:block;border-radius:18px;overflow:hidden;background:var(--wash);position:relative}
.album .ph{aspect-ratio:4/5;background:var(--blush-2) center/cover}
.album img{width:100%;height:100%;object-fit:cover;transition:transform .6s}
.album:hover img{transform:scale(1.04)}
.album .t{padding:16px 18px 20px}
.album .t b{font-family:'Italiana',serif;font-weight:400;font-size:22px;display:block}
.album .t small{color:var(--muted)}
.masonry{columns:3 300px;column-gap:14px}
.masonry figure{margin:0 0 14px;break-inside:avoid;border-radius:14px;overflow:hidden;background:var(--blush);cursor:zoom-in}
.masonry img{width:100%;height:auto;transition:opacity .3s}
.back{display:inline-flex;align-items:center;gap:8px;color:var(--muted);margin-bottom:18px}
.back svg{width:16px;height:16px;transform:rotate(180deg)}

/* tekst + slika */
.split{display:grid;grid-template-columns:1.05fr .95fr;gap:clamp(28px,5vw,64px);align-items:center}
.split.rev>.pic{order:2}
.split .pic img{border-radius:22px;aspect-ratio:4/5;object-fit:cover;width:100%}
.split.one{grid-template-columns:1fr;max-width:72ch}
.split .txt p{margin-top:16px;color:var(--muted);font-size:17px;white-space:pre-line}

/* paketi */
.pkgs{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px}
.pkg{background:#fff;border:1px solid var(--blush-2);border-radius:20px;padding:26px 24px;display:flex;flex-direction:column;gap:10px}
.pkg .cat-tag{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent-strong)}
.pkg b{font-family:'Italiana',serif;font-weight:400;font-size:26px}
.pkg .price{font-size:30px;font-family:'Italiana',serif;color:var(--accent-deep)}
.pkg .desc{color:var(--muted);font-size:15px;white-space:pre-line}
.pkg .extra{font-size:14px;color:var(--muted);margin-top:auto;padding-top:10px;border-top:1px solid var(--blush-2)}
.pkg-group{margin-bottom:34px}
.pkg-group h3{margin-bottom:14px;font-size:26px}

/* utisci */
.quotes{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px}
.quote{background:#fff;border-radius:20px;padding:26px;box-shadow:0 10px 40px rgba(74,50,54,.07)}
.quote p{font-style:italic;color:var(--ink);white-space:pre-line}
.quote b{display:block;margin-top:14px;font-weight:500;color:var(--accent-strong)}

/* faq */
.faq.two{display:grid;grid-template-columns:1fr 1fr;gap:10px 22px;align-items:start;max-width:none}
.faq{display:grid;gap:10px;max-width:840px}
.faq details{background:#fff;border:1px solid var(--blush-2);border-radius:16px;padding:4px 20px}
.faq summary{cursor:pointer;padding:16px 0;font-weight:500;list-style:none;display:flex;justify-content:space-between;gap:16px;align-items:center}
.faq summary::-webkit-details-marker{display:none}
.faq summary::after{content:"+";color:var(--accent-strong);font-size:22px;line-height:1}
.faq details[open] summary::after{content:"–"}
.faq p{padding:0 0 18px;color:var(--muted);white-space:pre-line}

/* cta */
.cta{background:linear-gradient(135deg,var(--blush),var(--wash));border-radius:28px;padding:clamp(34px,5vw,60px);text-align:center}
.cta .lead{margin:14px auto 24px}

/* kontakt i forme */
.contact-grid{display:grid;grid-template-columns:.9fr 1.1fr;gap:clamp(26px,4vw,56px);align-items:start}
.info{display:grid;gap:14px}
.info a,.info div{display:flex;gap:14px;align-items:flex-start;font-size:16px}
.info svg{width:20px;height:20px;color:var(--accent-strong);flex:none;margin-top:3px}
.info small{display:block;color:var(--muted);font-size:13px}
.card{background:#fff;border:1px solid var(--blush-2);border-radius:22px;padding:clamp(22px,3vw,34px)}
.f{display:block;margin-bottom:14px}
.f span{display:block;font-size:14px;color:var(--muted);margin-bottom:6px}
.f input,.f select,.f textarea{width:100%;border:1.5px solid var(--blush-line);border-radius:14px;background:var(--wash);padding:13px 16px;font:16px 'Jost',sans-serif;color:var(--ink);outline:none}
.f textarea{min-height:120px;resize:vertical}
.f input:focus,.f select:focus,.f textarea:focus{border-color:var(--accent);background:#fff}
.row2{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.chips label{position:relative}
.chips input{position:absolute;opacity:0;inset:0;cursor:pointer}
.chips span{display:block;border:1.5px solid var(--blush-line);border-radius:999px;padding:10px 18px;font-size:15px;cursor:pointer;background:var(--wash)}
.chips input:checked+span{border-color:var(--accent-strong);background:#fff;box-shadow:inset 0 0 0 1px var(--accent-strong)}
.chips input:focus-visible+span{outline:2px solid var(--accent-strong);outline-offset:2px}
.form-msg{margin-top:12px;font-size:15px}
.form-msg.err{color:#b5534c}
.form-msg.ok{color:#2f7d4f}
.done{text-align:center;padding:28px 10px}
.done h3{font-size:28px;margin-bottom:10px}

/* izbor datuma i vremena */
.dpick{position:relative}
.dpick .fld{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;border:1.5px solid var(--blush-line);border-radius:14px;background:var(--wash);padding:13px 16px;font:16px 'Jost',sans-serif;color:var(--ink);cursor:pointer;text-align:left}
.dpick .fld.ph{color:var(--muted)}
.dpick .fld svg{width:18px;height:18px;color:var(--accent-strong);flex:none}
.dpick .pop{position:absolute;z-index:30;top:calc(100% + 6px);left:0;width:300px;max-width:100%;background:#fff;border:1px solid var(--blush-2);border-radius:18px;box-shadow:0 20px 50px rgba(74,50,54,.18);padding:12px;display:none}
.dpick.on .pop{display:block}
.dpick.up .pop{top:auto;bottom:calc(100% + 6px)}
.dpick .pop-h{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.dpick .pop-h b{flex:1;text-align:center;font-weight:500;font-size:15px}
.dpick .pop-h button{width:32px;height:32px;border:0;border-radius:50%;background:var(--wash);cursor:pointer;font-size:18px;color:var(--ink)}
.dpick .wd,.dpick .days{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;text-align:center}
.dpick .wd span{font-size:11px;color:var(--muted);padding:4px 0}
.dpick .days button{aspect-ratio:1;border:0;background:none;border-radius:50%;font:14px 'Jost',sans-serif;color:var(--ink);cursor:pointer}
.dpick .days button:hover:not(:disabled){background:var(--blush)}
.dpick .days button.sel{background:var(--accent-strong);color:#fff}
.dpick .days button:disabled{color:var(--blush-line);cursor:default}
.tslots{display:grid;grid-template-columns:repeat(auto-fill,minmax(74px,1fr));gap:6px;margin-top:4px}
.tslots label input{position:absolute;opacity:0}
.tslots span{display:block;text-align:center;border:1.5px solid var(--blush-line);border-radius:10px;padding:9px 0;font-size:15px;background:var(--wash);cursor:pointer}
.tslots input:checked+span{border-color:var(--accent-strong);background:#fff;box-shadow:inset 0 0 0 1px var(--accent-strong)}

/* preuzimanje */
.dl-box{max-width:620px;margin-inline:auto;text-align:center}
.dl-form{display:flex;gap:10px;margin-top:22px}
.dl-form input{flex:1;border:1.5px solid var(--blush-line);border-radius:999px;padding:15px 22px;font:16px 'Jost',sans-serif;background:var(--wash);outline:none}
.dl-form input:focus{border-color:var(--accent)}

/* podnožje */
.foot{background:var(--ink);color:rgba(255,255,255,.82);padding:56px 0 28px;margin-top:0}
.foot .cols{display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:34px}
.foot h4{font-family:'Italiana',serif;font-weight:400;font-size:22px;color:#fff;margin:0 0 14px}
.foot a{display:block;padding:4px 0;color:rgba(255,255,255,.82)}
.foot a:hover{color:#fff}
.foot .soc{display:flex;gap:10px;margin-top:14px}
.foot .soc a{width:42px;height:42px;border-radius:50%;background:rgba(255,255,255,.1);display:grid;place-items:center}
.foot .soc svg{width:19px;height:19px}
.foot .bar{margin-top:40px;padding-top:18px;border-top:1px solid rgba(255,255,255,.14);display:flex;flex-wrap:wrap;gap:10px;justify-content:space-between;font-size:13px;color:rgba(255,255,255,.6)}
.foot .logo{display:inline-block;background:#fff;border-radius:999px;padding:8px 20px}
.foot .logo img{height:46px}

/* lightbox */
.lb{position:fixed;inset:0;z-index:60;background:rgba(32,20,23,.96);display:none}
.lb.on{display:block}
.lb img{position:absolute;inset:56px 12px 70px;margin:auto;max-width:calc(100% - 24px);max-height:calc(100% - 126px);object-fit:contain}
.lb button{position:absolute;background:rgba(255,255,255,.12);border:0;color:#fff;border-radius:50%;cursor:pointer}
.lb .x{top:14px;right:14px;width:44px;height:44px;font-size:22px}
.lb .nav{top:50%;transform:translateY(-50%);width:50px;height:50px;font-size:26px}
.lb .prev{left:16px}.lb .next{right:16px}
.lb .n{position:absolute;bottom:22px;left:0;right:0;text-align:center;color:rgba(255,255,255,.8);font-size:14px}

@media (max-width:900px){
  .split,.contact-grid,.faq.two{grid-template-columns:1fr}
  .split.rev>.pic{order:0}
  .foot .cols{grid-template-columns:1fr}
}
@media (max-width:760px){
  .wrap{width:calc(100% - 32px)}
  .hdr nav,.hdr .btn,.hdr .lang{display:none}
  .burger{display:block}
  .hero{min-height:84vh}
  .hero .inner{width:calc(100% - 32px)}
  .hero .dots{right:16px}
  .row2{grid-template-columns:1fr}
  .lb .nav{display:none}
  .masonry{columns:2 150px;column-gap:10px}
  .masonry figure{margin-bottom:10px}
}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`;

const JS = `(function(){
var h=document.querySelector('.hdr'),hero=document.querySelector('.hero');
function sc(){var over=hero&&window.scrollY<hero.offsetHeight-90;h.classList.toggle('solid',!over);h.classList.toggle('over',!!over)}
sc();addEventListener('scroll',sc,{passive:true});
var mn=document.getElementById('mnav');
var bg=document.querySelector('.burger');
if(bg)bg.onclick=function(){mn.classList.add('on');document.body.style.overflow='hidden'};
mn.querySelector('.x').onclick=function(){mn.classList.remove('on');document.body.style.overflow=''};
var sl=[].slice.call(document.querySelectorAll('.hero .slide'));
if(sl.length>1){var i=0,dots=[].slice.call(document.querySelectorAll('.hero .dots button'));
function go(k){sl[i].classList.remove('on');dots[i]&&dots[i].classList.remove('on');i=(k+sl.length)%sl.length;var b=sl[i];if(b.dataset.bg){b.style.backgroundImage="url('"+b.dataset.bg+"')";b.removeAttribute('data-bg')}b.classList.add('on');dots[i]&&dots[i].classList.add('on');var n=sl[(i+1)%sl.length];if(n.dataset.bg){n.style.backgroundImage="url('"+n.dataset.bg+"')";n.removeAttribute('data-bg')}}
dots.forEach(function(d,k){d.onclick=function(){go(k);clearInterval(t);t=setInterval(function(){go(i+1)},6500)}});
var n1=sl[1];if(n1&&n1.dataset.bg){n1.style.backgroundImage="url('"+n1.dataset.bg+"')";n1.removeAttribute('data-bg')}
var t=setInterval(function(){go(i+1)},6500)}
[].forEach.call(document.querySelectorAll('[data-slider]'),function(sw){
var S=[].slice.call(sw.querySelectorAll('.sl')),D=[].slice.call(sw.querySelectorAll('.dots button')),j=0,tm=null,sx=null;
if(S.length<2)return;
function load(b){if(b&&b.dataset.bg){b.style.backgroundImage="url('"+b.dataset.bg+"')";b.removeAttribute('data-bg')}}
function to(k){S[j].classList.remove('on');D[j]&&D[j].classList.remove('on');j=(k+S.length)%S.length;load(S[j]);S[j].classList.add('on');D[j]&&D[j].classList.add('on');load(S[(j+1)%S.length])}
function auto(){clearInterval(tm);tm=setInterval(function(){to(j+1)},7000)}
load(S[1]);auto();
var pv=sw.querySelector('.prev'),nx=sw.querySelector('.next');
if(pv)pv.onclick=function(){to(j-1);auto()};
if(nx)nx.onclick=function(){to(j+1);auto()};
D.forEach(function(d,k){d.onclick=function(){to(k);auto()}});
sw.addEventListener('touchstart',function(e){sx=e.touches[0].clientX},{passive:true});
sw.addEventListener('touchend',function(e){if(sx===null)return;var dx=e.changedTouches[0].clientX-sx;if(Math.abs(dx)>45){to(j+(dx<0?1:-1));auto()}sx=null});
});
var fil=document.getElementById('filters');
if(fil)fil.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;
[].forEach.call(fil.children,function(x){x.classList.toggle('on',x===b)});
[].forEach.call(document.querySelectorAll('.albums .album'),function(a){a.style.display=(!b.dataset.c||a.dataset.c===b.dataset.c)?'':'none'})});
var ms=document.querySelector('.masonry');
if(ms){var lb=document.getElementById('lb'),im=lb.querySelector('img'),nn=lb.querySelector('.n'),F=[].slice.call(ms.querySelectorAll('img')),k=0,x0=null;
function show(j){k=(j+F.length)%F.length;im.src=F[k].dataset.full||F[k].src;nn.textContent=(k+1)+' / '+F.length;var p=new Image();p.src=F[(k+1)%F.length].dataset.full||''}
function open(j){show(j);lb.classList.add('on');document.body.style.overflow='hidden'}
function close(){lb.classList.remove('on');im.removeAttribute('src');document.body.style.overflow=''}
ms.addEventListener('click',function(e){var f=e.target.closest('figure');if(f)open(F.indexOf(f.querySelector('img')))});
lb.querySelector('.x').onclick=close;lb.querySelector('.prev').onclick=function(){show(k-1)};lb.querySelector('.next').onclick=function(){show(k+1)};
lb.addEventListener('click',function(e){if(e.target===lb)close()});
addEventListener('keydown',function(e){if(!lb.classList.contains('on'))return;if(e.key==='Escape')close();if(e.key==='ArrowLeft')show(k-1);if(e.key==='ArrowRight')show(k+1)});
lb.addEventListener('touchstart',function(e){x0=e.touches[0].clientX},{passive:true});
lb.addEventListener('touchend',function(e){if(x0===null)return;var dx=e.changedTouches[0].clientX-x0;if(Math.abs(dx)>50)show(k+(dx<0?1:-1));x0=null})}
var df=document.getElementById('dlForm');
if(df)df.addEventListener('submit',function(e){e.preventDefault();var v=this.code.value.trim(),m=v.match(/\\/d\\/([A-Za-z0-9_-]+)/),t=m?m[1]:v.replace(/[^A-Za-z0-9_-]/g,'');
var er=document.getElementById('dlErr');if(t.length<10){er.textContent='Nalepite ceo link koji ste dobili emailom.';er.className='form-msg err';return}location.href='/d/'+t});
})();`;

// ---------- jezik ----------
// Sadržaj (naslovi, tekstovi) ima englesku verziju u polju `en`, a nepromenljivi
// delovi sajta (dugmad, nazivi polja) dolaze iz ovog rečnika.
const STR = {
  sr: {
    book: 'Zakaži termin', menu: 'Meni', close: 'Zatvori', pages: 'Stranice', contact: 'Kontakt',
    back: 'Nazad na portfolio', all: 'Sve', photos: (n) => `${n} fotografija`, home: 'Početna',
    empty: 'Portfolio se uskoro popunjava fotografijama.', noPrices: 'Cene šaljem na upit – javite se porukom.',
    extraHour: 'Dodatni sat', login: 'Prijava za studio', downloads: 'Preuzimanje fotografija',
    album: 'Napravite svoj album', albumShort: 'Album',
    answerDay: 'Odgovor u toku dana', answerNote: 'Upit nije konačna rezervacija – javljam se sa potvrdom termina.',
    phoneNote: 'Ako vam je lakše telefonom', location: 'Lokacija', callOrWrite: 'Pozovite ili pišite',
    replySoon: 'Odgovaram u toku dana', latestWork: 'Najnoviji radovi', studioLoc: 'Studio / lokacija',
    type: 'Vrsta fotografisanja', name: 'Ime i prezime', phone: 'Telefon', email: 'Email',
    date: 'Željeni datum', pickDate: 'Izaberite datum', time: 'Željeno vreme', h24: '24h format',
    agreed: 'Po dogovoru', loc: 'Lokacija', locAgreed: 'Dogovorićemo se', pkg: 'Paket', optional: 'nije obavezno',
    notSure: 'Nisam sigurna', message: 'Poruka', bookingPh: 'Uzrast deteta, posebne želje, pitanja…',
    send: 'Pošalji upit', sendMsg: 'Pošalji poruku', sending: 'Šaljem…', error: 'Greška',
    pickType: 'Izaberite vrstu fotografisanja.', pickDateErr: 'Izaberite željeni datum.',
    sentTitle: 'Upit je poslat!', sentText: 'Hvala vam. Javljam se u najkraćem roku sa potvrdom termina, a potvrdu o prijemu upita poslala sam i na vaš email.',
    msgSentTitle: 'Hvala na poruci!', msgSentText: 'Javljam se u najkraćem roku.',
    contactPh: 'Kako mogu da vam pomognem?', dlTitle: 'Preuzimanje fotografija', dlPh: 'Nalepite link iz poruke', dlOpen: 'Otvori',
    prevMonth: 'Prethodni mesec', nextMonth: 'Sledeći mesec', img: 'Slika', toHome: 'Na početnu',
    wantSame: 'Želite ovakve fotografije?', wantSameText: 'Pošaljite upit i dogovaramo termin.',
    months: ['januar', 'februar', 'mart', 'april', 'maj', 'jun', 'jul', 'avgust', 'septembar', 'oktobar', 'novembar', 'decembar'],
    monthsGen: ['januara', 'februara', 'marta', 'aprila', 'maja', 'juna', 'jula', 'avgusta', 'septembra', 'oktobra', 'novembra', 'decembra'],
    wd: ['Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub', 'Ned'],
    dateFmt: "(+p[2])+'. '+ML[+p[1]-1]+' '+p[0]+'.'",
  },
  en: {
    book: 'Book a session', menu: 'Menu', close: 'Close', pages: 'Pages', contact: 'Contact',
    back: 'Back to portfolio', all: 'All', photos: (n) => `${n} photos`, home: 'Home',
    empty: 'The portfolio is being filled with photos soon.', noPrices: 'Prices are sent on request – just send a message.',
    extraHour: 'Extra hour', login: 'Studio login', downloads: 'Photo download',
    album: 'Design your own album', albumShort: 'Album',
    answerDay: 'Reply within the day', answerNote: 'A request is not a final booking – I reply with a confirmed time.',
    phoneNote: 'If a call suits you better', location: 'Location', callOrWrite: 'Call or write',
    replySoon: 'I reply during the day', latestWork: 'Latest work', studioLoc: 'Studio / location',
    type: 'Type of session', name: 'Full name', phone: 'Phone', email: 'Email',
    date: 'Preferred date', pickDate: 'Choose a date', time: 'Preferred time', h24: '24h format',
    agreed: 'To be agreed', loc: 'Location', locAgreed: "We'll agree on it", pkg: 'Package', optional: 'optional',
    notSure: 'Not sure yet', message: 'Message', bookingPh: "Child's age, special wishes, questions…",
    send: 'Send request', sendMsg: 'Send message', sending: 'Sending…', error: 'Error',
    pickType: 'Please choose the type of session.', pickDateErr: 'Please choose a date.',
    sentTitle: 'Request sent!', sentText: 'Thank you. I will get back to you shortly with a confirmed time, and a confirmation has been sent to your email.',
    msgSentTitle: 'Thank you for your message!', msgSentText: 'I will get back to you shortly.',
    contactPh: 'How can I help you?', dlTitle: 'Photo download', dlPh: 'Paste the link from the email', dlOpen: 'Open',
    prevMonth: 'Previous month', nextMonth: 'Next month', img: 'Photo', toHome: 'Back home',
    wantSame: 'Would you like photos like these?', wantSameText: 'Send a request and we will agree on a date.',
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    monthsGen: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    wd: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    dateFmt: "M[+p[1]-1]+' '+(+p[2])+', '+p[0]",
  },
};
const L = (ctx) => STR[ctx && ctx.lang === 'en' ? 'en' : 'sr'];
// adresa stranice na trenutnom jeziku (/en ispred za engleski)
const U = (ctx, path) => (ctx && ctx.lang === 'en' ? '/en' + (path === '/' ? '' : path) : path);
// tekst iz CMS-a: engleski ako je upisan, inače srpski
const tx = (ctx, o, f) => (ctx && ctx.lang === 'en' && o && o.en && String(o.en[f] || '').trim() ? o.en[f] : (o && o[f]) || '');
const catName = (ctx, c) => (ctx && ctx.lang === 'en' && c && c.nameEn ? c.nameEn : (c && c.name) || '');
const catBlurb = (ctx, c) => (ctx && ctx.lang === 'en' && c && c.blurbEn ? c.blurbEn : (c && c.blurb) || '');

// ---------- pomoćne ----------
const img = (id, size) => `/site/img/${id}${size ? '?s=' + size : ''}`;
const nl2 = (t) => esc(String(t || ''));

function navItems(ctx) {
  const site = ctx.site || ctx;
  const all = (site.pages || []).filter((p) => p.published !== false && p.nav).sort((a, b) => (a.order || 0) - (b.order || 0));
  const item = (p) => ({ label: tx(ctx, p, 'nav') || p.nav, href: U(ctx, '/' + (p.slug || '')) });
  return all
    .filter((p) => !p.parent)
    .map((p) => ({ ...item(p), children: all.filter((c) => c.parent === p.id).map(item) }));
}

// Sve podstranice jedne stranice (za kartice usluga)
function childPages(ctx, page) {
  return (ctx.site.pages || [])
    .filter((p) => p.published !== false && p.parent === page.id)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

// Naslovna fotografija stranice: izabrana u panelu ili prva iz njenog slidera
function pageCover(p) {
  if (p.cover) return p.cover;
  for (const sec of p.sections || []) {
    if (Array.isArray(sec.images) && sec.images.length) return sec.images[0];
    if (sec.image) return sec.image;
  }
  return '';
}

// Prekidač jezika u gornjem desnom uglu
function langSwitch(ctx) {
  if (!ctx.s.langEnabled) return '';
  const path = (ctx.path && ctx.path !== '/' ? ctx.path.replace(/^\/en(?=\/|$)/, '') : '/') || '/';
  const sr = path;
  const en = path === '/' ? '/en' : '/en' + path;
  const on = ctx.lang === 'en';
  return `<div class="lang"><a href="${esc(sr)}" hreflang="sr"${on ? '' : ' class="on" aria-current="true"'}>SR</a><a href="${esc(en)}" hreflang="en"${on ? ' class="on" aria-current="true"' : ''}>EN</a></div>`;
}

function header(ctx, cur) {
  const { s, v } = ctx;
  const t = L(ctx);
  const items = navItems(ctx);
  const here = U(ctx, cur);
  const link = (n) => `<a href="${esc(n.href)}"${n.href === here ? ' aria-current="page"' : ''}>${esc(n.label)}</a>`;
  const links = items
    .map((n) =>
      n.children && n.children.length
        ? `<div class="has-sub">${link(n)}<svg class="caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>
<div class="sub">${n.children.map((c) => `<a href="${esc(c.href)}"${c.href === here ? ' aria-current="page"' : ''}>${esc(c.label)}</a>`).join('')}</div></div>`
        : link(n)
    )
    .join('') + (ctx.s.albumEnabled === false ? '' : `<a href="/album"${cur === '/album' ? ' aria-current="page"' : ''}>${esc(t.albumShort)}</a>`);
  const mlinks = items
    .map((n) => link(n) + (n.children || []).map((c) => `<a class="sub-link" href="${esc(c.href)}">${esc(c.label)}</a>`).join(''))
    .join('') + (ctx.s.albumEnabled === false ? '' : `<a href="/album"${cur === '/album' ? ' aria-current="page"' : ''}>${esc(t.albumShort)}</a>`);
  const sw = langSwitch(ctx);
  return `<header class="hdr"><div class="wrap">
<a class="logo" href="${U(ctx, '/')}"><img src="/brand/logo?v=${v}" alt="${esc(s.studioName)}"></a>
<nav>${links}</nav>
${sw}
<a class="btn" href="${U(ctx, '/zakazivanje')}">${esc(t.book)}</a>
<button class="burger" aria-label="${esc(t.menu)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
</div></header>
<div class="mnav" id="mnav"><button class="x" aria-label="${esc(t.close)}">&times;</button>${mlinks}${sw}<a class="btn" href="${U(ctx, '/zakazivanje')}">${esc(t.book)}</a></div>`;
}

function footer(ctx) {
  const { s, v, site } = ctx;
  const t = L(ctx);
  const links = navItems(ctx)
    .map((n) => `<a href="${esc(n.href)}">${esc(n.label)}</a>`)
    .join('');
  const locs = (s.locations || []).map((l) => `<div>${esc(l)}</div>`).join('');
  return `<footer class="foot"><div class="wrap">
<div class="cols">
  <div><div class="logo"><img src="/brand/logo?v=${v}" alt="${esc(s.studioName)}"></div>
    <p style="margin-top:14px;max-width:34ch">${esc(s.siteTagline || '')}</p>
  </div>
  <div><h4>${esc(t.pages)}</h4>${links}${s.albumEnabled === false ? '' : `<a href="/album">${esc(t.album)}</a>`}<a href="${U(ctx, '/preuzimanje')}">${esc(t.downloads)}</a></div>
  <div><h4>${esc(t.contact)}</h4>
    ${s.contactPhone ? `<a href="tel:${esc(s.contactPhone.replace(/[^\d+]/g, ''))}">${esc(s.contactPhone)}</a>` : ''}
    ${s.contactEmail ? `<a href="mailto:${esc(s.contactEmail)}">${esc(s.contactEmail)}</a>` : ''}
    ${locs}
  </div>
</div>
<div class="bar"><span>${esc(s.footerText || `© ${new Date().getFullYear()} ${s.studioName}`)}</span><a href="/admin">${esc(t.login)}</a></div>
</div></footer>`;
}

function shell(ctx, { title, desc, body, head = '', path, jsonld = [], noindex }) {
  const { s, v, base } = ctx;
  const url = base ? base + (path || ctx.path || '/') : '';
  const text = desc || (ctx.lang === 'en' && s.metaDescriptionEn) || s.metaDescription || s.siteTagline || '';
  // Slika za deljenje na mrežama: prva pozadinska fotografija, inače logo
  const share = base ? base + ((ctx.bgs || [])[0] ? `/brand/bg/${(ctx.bgs || [])[0].id}` : `/brand/logo?v=${v}`) : '';
  const data = [business(ctx), ...jsonld].filter(Boolean);
  const lang = ctx.lang === 'en' ? 'en' : 'sr';
  const alt = s.langEnabled && base ? (path || ctx.path || '/').replace(/^\/en(?=\/|$)/, '') || '/' : '';
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(text)}">
${noindex ? '<meta name="robots" content="noindex,follow">' : '<meta name="robots" content="index,follow,max-image-preview:large">'}
${url ? `<link rel="canonical" href="${esc(url)}">` : ''}
<meta property="og:title" content="${esc(title)}"><meta property="og:type" content="website">
<meta property="og:description" content="${esc(text)}">
<meta property="og:site_name" content="${esc(s.studioName)}"><meta property="og:locale" content="${lang === 'en' ? 'en_US' : 'sr_RS'}">
${alt ? `<link rel="alternate" hreflang="sr" href="${esc(base + alt)}"><link rel="alternate" hreflang="en" href="${esc(base + (alt === '/' ? '/en' : '/en' + alt))}"><link rel="alternate" hreflang="x-default" href="${esc(base + alt)}">` : ''}
${url ? `<meta property="og:url" content="${esc(url)}">` : ''}
${share ? `<meta property="og:image" content="${esc(share)}"><meta name="twitter:image" content="${esc(share)}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(text)}">
<meta name="theme-color" content="#ffffff">
<link rel="icon" href="/brand/icon?v=${v}"><link rel="apple-touch-icon" href="/brand/icon?v=${v}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Italiana&family=Jost:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/brand/theme.css?v=${v}">
<style>${CSS}</style>${data.length ? `\n<script type="application/ld+json">${JSON.stringify(data.length === 1 ? data[0] : data).replace(/</g, '\\u003c')}</script>` : ''}${head}</head><body>
${body}
<div class="lb" id="lb" role="dialog" aria-modal="true"><button class="x" aria-label="Zatvori">&times;</button><button class="nav prev" aria-label="Prethodna">&#8249;</button><img alt=""><button class="nav next" aria-label="Sledeća">&#8250;</button><span class="n"></span></div>
<script>${JS}</script></body></html>`;
}

// Strukturirani podaci o studiju – Google ih koristi za prikaz u pretrazi i na mapama
function business(ctx) {
  const { s, base, v } = ctx;
  const sameAs = [socialUrl('instagram', s.instagram), socialUrl('facebook', s.facebook)].filter(Boolean);
  const o = {
    '@context': 'https://schema.org',
    '@type': ['LocalBusiness', 'ProfessionalService'],
    additionalType: 'https://www.wikidata.org/wiki/Q1326624',
    name: s.studioName,
    description: (ctx.lang === 'en' && s.metaDescriptionEn) || s.metaDescription || s.siteTagline || '',
    image: base ? base + `/brand/logo?v=${v}` : undefined,
    url: base || s.siteUrl || undefined,
    telephone: s.contactPhone || undefined,
    email: s.contactEmail || undefined,
    priceRange: '€€',
    areaServed: (s.locations || []).map((l) => l.split(',')[0].trim()).filter(Boolean),
    address: (s.locations || []).map((l) => {
      const parts = l.split(',');
      return { '@type': 'PostalAddress', addressLocality: (parts[0] || '').trim(), streetAddress: parts.slice(1).join(',').trim(), addressCountry: 'RS' };
    }),
    sameAs: sameAs.length ? sameAs : undefined,
  };
  if (!o.address.length) delete o.address;
  if (!o.areaServed.length) delete o.areaServed;
  return JSON.parse(JSON.stringify(o));
}

// ---------- sekcije ----------
const headBlock = (title, text, center) =>
  title || text ? `<div class="sec-head${center ? ' center' : ''}">${title ? `<h2>${esc(title)}</h2>` : ''}${text ? `<p class="lead">${esc(text)}</p>` : ''}</div>` : '';

function heroSection(ctx, sec) {
  const pics = sec.useBackgrounds !== false && !(sec.images || []).length ? (ctx.bgs || []).map((b) => `/brand/bg/${b.id}`) : (sec.images || []).map((id) => img(id, 'xl'));
  const slides = (pics.length ? pics : [null])
    .map((u, i) =>
      u
        ? `<div class="slide${i === 0 ? ' on' : ''}"${i === 0 ? ` style="background-image:url('${esc(u)}')"` : ` data-bg="${esc(u)}"`}></div>`
        : `<div class="slide on" style="background:linear-gradient(135deg,var(--blush),var(--wash))"></div>`
    )
    .join('');
  const t = L(ctx);
  const dots = pics.length > 1 ? `<div class="dots">${pics.map((_, i) => `<button class="${i === 0 ? 'on' : ''}" aria-label="${esc(t.img)} ${i + 1}"></button>`).join('')}</div>` : '';
  const eyebrow = tx(ctx, sec, 'eyebrow'), title = tx(ctx, sec, 'title'), text = tx(ctx, sec, 'text');
  const btn = tx(ctx, sec, 'btn'), btn2 = tx(ctx, sec, 'btn2');
  return `<section class="hero"><div class="slides">${slides}</div>
<div class="inner">${eyebrow ? `<span class="eyebrow">${esc(eyebrow)}</span>` : ''}
<h1>${esc(title)}</h1>${text ? `<p>${esc(text)}</p>` : ''}
<div class="acts">${btn ? `<a class="btn" href="${esc(U(ctx, sec.href || '/zakazivanje'))}">${esc(btn)}${I.arrow}</a>` : ''}${btn2 ? `<a class="btn light" href="${esc(U(ctx, sec.href2 || '/portfolio'))}">${esc(btn2)}</a>` : ''}</div>
</div>${dots}</section>`;
}

function catsSection(ctx, sec) {
  const albums = ctx.site.albums || [];
  const cards = CATEGORIES.map((c) => {
    const al = albums.find((a) => a.published !== false && a.category === c.key && ((a.images || []).length || a.cover));
    const cover = sec.covers?.[c.key] || al?.cover || (al?.images || [])[0];
    const nm = catName(ctx, c);
    return `<a class="cat${cover ? '' : ' empty'}" href="${U(ctx, '/portfolio')}?k=${c.key}">${cover ? `<img loading="lazy" src="${img(cover, 'm')}" alt="${esc(nm)}">` : ''}
<span class="t"><b>${esc(nm)}</b><small>${esc(catBlurb(ctx, c))}</small></span></a>`;
  }).join('');
  return `<section class="sec"><div class="wrap">${headBlock(tx(ctx, sec, 'title'), tx(ctx, sec, 'text'), true)}<div class="cats">${cards}</div></div></section>`;
}

function albumsSection(ctx, sec) {
  let list = (ctx.site.albums || []).filter((a) => a.published !== false && (a.images || []).length);
  if (sec.category) list = list.filter((a) => a.category === sec.category);
  list = list.sort((a, b) => (a.order || 0) - (b.order || 0));
  if (sec.limit) list = list.slice(0, sec.limit);
  const t = L(ctx);
  const cat = (k) => catName(ctx, CATEGORIES.find((c) => c.key === k));
  const cards = list
    .map(
      (a) => `<a class="album" data-c="${esc(a.category || '')}" href="${U(ctx, '/portfolio/' + a.slug)}">
<div class="ph"><img loading="lazy" src="${img(a.cover || a.images[0], 'm')}" alt="${esc(tx(ctx, a, 'title'))}"></div>
<span class="t"><b>${esc(tx(ctx, a, 'title'))}</b><small>${esc(cat(a.category))}${a.images.length ? ` · ${t.photos(a.images.length)}` : ''}</small></span></a>`
    )
    .join('');
  const used = [...new Set(list.map((a) => a.category).filter(Boolean))];
  const filters =
    sec.filters && used.length > 1
      ? `<div class="filters" id="filters"><button class="on">${esc(t.all)}</button>${used.map((k) => `<button data-c="${esc(k)}">${esc(cat(k))}</button>`).join('')}</div>`
      : '';
  const body = cards
    ? `${filters}<div class="albums">${cards}</div>`
    : `<p class="lead" style="text-align:center;margin-inline:auto">${esc(t.empty)}</p>`;
  return `<section class="sec${sec.tint ? ' tint' : ''}"><div class="wrap">${headBlock(tx(ctx, sec, 'title'), tx(ctx, sec, 'text'), true)}${body}</div></section>`;
}

function richSection(ctx, sec) {
  const pic = sec.image ? `<div class="pic"><img loading="lazy" src="${img(sec.image, 'l')}" alt=""></div>` : '';
  const eyebrow = tx(ctx, sec, 'eyebrow'), title = tx(ctx, sec, 'title'), btn = tx(ctx, sec, 'btn');
  const txt = `<div class="txt">${eyebrow ? `<span class="eyebrow">${esc(eyebrow)}</span>` : ''}${title ? `<h2>${esc(title)}</h2>` : ''}<p>${nl2(tx(ctx, sec, 'text'))}</p>
${btn ? `<p style="margin-top:22px"><a class="btn" href="${esc(U(ctx, sec.href || '/kontakt'))}">${esc(btn)}${I.arrow}</a></p>` : ''}</div>`;
  // bez fotografije tekst ide punom širinom, da ne ostane prazan okvir
  if (!pic) return `<section class="sec${sec.tint ? ' tint' : ''}"><div class="wrap"><div class="split one">${txt}</div></div></section>`;
  return `<section class="sec${sec.tint ? ' tint' : ''}"><div class="wrap"><div class="split${sec.side === 'left' ? ' rev' : ''}">${sec.side === 'left' ? pic + txt : txt + pic}</div></div></section>`;
}

function packagesSection(ctx, sec) {
  const cur = ctx.s.currency;
  let list = (ctx.packages || []).filter((p) => p.active !== false);
  if (sec.category) list = list.filter((p) => p.category === sec.category);
  const groups = CATEGORIES.map((c) => ({ c, items: list.filter((p) => p.category === c.key) })).filter((g) => g.items.length);
  const card = (p) => `<div class="pkg">
<b>${esc(p.name)}</b>
<span class="price">${esc(formatMoney(p.price, cur))}</span>
${p.description ? `<span class="desc">${nl2(p.description)}</span>` : ''}
${p.extraHourPrice ? `<span class="extra">${esc(L(ctx).extraHour)}: ${esc(formatMoney(p.extraHourPrice, cur))}</span>` : ''}
</div>`;
  const t = L(ctx);
  const body = groups.length
    ? groups.map((g) => `<div class="pkg-group"><h3>${esc(catName(ctx, g.c))}</h3><div class="pkgs">${g.items.map(card).join('')}</div></div>`).join('')
    : `<p class="lead" style="text-align:center;margin-inline:auto">${esc(t.noPrices)}</p>`;
  return `<section class="sec tint"><div class="wrap">${headBlock(tx(ctx, sec, 'title'), tx(ctx, sec, 'text'), true)}${body}
<p style="text-align:center;margin-top:10px"><a class="btn" href="${U(ctx, '/zakazivanje')}">${esc(t.book)}${I.arrow}</a></p></div></section>`;
}

function quotesSection(ctx, sec) {
  const items = ((ctx.lang === 'en' && sec.en && Array.isArray(sec.en.items) && sec.en.items.some((q) => q && q.text) ? sec.en.items : sec.items) || []).filter((q) => q.text);
  if (!items.length) return '';
  return `<section class="sec blush"><div class="wrap">${headBlock(tx(ctx, sec, 'title'), tx(ctx, sec, 'text'), true)}
<div class="quotes">${items.map((q) => `<figure class="quote" style="margin:0"><p>„${nl2(q.text)}“</p>${q.name ? `<b>${esc(q.name)}</b>` : ''}</figure>`).join('')}</div></div></section>`;
}

function gallerySection(ctx, sec) {
  const ids = sec.images || [];
  if (!ids.length) return '';
  return `<section class="sec"><div class="wrap">${headBlock(tx(ctx, sec, 'title'), tx(ctx, sec, 'text'), true)}
<div class="masonry">${ids.map((id) => `<figure><img loading="lazy" src="${img(id, 'm')}" data-full="${img(id, 'xl')}" alt=""></figure>`).join('')}</div></div></section>`;
}

// Slider sa fotografijama, naslovom, opisom i dugmetom (stranice usluga)
function sliderSection(ctx, sec) {
  const t = L(ctx);
  const pics = (sec.images || []).map((id) => img(id, 'xl'));
  const slides = pics.length
    ? pics.map((u, i) => `<div class="sl${i === 0 ? ' on' : ''}"${i === 0 ? ` style="background-image:url('${esc(u)}')"` : ` data-bg="${esc(u)}"`}></div>`).join('')
    : '<div class="sl on"></div>';
  const nav =
    pics.length > 1
      ? `<button class="ar prev" type="button" aria-label="${esc(t.prevMonth ? 'Prethodna' : 'Prev')}">&#8249;</button><button class="ar next" type="button" aria-label="Next">&#8250;</button>
<div class="dots">${pics.map((_, i) => `<button type="button" class="${i === 0 ? 'on' : ''}" aria-label="${esc(t.img)} ${i + 1}"></button>`).join('')}</div>`
      : '';
  const title = tx(ctx, sec, 'title');
  const text = tx(ctx, sec, 'text');
  const btn = tx(ctx, sec, 'btn');
  // dok nema fotografija, ne prikazujemo prazan okvir
  return `<section class="sec srv"><div class="wrap">
${pics.length ? `<div class="srv-slider" data-slider>${slides}${nav}</div>` : ''}
<div class="srv-body${pics.length ? '' : ' bare'}">${title ? `<h1>${esc(title)}</h1>` : ''}${text ? `<p>${nl2(text)}</p>` : ''}
${btn ? `<a class="btn" href="${esc(U(ctx, sec.href || '/zakazivanje'))}">${esc(btn)}${I.arrow}</a>` : ''}</div>
</div></section>`;
}

// Kartice podstranica (npr. sve usluge)
function childrenSection(ctx, sec, page) {
  const kids = page ? childPages(ctx, page) : [];
  if (!kids.length) return '';
  const cards = kids
    .map((p) => {
      const cover = pageCover(p);
      const sub = (p.sections || []).find((x) => x.type === 'slider');
      let lead = sub ? String(tx(ctx, sub, 'text') || '').trim() : '';
      if (lead.length > 105) lead = lead.slice(0, 105).replace(/\s+\S*$/, '') + '…';
      return `<a class="card-s" href="${U(ctx, '/' + p.slug)}">
<div class="ph">${cover ? `<img loading="lazy" src="${img(cover, 'm')}" alt="${esc(tx(ctx, p, 'title'))}">` : ''}</div>
<span class="t"><b>${esc(tx(ctx, p, 'title'))}</b>${lead ? `<small>${esc(lead)}</small>` : ''}</span></a>`;
    })
    .join('');
  return `<section class="sec"><div class="wrap">${headBlock(tx(ctx, sec, 'title'), tx(ctx, sec, 'text'), true)}<div class="cards">${cards}</div></div></section>`;
}

function faqSection(ctx, sec) {
  const items = ((ctx.lang === 'en' && sec.en && Array.isArray(sec.en.items) && sec.en.items.some((q) => q && q.q) ? sec.en.items : sec.items) || []).filter((x) => x.q);
  if (!items.length) return '';
  return `<section class="sec"><div class="wrap">${headBlock(tx(ctx, sec, 'title'), tx(ctx, sec, 'text'), sec.cols)}
<div class="faq${sec.cols ? ' two' : ''}">${items.map((x) => `<details><summary>${esc(x.q)}</summary><p>${nl2(x.a)}</p></details>`).join('')}</div></div></section>`;
}

function ctaSection(ctx, sec) {
  const t = L(ctx);
  const text = tx(ctx, sec, 'text');
  return `<section class="sec"><div class="wrap"><div class="cta"><h2>${esc(tx(ctx, sec, 'title'))}</h2>${text ? `<p class="lead">${esc(text)}</p>` : ''}
<a class="btn" href="${esc(U(ctx, sec.href || '/zakazivanje'))}">${esc(tx(ctx, sec, 'btn') || t.book)}${I.arrow}</a></div></div></section>`;
}

function headSection(ctx, sec) {
  const text = tx(ctx, sec, 'text');
  return `<section class="page-head"><div class="wrap"><h1>${esc(tx(ctx, sec, 'title'))}</h1>${text ? `<p class="lead">${esc(text)}</p>` : ''}</div></section>`;
}

function contactSection(ctx, sec) {
  const s = ctx.s;
  const t = L(ctx);
  const ig = socialUrl('instagram', s.instagram);
  const rows = [];
  if (s.contactPhone) rows.push(`<a href="tel:${esc(s.contactPhone.replace(/[^\d+]/g, ''))}">${I.phone}<span>${esc(s.contactPhone)}<small>${esc(t.callOrWrite)}</small></span></a>`);
  if (s.contactEmail) rows.push(`<a href="mailto:${esc(s.contactEmail)}">${I.mail}<span>${esc(s.contactEmail)}<small>${esc(t.replySoon)}</small></span></a>`);
  if (ig) rows.push(`<a href="${esc(ig)}" target="_blank" rel="noopener">${I.ig}<span>Instagram<small>${esc(t.latestWork)}</small></span></a>`);
  for (const l of s.locations || []) rows.push(`<div>${I.pin}<span>${esc(l)}<small>${esc(t.studioLoc)}</small></span></div>`);
  const form = sec.form === false ? '' : `<form class="card" id="cForm" data-kind="contact">
<label class="f"><span>${esc(t.name)}</span><input name="name" required></label>
<div class="row2"><label class="f"><span>${esc(t.email)}</span><input name="email" type="email" required></label>
<label class="f"><span>${esc(t.phone)}</span><input name="phone"></label></div>
<label class="f"><span>${esc(t.message)}</span><textarea name="message" required placeholder="${esc(t.contactPh)}"></textarea></label>
<button class="btn block">${esc(t.sendMsg)}</button><p class="form-msg" id="cMsg" role="status"></p></form>`;
  return `<section class="sec"><div class="wrap">${headBlock(tx(ctx, sec, 'title'), tx(ctx, sec, 'text'))}
<div class="contact-grid"><div class="info">${rows.join('')}</div>${form}</div></div></section>${form ? formJs(ctx) : ''}`;
}

const formJs = (ctx) => {
  const t = L(ctx);
  return `<script>(function(){var f=document.getElementById('cForm');if(!f)return;
f.addEventListener('submit',async function(e){e.preventDefault();var m=document.getElementById('cMsg'),b=f.querySelector('button');b.disabled=true;m.className='form-msg';m.textContent=${JSON.stringify(t.sending)};
var d=Object.fromEntries(new FormData(f).entries());d.lang=${JSON.stringify(ctx.lang === 'en' ? 'en' : 'sr')};
try{var r=await fetch('/api/site/contact',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(d)});var j=await r.json();
if(!r.ok)throw new Error(j.error||${JSON.stringify(t.error)});f.innerHTML='<div class="done"><h3>'+${JSON.stringify(t.msgSentTitle)}+'</h3><p class="lead">'+${JSON.stringify(t.msgSentText)}+'</p></div>'}
catch(err){m.className='form-msg err';m.textContent=err.message;b.disabled=false}})})();<\/script>`;
};

const TIME_SLOTS = (() => {
  const out = [];
  for (let h = 8; h <= 20; h++) for (const m of ['00', '30']) out.push(`${String(h).padStart(2, '0')}:${m}`);
  return out;
})();

const dpickJs = (ctx) => {
  const t = L(ctx);
  return `<script>(function(){var w=document.getElementById('dPick');if(!w)return;
var inp=w.querySelector('input[name=date]'),btn=document.getElementById('dBtn'),lab=btn.querySelector('span'),pop=w.querySelector('.pop'),ttl=pop.querySelector('b'),days=pop.querySelector('.days');
var M=${JSON.stringify(t.months)};
var ML=${JSON.stringify(t.monthsGen)};
var t0=new Date();t0.setHours(0,0,0,0);var vy=t0.getFullYear(),vm=t0.getMonth(),sel='';
function p2(n){return (n<10?'0':'')+n}
function key(y,m,d){return y+'-'+p2(m+1)+'-'+p2(d)}
function draw(){ttl.textContent=M[vm]+' '+vy;var first=new Date(vy,vm,1),off=(first.getDay()+6)%7,n=new Date(vy,vm+1,0).getDate(),h='';
for(var i=0;i<off;i++)h+='<span></span>';
for(var d=1;d<=n;d++){var k=key(vy,vm,d),dis=new Date(vy,vm,d)<t0;h+='<button type="button" data-d="'+k+'"'+(dis?' disabled':'')+(k===sel?' class="sel"':'')+'>'+d+'</button>'}
days.innerHTML=h}
function open(){w.classList.add('on');w.classList.remove('up');draw();setTimeout(function(){var r=pop.getBoundingClientRect(),vh=window.innerHeight||document.documentElement.clientHeight;if(r.bottom>vh-8){if(btn.getBoundingClientRect().top>r.height+20){w.classList.add('up')}else{pop.scrollIntoView({block:'nearest'})}}},0)}
btn.onclick=function(e){e.stopPropagation();w.classList.contains('on')?w.classList.remove('on'):open()};
pop.addEventListener('click',function(e){e.stopPropagation();var n=e.target.closest('[data-n]');
if(n){vm+=+n.dataset.n;if(vm<0){vm=11;vy--}if(vm>11){vm=0;vy++}return draw()}
var b=e.target.closest('[data-d]');if(!b||b.disabled)return;sel=b.dataset.d;inp.value=sel;
var p=sel.split('-');lab.textContent=${t.dateFmt};btn.classList.remove('ph');w.classList.remove('on')});
document.addEventListener('click',function(){w.classList.remove('on')});
document.addEventListener('keydown',function(e){if(e.key==='Escape')w.classList.remove('on')});})();<\/script>`;
};

function bookingSection(ctx, sec) {
  const s = ctx.s;
  const t = L(ctx);
  const cur = currencySymbol(s.currency);
  const cats = CATEGORIES.map((c) => `<label><input type="radio" name="category" value="${c.key}" required><span>${esc(catName(ctx, c))}</span></label>`).join('');
  const pkgs = (ctx.packages || [])
    .filter((p) => p.active !== false)
    .map((p) => `<option value="${esc(p.id)}" data-c="${esc(p.category)}">${esc(p.name)} · ${Math.round(p.price || 0)} ${cur}</option>`)
    .join('');
  const locs = (s.locations || []).map((l) => `<option value="${esc(l)}">${esc(l)}</option>`).join('');
  const head = sec && (tx(ctx, sec, 'title') || tx(ctx, sec, 'text')) ? headBlock(tx(ctx, sec, 'title'), tx(ctx, sec, 'text'), true) : '';
  return `<section class="sec"><div class="wrap">${head}<div class="contact-grid">
<div class="info">
  <div>${I.clock}<span>${esc(t.answerDay)}<small>${esc(t.answerNote)}</small></span></div>
  ${s.contactPhone ? `<a href="tel:${esc(s.contactPhone.replace(/[^\d+]/g, ''))}">${I.phone}<span>${esc(s.contactPhone)}<small>${esc(t.phoneNote)}</small></span></a>` : ''}
  ${(s.locations || []).map((l) => `<div>${I.pin}<span>${esc(l)}<small>${esc(t.location)}</small></span></div>`).join('')}
</div>
<form class="card" id="bForm">
<div class="f"><span>${esc(t.type)}</span><div class="chips">${cats}</div></div>
<div class="row2"><label class="f"><span>${esc(t.name)}</span><input name="name" required></label>
<label class="f"><span>${esc(t.phone)}</span><input name="phone" required></label></div>
<label class="f"><span>${esc(t.email)}</span><input name="email" type="email" required></label>
<div class="f"><span>${esc(t.date)}</span><div class="dpick" id="dPick">
<input type="hidden" name="date" required>
<button type="button" class="fld ph" id="dBtn"><span>${esc(t.pickDate)}</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg></button>
<div class="pop"><div class="pop-h"><button type="button" data-n="-1" aria-label="${esc(t.prevMonth)}">&#8249;</button><b></b><button type="button" data-n="1" aria-label="${esc(t.nextMonth)}">&#8250;</button></div>
<div class="wd">${t.wd.map((d) => `<span>${esc(d)}</span>`).join('')}</div><div class="days"></div></div></div></div>
<label class="f"><span>${esc(t.time)} <small style="color:var(--muted)">${esc(t.h24)}</small></span><select name="time"><option value="">${esc(t.agreed)}</option>${TIME_SLOTS.map(
    (x) => `<option value="${x}">${x}</option>`
  ).join('')}</select></label>
${locs ? `<label class="f"><span>${esc(t.loc)}</span><select name="location">${locs}<option value="">${esc(t.locAgreed)}</option></select></label>` : ''}
${pkgs ? `<label class="f"><span>${esc(t.pkg)} <small style="color:var(--muted)">${esc(t.optional)}</small></span><select name="packageId"><option value="">${esc(t.notSure)}</option>${pkgs}</select></label>` : ''}
<label class="f"><span>${esc(t.message)}</span><textarea name="message" placeholder="${esc(t.bookingPh)}"></textarea></label>
<button class="btn block">${esc(t.send)}</button>
<p class="form-msg" id="bMsg" role="status"></p>
</form></div></div></section>
${dpickJs(ctx)}
<script>(function(){var f=document.getElementById('bForm');if(!f)return;
var sel=f.packageId,all=sel?[].slice.call(sel.options):[];
f.addEventListener('change',function(e){if(e.target.name!=='category'||!sel)return;var k=e.target.value;
sel.innerHTML='';all.forEach(function(o){if(!o.dataset.c||o.dataset.c===k)sel.appendChild(o)})});
f.addEventListener('submit',async function(e){e.preventDefault();var m=document.getElementById('bMsg'),b=f.querySelector('button[class*=btn]');
if(!f.querySelector('input[name=category]:checked')){m.className='form-msg err';m.textContent=${JSON.stringify(t.pickType)};return}
if(!f.date.value){m.className='form-msg err';m.textContent=${JSON.stringify(t.pickDateErr)};return}
b.disabled=true;m.className='form-msg';m.textContent=${JSON.stringify(t.sending)};
var o=Object.fromEntries(new FormData(f).entries());o.lang=${JSON.stringify(ctx.lang === 'en' ? 'en' : 'sr')};
try{var r=await fetch('/api/site/request',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(o)});var j=await r.json();
if(!r.ok)throw new Error(j.error||${JSON.stringify(t.error)});
f.innerHTML='<div class="done"><h3>'+${JSON.stringify(t.sentTitle)}+'</h3><p class="lead">'+${JSON.stringify(t.sentText)}+'</p></div>'}
catch(err){m.className='form-msg err';m.textContent=err.message;b.disabled=false}})})();<\/script>`;
}

function downloadSection(ctx, sec) {
  const t = L(ctx);
  return `<section class="sec"><div class="wrap"><div class="dl-box">
<h2>${esc(tx(ctx, sec, 'title') || t.dlTitle)}</h2>
<p class="lead" style="margin:14px auto 0">${esc(tx(ctx, sec, 'text'))}</p>
<form class="dl-form" id="dlForm"><input name="code" placeholder="${esc(t.dlPh)}" aria-label="${esc(t.dlPh)}" autocomplete="off"><button class="btn">${esc(t.dlOpen)}</button></form>
<p class="form-msg" id="dlErr" role="alert"></p>
</div></div></section>`;
}

const RENDER = {
  hero: heroSection,
  slider: sliderSection,
  children: childrenSection,
  head: headSection,
  cats: catsSection,
  albums: albumsSection,
  rich: richSection,
  packages: packagesSection,
  quotes: quotesSection,
  gallery: gallerySection,
  faq: faqSection,
  cta: ctaSection,
  contact: contactSection,
  booking: bookingSection,
  download: downloadSection,
};

function renderPage(ctx, page) {
  const cur = '/' + (page.slug || '');
  const body = (page.sections || []).map((sec) => (RENDER[sec.type] ? RENDER[sec.type](ctx, sec, page) : '')).join('\n');
  const pTitle = tx(ctx, page, 'title');
  const title = tx(ctx, page, 'seoTitle') || (page.slug ? `${pTitle} – ${ctx.s.studioName}` : `${ctx.s.studioName}${ctx.s.siteTagline ? ' – ' + ctx.s.siteTagline : ''}`);
  // Google ume da prikaže pitanja i odgovore direktno u rezultatima pretrage
  const faq = (page.sections || []).find((x) => x.type === 'faq' && (x.items || []).some((i) => i.q && i.a));
  const jsonld = [];
  if (faq)
    jsonld.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.items.filter((i) => i.q && i.a).map((i) => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a } })),
    });
  if (page.slug) jsonld.push(crumbs(ctx, [[pTitle, U(ctx, cur)]]));
  return shell(ctx, { title, desc: tx(ctx, page, 'seoDesc'), path: U(ctx, cur), jsonld, body: header(ctx, cur) + `<main>${body}</main>` + footer(ctx) });
}

function renderAlbum(ctx, album) {
  const t = L(ctx);
  const cat = catName(ctx, CATEGORIES.find((c) => c.key === album.category));
  const aTitle = tx(ctx, album, 'title');
  const aText = tx(ctx, album, 'text');
  const body = `<section class="page-head"><div class="wrap"><h1>${esc(aTitle)}</h1>
<p class="lead">${esc([cat, aText].filter(Boolean).join(' · '))}</p></div></section>
<section class="sec" style="padding-top:10px"><div class="wrap"><a class="back" href="${U(ctx, '/portfolio')}">${I.arrow}${esc(t.back)}</a>
<div class="masonry">${(album.images || []).map((id) => `<figure><img loading="lazy" src="${img(id, 'm')}" data-full="${img(id, 'xl')}" alt="${esc([aTitle, cat].filter(Boolean).join(' – '))}"></figure>`).join('')}</div></div></section>
${ctaSection(ctx, { title: t.wantSame, text: t.wantSameText, btn: t.book, href: '/zakazivanje' })}`;
  const path = U(ctx, `/portfolio/${album.slug}`);
  const gallery = {
    '@context': 'https://schema.org',
    '@type': 'ImageGallery',
    name: aTitle,
    description: aText || undefined,
    image: ctx.base ? (album.images || []).slice(0, 20).map((id) => ctx.base + img(id, 'xl')) : undefined,
  };
  return shell(ctx, {
    title: `${aTitle}${cat ? ' – ' + cat : ''} – ${ctx.s.studioName}`,
    desc: aText || (ctx.lang === 'en' ? `${cat} photo session – ${aTitle}.` : `${cat} fotografisanje – ${aTitle}.`),
    path,
    jsonld: [gallery, crumbs(ctx, [['Portfolio', U(ctx, '/portfolio')], [aTitle, path]])],
    body: header(ctx, '/portfolio') + `<main>${body}</main>` + footer(ctx),
  });
}

// Putanja „Početna › Portfolio › Album“ koju Google prikazuje ispod naslova
function crumbs(ctx, items) {
  if (!ctx.base) return null;
  const all = [[L(ctx).home, U(ctx, '/')], ...items];
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: all.map(([name, href], i) => ({ '@type': 'ListItem', position: i + 1, name, item: ctx.base + href })),
  };
}

function renderMessage(ctx, title, text) {
  const body = `<section class="page-head"><div class="wrap"><h1>${esc(title)}</h1><p class="lead">${esc(text)}</p>
<p style="margin-top:24px"><a class="btn" href="${U(ctx, '/')}">${esc(L(ctx).toHome)}${I.arrow}</a></p></div></section>`;
  return shell(ctx, { title: `${title} – ${ctx.s.studioName}`, noindex: true, body: header(ctx, '') + `<main>${body}</main>` + footer(ctx) });
}

module.exports = { renderPage, renderAlbum, renderMessage, navItems };
