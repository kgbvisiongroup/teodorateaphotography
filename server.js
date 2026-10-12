// Teodora Photography Studio – server
// Svaki deo aplikacije je modul u folderu modules/ (slanje fotografija, zakazivanje, brend...).
// Novi deo (npr. CMS za sajt) dodaje se kao novi fajl u modules/ i jedna linija u listi MODULES.
require('dotenv').config({ quiet: true });
const express = require('express');
const compression = require('compression');
const path = require('path');
const fs = require('fs');

const store = require('./lib/store');
const mailer = require('./lib/mailer');
const pages = require('./lib/pages');
const auth = require('./lib/auth');

let sharp = null;
try {
  sharp = require('sharp');
  sharp.cache({ files: 0 }); // ne drži otvorene fajlove (brisanje isteklih radi odmah)
} catch {
  console.log('sharp nije dostupan – umesto umanjenih slika prikazivaće se originali.');
}

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const ctx = {
  DATA_DIR,
  UPLOAD_DIR: path.join(DATA_DIR, 'uploads'),
  BRAND_DIR: path.join(DATA_DIR, 'brand'),
  ASSETS: path.join(__dirname, 'public', 'assets'),
  DAY: 24 * 60 * 60 * 1000,
  MAX_FILE_MB: Number(process.env.MAX_FILE_MB) || 10240,
  VERSION: require('./package.json').version,
  store,
  mailer,
  pages,
  sharp,
  services: {}, // moduli ovde izlažu funkcije jedni drugima
  tasks: [], // periodični poslovi (brisanje isteklih, podsetnici)
  every(fn) {
    this.tasks.push(fn);
  },
};
fs.mkdirSync(ctx.UPLOAD_DIR, { recursive: true });
fs.mkdirSync(ctx.BRAND_DIR, { recursive: true });
store.init(path.join(DATA_DIR, 'db.json'), process.env);

const app = express();
ctx.app = app;
app.set('trust proxy', 1);
app.disable('x-powered-by');
// Kompresija teksta (HTML, CSS, JS, JSON); fotografije i ZIP se ne diraju
app.use(compression({ filter: (req, res) => !/^\/d\/[^/]+\/(f|all)/.test(req.path) && compression.filter(req, res) }));
app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});

// Adresa sajta za linkove u porukama (podešena, ili ona sa koje je admin otvoren)
ctx.baseUrl = (req) => {
  const s = store.settings.siteUrl.trim().replace(/\/+$/, '');
  if (s) return s;
  if (req) {
    const u = `${req.protocol}://${req.get('host')}`;
    if (store.data.lastBaseUrl !== u) {
      store.data.lastBaseUrl = u; // pamti se za emailove koji idu bez zahteva (podsetnici)
      store.save();
    }
    return u;
  }
  return store.data.lastBaseUrl || '';
};

// Kad god se admin otvori, zapamti adresu sajta (za linkove u podsetnicima)
app.use('/api/admin', (req, res, next) => {
  ctx.baseUrl(req);
  next();
});
Object.assign(ctx, auth(ctx));

const MODULES = ['notifications', 'brand', 'settings', 'inventory', 'albums', 'transfers', 'bookings', 'vouchers', 'mail', 'dashboard', 'web'];
for (const m of MODULES) require('./modules/' + m)(ctx);

// Admin aplikacija (statički fajlovi; verzija u adresi = keš se osvežava posle ažuriranja)
app.use('/assets', express.static(ctx.ASSETS, { maxAge: '7d' }));
app.get(['/admin', '/admin/', '/admin/index.html'], (req, res) => {
  const html = fs.readFileSync(path.join(__dirname, 'public', 'admin', 'index.html'), 'utf8').replace(/\{\{V\}\}/g, ctx.VERSION + '-' + bootId);
  res.setHeader('Cache-Control', 'no-cache');
  res.type('html').send(html);
});
const bootId = Date.now().toString(36);
app.use('/admin', express.static(path.join(__dirname, 'public', 'admin'), { maxAge: '30d', index: false }));
app.use((req, res) =>
  res
    .status(404)
    .type('html')
    .send(ctx.renderMessage ? ctx.renderMessage('Stranica ne postoji', 'Proverite adresu ili se vratite na početnu stranu.') : pages.notFound(ctx.site()))
);
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return res.destroy();
  res.status(err.status || 500).json({ error: err.expose ? err.message : 'Došlo je do greške na serveru.' });
});

// Periodični poslovi: odmah po pokretanju, pa na svakih 5 minuta
async function runTasks() {
  for (const t of ctx.tasks) {
    try {
      await t();
    } catch (e) {
      console.error('Periodični posao nije uspeo:', e.message);
    }
  }
}
setInterval(runTasks, 5 * 60 * 1000).unref();
setTimeout(runTasks, 2000).unref();
ctx.runTasks = runTasks;

const server = app.listen(PORT, () => {
  console.log(`${store.settings.studioName} – aplikacija radi na http://localhost:${PORT}  (admin: /admin)`);
});
// Veliki uploadi mogu da traju dugo – bez vremenskog ograničenja zahteva.
server.requestTimeout = 0;
server.headersTimeout = 120000;
server.keepAliveTimeout = 65000;
