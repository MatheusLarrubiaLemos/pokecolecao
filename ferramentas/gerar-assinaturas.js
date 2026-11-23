// Gera dados/assinaturas.txt: a "impressão digital" do desenho de todas as cartas físicas do TCGdex.
// O site compara as fotos com esse banco para reconhecer cartas. Rode de novo quando sair coleção nova.
//
// Uso (precisa de Node 18+ e do Playwright com Chromium):
//   npm install playwright && npx playwright install chromium   (uma vez, em qualquer pasta)
//   node ferramentas/gerar-assinaturas.js [pasta-de-cache-das-imagens]
//
// Usa a MESMA função do site (assinaturaArte, no app.js) para os dois lados baterem.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const CACHE = path.resolve(process.argv[2] || path.join(require('os').tmpdir(), 'pokecolecao-imagens'));
const PORTA = 8799;
fs.mkdirSync(CACHE, { recursive: true });

// Servidor local: o site em "/" e as imagens baixadas em "/imgs" (mesma origem, para ler os pixels)
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.woff2': 'font/woff2', '.txt': 'text/plain', '.json': 'application/json' };
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

async function baixar(id, url) {
  const destino = path.join(CACHE, `${id}.webp`);
  if (fs.existsSync(destino) && fs.statSync(destino).size > 0) return true;
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    for (const u of [url, url.replace('/pt/', '/en/')]) {
      try {
        const r = await fetch(u);
        if (r.ok) { fs.writeFileSync(destino, Buffer.from(await r.arrayBuffer())); return true; }
      } catch { /* tenta de novo */ }
    }
    await new Promise((ok) => setTimeout(ok, 1000));
  }
  return false;
}

(async () => {
  await new Promise((ok) => servidor.listen(PORTA, '127.0.0.1', ok));
  const navegador = await chromium.launch();
  const pagina = await navegador.newPage();
  await pagina.goto(`http://127.0.0.1:${PORTA}/index.html`);
  await pagina.waitForFunction(() => estado.infoSets.size > 0, null, { timeout: 120000 });

  // 1) Lista as cartas físicas com imagem (pt; o que falta vem do catálogo en)
  const cartas = await pagina.evaluate(async () => {
    const out = [];
    const sets = [...estado.infoSets.values()].filter((s) => !s.digital);
    for (const s of sets) {
      const set = await carregarSet(s.id).catch(() => null);
      for (const c of set?.cards ?? []) { const u = urlImagem(c); if (u) out.push([c.id, u]); }
    }
    return out;
  });
  console.log(`${cartas.length} cartas com imagem`);

  // 2) Baixa as imagens que faltam no cache (16 de cada vez)
  let i = 0, falhas = 0;
  await Promise.all(Array.from({ length: 16 }, async () => {
    while (i < cartas.length) {
      const [id, url] = cartas[i++];
      if (!(await baixar(id, url))) falhas++;
      if (i % 1000 === 0) console.log(`  baixadas ${i}/${cartas.length}`);
    }
  }));
  if (falhas) console.log(`  ${falhas} imagens não baixaram (ficam de fora)`);

  // 3) Calcula as impressões no navegador, com a função do próprio site
  const ids = cartas.map(([id]) => id).filter((id) => fs.existsSync(path.join(CACHE, `${id}.webp`)));
  const linhas = [];
  for (let k = 0; k < ids.length; k += 500) {
    linhas.push(...await pagina.evaluate(async (lote) => {
      const hex = (h) => [...h].map((v) => v.toString(16).padStart(8, '0')).join('');
      const out = [];
      await Promise.all(lote.map(async (id) => {
        try {
          const bmp = await createImageBitmap(await (await fetch(`/imgs/${encodeURIComponent(id)}.webp`)).blob());
          const [ax, ay, aw, ah] = AREA_ARTE;
          out.push(`${id} ${hex(assinaturaArte(bmp, ax * bmp.width, ay * bmp.height, aw * bmp.width, ah * bmp.height))}`);
          bmp.close();
        } catch { /* imagem quebrada */ }
      }));
      return out;
    }, ids.slice(k, k + 500)));
  }
  linhas.sort();
  fs.mkdirSync(path.join(RAIZ, 'dados'), { recursive: true });
  fs.writeFileSync(path.join(RAIZ, 'dados', 'assinaturas.txt'), linhas.join('\n') + '\n');
  console.log(`pronto: dados/assinaturas.txt com ${linhas.length} cartas`);
  await navegador.close();
  servidor.close();
})();
