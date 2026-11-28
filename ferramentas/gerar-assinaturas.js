// Gera dados/assinaturas.txt: a "impressão digital" do desenho de todas as cartas físicas do TCGdex.
// O site compara as fotos com esse banco para reconhecer cartas. Rode de novo quando sair coleção nova.
//
// Uso (precisa de Node 18+ e do Playwright com Chromium):
//   npm install playwright && npx playwright install chromium   (uma vez, em qualquer pasta)
//   node ferramentas/gerar-assinaturas.js [pasta-de-cache-das-imagens] [--so-faltando]
//   (atrás de um proxy HTTPS, rode com NODE_USE_ENV_PROXY=1 no Node 22.21 ou mais novo)
//
// --so-faltando: mantém o banco atual e só acrescenta as cartas que ainda não estão nele
// (útil quando sai coleção nova, ou quando o servidor de imagens do TCGdex está fora do ar).
//
// O TCGdex não tem imagem de ~1600 cartas físicas (promos MEP/SVP, energias, Cofre Brilhante, Galeria
// do Treinador, kits…). Para essas, a imagem vem do pokemontcg.io (pela lista da coleção, conferindo
// número e nome) ou do Limitless (pelo código e número impressos). O desenho é o mesmo em qualquer
// fonte: a impressão da mesma carta varia só 2 a 6 pontos entre elas (a régua de certeza é 22).
//
// Usa a MESMA função do site (assinaturaArte, no app.js) para os dois lados baterem.
const { chromium } = require('playwright');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const SO_FALTANDO = args.includes('--so-faltando');
const RAIZ = path.resolve(__dirname, '..');
const CACHE = path.resolve(args.find((a) => !a.startsWith('--')) || path.join(require('os').tmpdir(), 'pokecolecao-imagens'));
const BANCO = path.join(RAIZ, 'dados', 'assinaturas.txt');
const PORTA = 8799;
fs.mkdirSync(CACHE, { recursive: true });

// Coleções do TCGdex -> coleção no pokemontcg.io (para as cartas sem imagem no TCGdex)
const PTCG = {
  'swsh4.5sv': 'swsh45sv', 'swsh12.5gg': 'swsh12pt5gg', swsh9tg: 'swsh9tg', swsh10tg: 'swsh10tg', swsh11tg: 'swsh11tg',
  swsh12tg: 'swsh12tg', 'sm3.5': 'sm35', 'sm7.5': 'sm75', smp: 'smp', svp: 'svp', swshp: 'swshp', xyp: 'xyp', bwp: 'bwp',
  hgssp: 'hsp', dpp: 'dpp', ecard2: 'ecard2', ecard3: 'ecard3', '30th-c': 'me55c', '30th': 'me55', cel25cc: 'cel25c',
  cel25: 'cel25', bog: 'bp', det1: 'det1', sm2: 'sm2', sm6: 'sm6', xy8: 'xy8', pl2: 'pl2', sve: 'sve',
  'tk-ex-latia': 'tk1a', 'tk-ex-latio': 'tk1b', 'tk-ex-p': 'tk2a', 'tk-ex-m': 'tk2b',
  '2011bw': 'mcd11', '2012bw': 'mcd12', '2014xy': 'mcd14', '2015xy': 'mcd15', '2016xy': 'mcd16', '2017sm': 'mcd17',
  '2018sm': 'mcd18', '2019sm': 'mcd19', '2021swsh': 'mcd21', '2022swsh': 'mcd22',
};
// Coleções do TCGdex -> código impresso no Limitless (imagem pelo número; usado quando o pokemontcg.io não tem)
const LIMITLESS = { mep: 'MEP', mee: 'MEE', sve: 'SVE', svp: 'SVP' };
const URL_LIMITLESS = 'https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci';

// Servidor local: o site em "/" e as imagens baixadas em "/imgs" (mesma origem, para ler os pixels)
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.txt': 'text/plain', '.json': 'application/json' };
const servidor = http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const arq = url.startsWith('/imgs/') ? path.join(CACHE, path.basename(url)) : path.join(RAIZ, url === '/' ? 'index.html' : url);
  if (!arq.startsWith(RAIZ) && !arq.startsWith(CACHE)) { res.writeHead(403); return res.end(); }
  fs.readFile(arq, (erro, dados) => {
    if (erro) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': tipos[path.extname(arq)] || 'application/octet-stream' });
    res.end(dados);
  });
});

// GET com o módulo https (segue redirecionamento). Devolve o conteúdo (Buffer) ou null.
function pegar(url, voltas = 3) {
  return new Promise((ok) => {
    const req = https.get(url, { timeout: 30000, headers: { 'user-agent': 'pokecolecao-gerar-assinaturas' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && voltas) {
        res.resume();
        return ok(pegar(new URL(res.headers.location, url).href, voltas - 1));
      }
      if (res.statusCode !== 200) { res.resume(); return ok(null); }
      const partes = [];
      res.on('data', (p) => partes.push(p));
      res.on('end', () => ok(Buffer.concat(partes)));
      res.on('error', () => ok(null));
    });
    req.on('timeout', () => req.destroy());
    req.on('error', () => ok(null));
  });
}

// Arquivo da imagem no cache (o TCGdex manda .webp; as outras fontes, .png)
const noCache = (id) => ['webp', 'png'].map((ext) => path.join(CACHE, `${id}.${ext}`)).find((a) => fs.existsSync(a) && fs.statSync(a).size > 0);

async function baixar(id, urls, ext) {
  if (noCache(id)) return true;
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    for (const u of urls) {
      const dados = await pegar(u);
      if (dados?.length) { fs.writeFileSync(path.join(CACHE, `${id}.${ext}`), dados); return true; }
    }
    await new Promise((ok) => setTimeout(ok, 1000));
  }
  return false;
}

const normalizar = (t) => (t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const normalizarNumero = (t) => { const m = String(t ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').match(/^([A-Z]*)0*(\d+)$/); return m ? m[1] + m[2] : String(t ?? '').toUpperCase(); };
function parecido(a, b) {
  a = normalizar(a); b = normalizar(b);
  if (!a || !b) return 0;
  if (a === b || a.includes(b) || b.includes(a)) return 1;
  let ant = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const atual = [i];
    for (let j = 1; j <= b.length; j++) atual[j] = Math.min(ant[j] + 1, atual[j - 1] + 1, ant[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    ant = atual;
  }
  return 1 - ant[b.length] / Math.max(a.length, b.length);
}

// Lista as cartas de uma coleção do pokemontcg.io: [{ numero (normalizado), nome, imagem }]
async function cartasPtcg(setPtcg) {
  const cartas = [];
  for (let pagina = 1; pagina < 10; pagina++) {
    let lista = null;
    for (let tentativa = 0; tentativa < 12 && !lista; tentativa++) { // a API falha à toa (500/502): tenta de novo
      const dados = await pegar(`https://api.pokemontcg.io/v2/cards?q=set.id:${setPtcg}&select=number,name,images&pageSize=250&page=${pagina}`);
      try { lista = JSON.parse(dados.toString()).data; } catch { await new Promise((ok) => setTimeout(ok, 1500)); }
    }
    if (!lista) { console.log(`  pokemontcg.io não respondeu para ${setPtcg}`); break; }
    for (const c of lista) if (c.images?.small) cartas.push({ numero: normalizarNumero(c.number), nome: c.name, imagem: c.images.small });
    if (lista.length < 250) break;
  }
  return cartas;
}

// Imagem de outra fonte para as cartas sem imagem no TCGdex: [[id, url], …]
async function imagensAlternativas(semImagem) {
  const porSet = new Map();
  for (const c of semImagem) {
    if (!porSet.has(c.set)) porSet.set(c.set, []);
    porSet.get(c.set).push(c);
  }
  const achadas = [], semFonte = new Map();
  for (const [set, cartas] of porSet) {
    const ptcg = PTCG[set] ? await cartasPtcg(PTCG[set]) : [];
    for (const c of cartas) {
      // pelo número (conferindo o nome); nas coleções clássicas o número é o da carta original: aí pelo nome
      const mesmoNome = ptcg.filter((p) => normalizar(p.nome) === normalizar(c.nome));
      const p = ptcg.find((x) => x.numero === normalizarNumero(c.numero) && parecido(x.nome, c.nome) >= 0.6)
        ?? (mesmoNome.length === 1 ? mesmoNome[0] : null);
      if (p) { achadas.push([c.id, p.imagem]); continue; }
      const codigo = LIMITLESS[set];
      const digitos = String(c.numero).replace(/\D/g, '');
      if (codigo && digitos) { achadas.push([c.id, `${URL_LIMITLESS}/${codigo}/${codigo}_${digitos.padStart(3, '0')}_R_EN_LG.png`]); continue; }
      semFonte.set(set, (semFonte.get(set) ?? 0) + 1);
    }
  }
  if (semFonte.size) console.log(`  sem outra fonte: ${[...semFonte].map(([s, n]) => `${s} (${n})`).join(', ')}`);
  return achadas;
}

(async () => {
  await new Promise((ok) => servidor.listen(PORTA, '127.0.0.1', ok));
  const navegador = await chromium.launch();
  const pagina = await navegador.newPage();
  await pagina.goto(`http://127.0.0.1:${PORTA}/index.html`);
  await pagina.waitForFunction(() => estado.infoSets.size > 0, null, { timeout: 120000 });

  // 1) Lista as cartas físicas: com imagem no TCGdex (pt; o que falta vem do catálogo en) e sem imagem
  //    (essas também pelo catálogo en, que às vezes tem mais cartas da coleção que o pt)
  const { comImagem, semImagem } = await pagina.evaluate(async () => {
    const comImagem = [], semImagem = new Map();
    const sets = [...estado.infoSets.values()].filter((s) => !s.digital);
    // a API às vezes falha em rajada: tenta de novo (uma coleção que não carrega sairia do banco)
    const tentar = async (f) => { for (let t = 0; t < 4; t++) { try { return await f(); } catch { await new Promise((ok) => setTimeout(ok, 1500 * (t + 1))); } } return null; };
    for (const s of sets) {
      const set = await tentar(() => carregarSet(s.id));
      let falta = false;
      for (const c of set?.cards ?? []) {
        const u = urlImagem(c);
        if (u) comImagem.push([c.id, u]);
        else { falta = true; semImagem.set(c.id, { id: c.id, set: s.id, numero: c.localId, nome: c.name }); }
      }
      if (!falta && set?.cards?.length) continue;
      const en = await tentar(() => api(`/sets/${encodeURIComponent(s.id)}`, { idioma: 'en' }));
      for (const c of en?.cards ?? []) {
        if (c.image) { if (!set?.cards?.some((x) => x.id === c.id)) comImagem.push([c.id, `${c.image}/low.webp`]); }
        else semImagem.set(c.id, { id: c.id, set: s.id, numero: c.localId, nome: c.name }); // nome em inglês, para conferir
      }
    }
    return { comImagem, semImagem: [...semImagem.values()] };
  });
  console.log(`${comImagem.length} cartas com imagem no TCGdex, ${semImagem.length} sem`);

  const antigas = SO_FALTANDO && fs.existsSync(BANCO) ? fs.readFileSync(BANCO, 'utf8').split('\n').filter(Boolean) : [];
  const jaNoBanco = new Set(antigas.map((l) => l.split(' ')[0]));
  const faltam = (lista) => lista.filter(([id]) => !jaNoBanco.has(id));

  // 2) Imagens: do TCGdex (webp) e, para as que ele não tem, de outra fonte (png)
  const alternativas = await imagensAlternativas(semImagem.filter((c) => !jaNoBanco.has(c.id)));
  console.log(`  ${alternativas.length} com imagem de outra fonte (pokemontcg.io / Limitless)`);
  const fila = [...faltam(comImagem).map(([id, u]) => [id, [u, u.replace('/pt/', '/en/')], 'webp']), ...alternativas.map(([id, u]) => [id, [u], 'png'])];
  let i = 0, falhas = 0;
  await Promise.all(Array.from({ length: 16 }, async () => {
    while (i < fila.length) {
      const [id, urls, ext] = fila[i++];
      if (!(await baixar(id, urls, ext))) falhas++;
      if (i % 1000 === 0) console.log(`  baixadas ${i}/${fila.length}`);
    }
  }));
  if (falhas) console.log(`  ${falhas} imagens não baixaram (ficam de fora)`);

  // 3) Calcula as impressões no navegador, com a função do próprio site
  const arquivos = fila.map(([id]) => [id, noCache(id)]).filter(([, a]) => a).map(([id, a]) => [id, path.basename(a)]);
  const linhas = [];
  for (let k = 0; k < arquivos.length; k += 500) {
    linhas.push(...await pagina.evaluate(async (lote) => {
      const hex = (h) => [...h].map((v) => v.toString(16).padStart(8, '0')).join('');
      const out = [];
      await Promise.all(lote.map(async ([id, arq]) => {
        try {
          const bmp = await createImageBitmap(await (await fetch(`/imgs/${encodeURIComponent(arq)}`)).blob());
          const [ax, ay, aw, ah] = AREA_ARTE;
          out.push(`${id} ${hex(assinaturaArte(bmp, ax * bmp.width, ay * bmp.height, aw * bmp.width, ah * bmp.height))}`);
          bmp.close();
        } catch { /* imagem quebrada */ }
      }));
      return out;
    }, arquivos.slice(k, k + 500)));
  }
  const todas = [...antigas, ...linhas].sort();
  fs.mkdirSync(path.dirname(BANCO), { recursive: true });
  fs.writeFileSync(BANCO, todas.join('\n') + '\n');
  console.log(`pronto: dados/assinaturas.txt com ${todas.length} cartas (${linhas.length} novas)`);
  await navegador.close();
  servidor.close();
})();
