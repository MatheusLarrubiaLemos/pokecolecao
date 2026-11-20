/* PokéColeção TCG
 * Catálogo de cartas: API pública TCGdex (https://tcgdex.dev) — sem chave, com suporte a português.
 * Coleção: salva no navegador (localStorage) + exportar/importar .json.
 */
'use strict';

const VERSAO = '1.2.0'; // atualize também o CHANGELOG.md
const API = 'https://api.tcgdex.net/v2';
const CHAVE_COLECAO = 'pokecolecao:colecao';
const CHAVE_CONFIG = 'pokecolecao:config';
const CACHE_DIAS = 7;

// ---------- Estado ----------
const estado = {
  config: lerJSON(CHAVE_CONFIG, { idioma: 'pt' }),
  colecao: lerJSON(CHAVE_COLECAO, { versao: 1, cartas: {} }), // cartas: { "sv01-001": { qtd, set } }
  series: [],          // [{ id, name, sets: [...] }]
  setAtual: null,      // set completo carregado
  cartasVisiveis: [],  // cartas mostradas na grade
  modo: 'inicio',      // 'inicio' | 'set' | 'busca'
  filtro: 'todas',
  cartaModal: null,
};

// ---------- Utilidades ----------
const $ = (s) => document.querySelector(s);

function lerJSON(chave, padrao) {
  try { return JSON.parse(localStorage.getItem(chave)) ?? padrao; } catch { return padrao; }
}
function salvarJSON(chave, valor) {
  try { localStorage.setItem(chave, JSON.stringify(valor)); }
  catch { avisar('Não consegui salvar no navegador! Exporte um backup.'); }
}
function salvarColecao() { salvarJSON(CHAVE_COLECAO, estado.colecao); atualizarTotal(); }

function avisar(msg) {
  const el = $('#aviso');
  el.textContent = msg; el.hidden = false;
  clearTimeout(avisar.t); avisar.t = setTimeout(() => (el.hidden = true), 2500);
}

function setDaCarta(idCarta) {
  const i = idCarta.lastIndexOf('-');
  return i > 0 ? idCarta.slice(0, i) : idCarta;
}

// Cache simples em IndexedDB para não baixar o catálogo toda hora
const cache = (() => {
  let dbp;
  const db = () => dbp ??= new Promise((ok, erro) => {
    const r = indexedDB.open('pokecolecao-cache', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => ok(r.result);
    r.onerror = () => erro(r.error);
  });
  const op = async (modo, fn) => {
    const d = await db();
    return new Promise((ok, erro) => {
      const tx = d.transaction('kv', modo);
      const req = fn(tx.objectStore('kv'));
      tx.oncomplete = () => ok(req?.result);
      tx.onerror = () => erro(tx.error);
    });
  };
  return {
    get: (k) => op('readonly', (s) => s.get(k)).catch(() => undefined),
    set: (k, v) => op('readwrite', (s) => s.put(v, k)).catch(() => {}),
    limpar: () => op('readwrite', (s) => s.clear()).catch(() => {}),
  };
})();

async function api(caminho, { usarCache = true } = {}) {
  const url = `${API}/${estado.config.idioma}${caminho}`;
  if (usarCache) {
    const c = await cache.get(url);
    if (c && Date.now() - c.quando < CACHE_DIAS * 864e5) return c.dados;
  }
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Erro ${resp.status} em ${caminho}`);
  const dados = await resp.json();
  if (usarCache) cache.set(url, { quando: Date.now(), dados });
  return dados;
}

// ---------- Imagens ----------
function urlImagem(carta, qualidade = 'low') {
  let base = carta.image;
  if (!base && estado.setAtual?.serie?.id) {
    base = `https://assets.tcgdex.net/${estado.config.idioma}/${estado.setAtual.serie.id}/${setDaCarta(carta.id)}/${carta.localId}`;
  }
  return base ? `${base}/${qualidade}.webp` : null;
}

// Se a imagem em português não existir, tenta a versão em inglês; se nem assim, mostra o nome.
function prepararImagem(img, carta) {
  img.onerror = () => {
    const pt = `/${estado.config.idioma}/`;
    if (img.src.includes(pt) && estado.config.idioma !== 'en') {
      img.src = img.src.replace(pt, '/en/');
    } else {
      img.replaceWith(Object.assign(document.createElement('div'), {
        className: 'sem-img', textContent: `${carta.name} #${carta.localId ?? ''}`,
      }));
    }
  };
}

// ---------- Coleção ----------
function qtdDe(id) { return estado.colecao.cartas[id]?.qtd ?? 0; }

function definirQtd(id, qtd) {
  if (qtd <= 0) delete estado.colecao.cartas[id];
  else estado.colecao.cartas[id] = { qtd, set: setDaCarta(id) };
  salvarColecao();
  atualizarCartaNaGrade(id);
  atualizarProgresso();
}

function vibrar(ms) { try { navigator.vibrate?.(ms); } catch { /* sem vibração */ } }

function alternar(id) { definirQtd(id, qtdDe(id) > 0 ? 0 : 1); }

function contarDoSet(setId) {
  let n = 0;
  for (const c of Object.values(estado.colecao.cartas)) if (c.set === setId) n++;
  return n;
}

function atualizarTotal() {
  const unicas = Object.keys(estado.colecao.cartas).length;
  $('#totalGeral').textContent = `${unicas} carta${unicas === 1 ? '' : 's'}`;
}

// ---------- Lateral: séries e coleções ----------
async function carregarSeries() {
  const lista = $('#listaSeries');
  lista.textContent = 'Carregando coleções…';
  try {
    const series = await api('/series');
    const completas = await Promise.all(series.map((s) => api(`/series/${s.id}`).catch(() => null)));
    estado.series = completas.filter((s) => s?.sets?.length).reverse(); // mais novas primeiro
    desenharSeries();
  } catch (e) {
    console.error(e);
    lista.innerHTML = '<p class="sub">Não consegui carregar as coleções. Verifique a internet e recarregue a página.</p>';
  }
}

function desenharSeries() {
  const termo = $('#buscaSet').value.trim().toLowerCase();
  const lista = $('#listaSeries');
  lista.innerHTML = '';
  for (const serie of estado.series) {
    const sets = [...serie.sets].reverse().filter((s) => !termo || s.name.toLowerCase().includes(termo));
    if (!sets.length) continue;
    const bloco = document.createElement('div');
    bloco.className = 'serie';
    bloco.innerHTML = `<h3>${serie.name}</h3>`;
    for (const s of sets) {
      const total = s.cardCount?.total ?? s.cardCount?.official ?? '?';
      const tenho = contarDoSet(s.id);
      const b = document.createElement('button');
      b.className = 'item-set';
      b.dataset.set = s.id;
      if (estado.setAtual?.id === s.id) b.classList.add('ativo');
      if (total !== '?' && tenho >= total) b.classList.add('completo');
      b.innerHTML = `${s.symbol ? `<img src="${s.symbol}.webp" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : '<span style="width:22px"></span>'}
        <span class="nome"></span><span class="cont">${tenho}/${total}</span>`;
      b.querySelector('.nome').textContent = s.name;
      b.onclick = () => abrirSet(s.id);
      bloco.appendChild(b);
    }
    lista.appendChild(bloco);
  }
  if (!lista.children.length) lista.innerHTML = '<p class="sub">Nenhuma coleção encontrada.</p>';
}

// ---------- Abrir um set ----------
async function abrirSet(setId) {
  fecharMenu();
  estado.modo = 'set';
  $('#buscaCarta').value = '';
  $('#grade').innerHTML = '<div class="carregando">Carregando cartas…</div>';
  try {
    estado.setAtual = await api(`/sets/${setId}`);
  } catch (e) {
    $('#grade').innerHTML = '<div class="vazio">Não consegui carregar essa coleção.</div>';
    return;
  }
  location.hash = setId;
  desenharCabecalhoSet();
  desenharGrade();
  window.scrollTo({ top: 0 });
  document.querySelectorAll('.item-set').forEach((b) => b.classList.toggle('ativo', b.dataset.set === setId));
}

function desenharCabecalhoSet() {
  const s = estado.setAtual;
  const cab = $('#cabecalhoSet');
  cab.innerHTML = `
    ${s.logo ? `<img class="logo" src="${s.logo}.webp" alt="" onerror="this.remove()">` : ''}
    <div>
      <h2></h2>
      <p class="sub">${s.serie?.name ?? ''}${s.releaseDate ? ' · ' + s.releaseDate.split('-').reverse().join('/') : ''}</p>
      <p class="sub" id="txtProgresso"></p>
      <div class="progresso"><div id="barraProgresso"></div></div>
    </div>
    <div class="acoes-set">
      <button id="btnMarcarTodas">Marcar todas</button>
      <button id="btnDesmarcarTodas">Desmarcar todas</button>
    </div>`;
  cab.querySelector('h2').textContent = s.name;
  $('#btnMarcarTodas').onclick = () => marcarVarias(true);
  $('#btnDesmarcarTodas').onclick = () => marcarVarias(false);
  atualizarProgresso();
}

function marcarVarias(marcar) {
  const cartas = filtrarCartas(estado.setAtual.cards);
  const acao = marcar ? 'marcar' : 'desmarcar';
  if (!confirm(`Deseja ${acao} ${cartas.length} cartas visíveis?`)) return;
  for (const c of cartas) {
    if (marcar && !qtdDe(c.id)) estado.colecao.cartas[c.id] = { qtd: 1, set: setDaCarta(c.id) };
    if (!marcar) delete estado.colecao.cartas[c.id];
  }
  salvarColecao();
  desenharGrade();
  atualizarProgresso();
}

function atualizarProgresso() {
  if (estado.modo === 'set' && estado.setAtual) {
    const s = estado.setAtual;
    const total = s.cards?.length || s.cardCount?.total || 0;
    const tenho = s.cards.filter((c) => qtdDe(c.id) > 0).length;
    const pct = total ? Math.round((tenho / total) * 100) : 0;
    const txt = $('#txtProgresso');
    if (txt) txt.textContent = `${tenho} de ${total} cartas (${pct}%)`;
    const barra = $('#barraProgresso');
    if (barra) barra.style.width = pct + '%';
    const item = document.querySelector(`.item-set[data-set="${CSS.escape(s.id)}"]`);
    if (item) {
      item.querySelector('.cont').textContent = `${contarDoSet(s.id)}/${s.cardCount?.total ?? total}`;
      item.classList.toggle('completo', tenho >= total && total > 0);
    }
  }
}

// ---------- Busca global ----------
async function buscarGlobal(termo) {
  estado.modo = 'busca';
  estado.setAtual = null;
  document.querySelectorAll('.item-set.ativo').forEach((b) => b.classList.remove('ativo'));
  $('#cabecalhoSet').innerHTML = `<div><h2>Busca: “<span></span>”</h2><p class="sub">Toque na carta para marcar/desmarcar.</p></div>`;
  $('#cabecalhoSet span').textContent = termo;
  $('#grade').innerHTML = '<div class="carregando">Procurando…</div>';
  try {
    const res = await api(`/cards?name=${encodeURIComponent(termo)}`, { usarCache: false });
    estado.resultadoBusca = res;
    desenharGrade();
  } catch {
    $('#grade').innerHTML = '<div class="vazio">Erro na busca.</div>';
  }
}

// ---------- Grade de cartas ----------
function filtrarCartas(cartas) {
  const termo = estado.modo === 'set' ? $('#buscaCarta').value.trim().toLowerCase() : '';
  return cartas.filter((c) => {
    if (termo && !c.name.toLowerCase().includes(termo) && c.localId !== termo) return false;
    if (estado.filtro === 'tenho') return qtdDe(c.id) > 0;
    if (estado.filtro === 'faltam') return qtdDe(c.id) === 0;
    return true;
  });
}

function desenharGrade() {
  const grade = $('#grade');
  const base = estado.modo === 'set' ? estado.setAtual?.cards ?? []
    : estado.modo === 'busca' ? estado.resultadoBusca ?? [] : [];
  const cartas = filtrarCartas(base);
  estado.cartasVisiveis = cartas;
  grade.innerHTML = '';
  if (!cartas.length) {
    if (estado.modo !== 'inicio') grade.innerHTML = '<div class="vazio">Nenhuma carta aqui.</div>';
    return;
  }
  const frag = document.createDocumentFragment();
  for (const c of cartas) frag.appendChild(criarCarta(c));
  grade.appendChild(frag);
}

function criarCarta(c) {
  const el = document.createElement('div');
  el.className = 'carta';
  el.dataset.id = c.id;
  el.setAttribute('role', 'button');
  el.tabIndex = 0;
  const qtd = qtdDe(c.id);
  if (qtd) el.classList.add('tenho');

  const moldura = document.createElement('div');
  moldura.className = 'moldura';
  const src = urlImagem(c);
  if (src) {
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.alt = c.name;
    prepararImagem(img, c);
    img.src = src;
    moldura.appendChild(img);
  } else {
    moldura.innerHTML = '<div class="sem-img"></div>';
    moldura.firstChild.textContent = `${c.name} #${c.localId ?? ''}`;
  }

  const selo = document.createElement('span');
  selo.className = 'selo';
  selo.textContent = qtd > 1 ? `×${qtd}` : '✓';

  const info = document.createElement('button');
  info.className = 'info';
  info.textContent = 'i';
  info.title = 'Detalhes e quantidade';
  info.onclick = (e) => { e.stopPropagation(); abrirModalCarta(c); };

  const leg = document.createElement('div');
  leg.className = 'legenda';
  leg.textContent = `#${c.localId ?? ''} ${c.name}`;

  el.append(moldura, selo, info, leg);
  // Segurar o dedo (ou o clique) por meio segundo abre os detalhes
  let tempoSegurar, segurou = false, inicio = null;
  const cancelar = () => clearTimeout(tempoSegurar);
  el.onpointerdown = (e) => {
    if (e.button > 0) return;
    segurou = false; inicio = [e.clientX, e.clientY];
    tempoSegurar = setTimeout(() => { segurou = true; vibrar(30); abrirModalCarta(c); }, 500);
  };
  el.onpointermove = (e) => {
    if (inicio && Math.hypot(e.clientX - inicio[0], e.clientY - inicio[1]) > 10) cancelar();
  };
  el.onpointerup = el.onpointerleave = el.onpointercancel = cancelar;
  el.addEventListener('touchend', (e) => { if (segurou) e.preventDefault(); });
  el.oncontextmenu = (e) => e.preventDefault();
  el.onclick = () => {
    if (segurou) { segurou = false; return; }
    vibrar(10);
    alternar(c.id);
  };
  el.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alternar(c.id); } };
  return el;
}

function atualizarCartaNaGrade(id) {
  const el = document.querySelector(`.carta[data-id="${CSS.escape(id)}"]`);
  if (!el) return;
  const qtd = qtdDe(id);
  // Se o filtro esconderia essa carta agora, redesenha a grade
  if ((estado.filtro === 'tenho' && !qtd) || (estado.filtro === 'faltam' && qtd)) { desenharGrade(); return; }
  el.classList.toggle('tenho', qtd > 0);
  el.querySelector('.selo').textContent = qtd > 1 ? `×${qtd}` : '✓';
}

// ---------- Modal da carta ----------
function abrirModalCarta(c) {
  estado.cartaModal = c;
  const img = $('#mcImg');
  img.onerror = null;
  img.src = urlImagem(c, 'high') ?? '';
  prepararImagem(img, c);
  img.alt = c.name;
  $('#mcNome').textContent = c.name;
  $('#mcInfo').textContent = `${c.id}`;
  $('#mcQtd').textContent = qtdDe(c.id);
  $('#modalCarta').abertoEm = Date.now();
  $('#modalCarta').showModal();
}
$('#mcMais').onclick = () => { const c = estado.cartaModal; definirQtd(c.id, qtdDe(c.id) + 1); $('#mcQtd').textContent = qtdDe(c.id); };
$('#mcMenos').onclick = () => { const c = estado.cartaModal; definirQtd(c.id, qtdDe(c.id) - 1); $('#mcQtd').textContent = qtdDe(c.id); };

// ---------- Reconhecer cartas por foto ----------
// OCR no próprio navegador (Tesseract.js, carregado só quando o Mestre usa a câmera).
// Lê o nome (topo da carta) e o número impresso (ex: "025/198", "TG05/TG30") e cruza com o catálogo.
const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
const PALAVRAS_IGNORADAS = new Set(['basico', 'basic', 'estagio', 'stage', 'evolui', 'evolves', 'from', 'pokemon',
  'treinador', 'trainer', 'item', 'apoiador', 'supporter', 'estadio', 'stadium', 'energia', 'energy', 'ferramenta',
  'tool', 'the', 'ex', 'gx', 'vmax', 'vstar', 'de', 'do', 'da', 'and']);

let ocrPromessa = null;
let aoProgredirOCR = null;
function prepararOCR() {
  return ocrPromessa ??= (async () => {
    if (!window.Tesseract) {
      await new Promise((ok, erro) => {
        const s = document.createElement('script');
        s.src = TESSERACT_URL; s.onload = ok;
        s.onerror = () => erro(new Error('Não consegui baixar o leitor de texto.'));
        document.head.appendChild(s);
      });
    }
    const worker = await Tesseract.createWorker('eng', 1, {
      logger: (m) => { if (m.status && m.progress < 1 && !m.status.startsWith('recognizing')) aoProgredirOCR?.(m); },
    });
    await worker.setParameters({ tessedit_pageseg_mode: '11' }); // texto espalhado (cartas têm texto em todo canto)
    return worker;
  })().catch((e) => { ocrPromessa = null; throw e; });
}

// Normaliza: minúsculas, sem acento, só letras/números/espaço
function normalizar(t) {
  return (t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function distancia(a, b) {
  if (a === b) return 0;
  let ant = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const atual = [i];
    for (let j = 1; j <= b.length; j++) {
      atual[j] = Math.min(ant[j] + 1, atual[j - 1] + 1, ant[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    ant = atual;
  }
  return ant[b.length];
}
function parecido(a, b) { return a && b ? 1 - distancia(a, b) / Math.max(a.length, b.length) : 0; }

// Quão bem o nome da carta aparece no texto lido (0 a 1), comparando com "janelas" de palavras
function semelhancaNome(nome, palavrasTexto) {
  const alvo = normalizar(nome);
  const n = alvo.split(' ').length;
  let melhor = 0;
  for (let tam = Math.max(1, n - 1); tam <= n + 1; tam++) {
    for (let i = 0; i + tam <= palavrasTexto.length; i++) {
      const janela = palavrasTexto.slice(i, i + tam);
      melhor = Math.max(melhor, parecido(alvo, janela.join(' ')), parecido(alvo.replace(/ /g, ''), janela.join('')));
      if (melhor === 1) return 1;
    }
  }
  return melhor;
}

// "025" -> "25", "tg05" -> "TG5", "SV-P 012" -> "SVP12"
function normalizarNumero(t) {
  const m = String(t ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').match(/^([A-Z]*)0*(\d+)$/);
  return m ? m[1] + m[2] : String(t ?? '').toUpperCase();
}

// Procura "025/198", "TG05/TG30", "GG01/GG70"… (o OCR às vezes troca "/" por "|", "l", "I" ou "7")
function lerNumero(texto) {
  const t = texto.toUpperCase().replace(/[Oo](?=\d)|(?<=\d)[Oo]/g, '0');
  const achados = [];
  const re = /(?:^|[^A-Z0-9])([A-Z]{0,2}\d{1,3})\s*[\/|\\lI]\s*([A-Z]{0,2}\d{2,3})(?![0-9])/g;
  for (const m of t.matchAll(re)) {
    const numero = normalizarNumero(m[1]);
    const total = parseInt(m[2].replace(/^[A-Z]+/, ''), 10);
    const n = parseInt(numero.replace(/^[A-Z]+/, ''), 10);
    if (total >= 10 && total <= 400 && n >= 1 && (n <= total + 150)) achados.push({ numero, total });
  }
  return achados;
}

// Recorta um pedaço da foto, ampliando e em tons de cinza com contraste esticado
function recortar(bitmap, [x, y, w, h], larguraAlvo) {
  const sx = x * bitmap.width, sy = y * bitmap.height, sw = w * bitmap.width, sh = h * bitmap.height;
  const escala = Math.min(3, larguraAlvo / sw);
  const cv = document.createElement('canvas');
  cv.width = Math.round(sw * escala); cv.height = Math.round(sh * escala);
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
  const img = ctx.getImageData(0, 0, cv.width, cv.height);
  const d = img.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    const g = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
    d[i] = g; hist[g]++;
  }
  // estica o contraste ignorando 1% dos extremos
  const corte = (d.length / 4) * 0.01;
  let lo = 0, hi = 255, soma = 0;
  while (lo < 255 && (soma += hist[lo]) < corte) lo++;
  soma = 0;
  while (hi > 0 && (soma += hist[hi]) < corte) hi--;
  const fator = hi > lo ? 255 / (hi - lo) : 1;
  for (let i = 0; i < d.length; i += 4) {
    const g = Math.max(0, Math.min(255, (d[i] - lo) * fator));
    d[i] = d[i + 1] = d[i + 2] = g;
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

async function lerCarta(worker, arquivo) {
  const bitmap = await createImageBitmap(arquivo);
  const ler = async (area, largura) => (await worker.recognize(recortar(bitmap, area, largura))).data.text;
  const textoTopo = await ler([0, 0, 1, 0.22], 1400);       // nome
  const textoInteiro = await ler([0, 0, 1, 1], 1800);       // tudo
  let numeros = lerNumero(textoInteiro);
  if (!numeros.length) numeros = lerNumero(await ler([0, 0.82, 1, 0.18], 2000)); // rodapé ampliado
  bitmap.close?.();
  return { textoTopo, textoInteiro, numeros };
}

function infoDosSets() {
  const porId = new Map(), porTotal = new Map();
  for (const serie of estado.series) for (const s of serie.sets) {
    porId.set(s.id, { ...s, serie: serie.name });
    const t = s.cardCount?.official;
    if (t) { if (!porTotal.has(t)) porTotal.set(t, []); porTotal.get(t).push(s.id); }
  }
  return { porId, porTotal };
}

// Junta candidatas pelo número impresso e pelo nome, e dá uma nota para cada
async function acharCandidatas(leitura) {
  const { porId, porTotal } = infoDosSets();
  const palavrasTopo = normalizar(leitura.textoTopo).split(' ').filter(Boolean);
  const palavrasTudo = normalizar(leitura.textoTopo + ' ' + leitura.textoInteiro).split(' ').filter(Boolean);
  const candidatas = new Map();
  const add = (c) => { if (c?.id && !candidatas.has(c.id)) candidatas.set(c.id, c); };

  // 1) Pelo número: sets com esse total impresso, carta com esse número
  for (const { numero, total } of leitura.numeros.slice(0, 3)) {
    for (const setId of (porTotal.get(total) ?? []).slice(0, 15)) {
      const set = await api(`/sets/${setId}`).catch(() => null);
      add(set?.cards?.find((c) => normalizarNumero(c.localId) === numero));
    }
  }
  // 2) Pelo nome: as palavras mais longas do topo da carta
  const termos = [...new Set(palavrasTopo.filter((p) => p.length >= 4 && !/\d/.test(p) && !PALAVRAS_IGNORADAS.has(p)))]
    .sort((a, b) => b.length - a.length).slice(0, 2);
  for (const termo of termos) {
    const res = await api(`/cards?name=${encodeURIComponent(termo)}`).catch(() => []);
    if (Array.isArray(res)) res.slice(0, 400).forEach(add);
  }

  const notas = [...candidatas.values()].map((c) => {
    const set = porId.get(setDaCarta(c.id));
    const nome = Math.max(semelhancaNome(c.name, palavrasTopo), semelhancaNome(c.name, palavrasTudo) * 0.9);
    const num = leitura.numeros.find((n) => n.numero === normalizarNumero(c.localId));
    const bateNumero = !!num;
    const bateTotal = !!num && set?.cardCount?.official === num.total;
    return { carta: c, set, nome, bateNumero, bateTotal, nota: nome * 0.5 + (bateNumero ? 0.3 : 0) + (bateTotal ? 0.2 : 0) };
  });
  // Lançamentos mais novos primeiro em caso de empate
  const ordem = [...porId.keys()];
  notas.sort((a, b) => b.nota - a.nota || ordem.indexOf(setDaCarta(b.carta.id)) - ordem.indexOf(setDaCarta(a.carta.id)));
  return notas.filter((n) => n.nota >= 0.35).slice(0, 8);
}

function temCerteza(notas) {
  const [a, b] = notas;
  if (!a) return false;
  const folga = !b || a.nota - b.nota >= 0.15;
  return folga && a.nome >= 0.6 && ((a.bateNumero && a.bateTotal) || (a.bateNumero && a.nome >= 0.85));
}

function descreverCarta(n) {
  return `${n.carta.name} · #${n.carta.localId}${n.set ? ` · ${n.set.name}` : ''}`;
}

function linhaResultado(arquivo) {
  const el = document.createElement('div');
  el.className = 'foto-item';
  const miniatura = document.createElement('img');
  miniatura.className = 'foto-mini';
  miniatura.src = URL.createObjectURL(arquivo);
  miniatura.alt = 'Sua foto';
  miniatura.onload = () => URL.revokeObjectURL(miniatura.src);
  const corpo = document.createElement('div');
  corpo.className = 'foto-corpo';
  corpo.innerHTML = '<p class="sub">Na fila…</p>';
  el.append(miniatura, corpo);
  $('#fotoResultados').prepend(el);
  return corpo;
}

function marcarReconhecida(corpo, n) {
  const id = n.carta.id;
  definirQtd(id, qtdDe(id) + 1);
  vibrar(20);
  corpo.innerHTML = '';
  const img = document.createElement('img');
  img.className = 'foto-carta';
  prepararImagem(img, n.carta);
  img.src = urlImagem(n.carta) ?? '';
  const txt = document.createElement('div');
  txt.innerHTML = '<b class="ok">✓ Marcada!</b><p class="sub nome"></p><p class="sub qtd-txt"></p>';
  txt.querySelector('.nome').textContent = descreverCarta(n);
  txt.querySelector('.qtd-txt').textContent = `Agora você tem ${qtdDe(id)}.`;
  const desfazer = document.createElement('button');
  desfazer.textContent = '↶ Desfazer';
  desfazer.onclick = () => {
    definirQtd(id, qtdDe(id) - 1);
    desenharSeries();
    mostrarEscolhas(corpo, n.todas, 'Desfeito. Era outra?');
  };
  txt.appendChild(desfazer);
  corpo.append(img, txt);
}

function mostrarEscolhas(corpo, notas, titulo) {
  corpo.innerHTML = '';
  const p = document.createElement('p');
  p.className = 'sub';
  p.textContent = titulo;
  corpo.appendChild(p);
  const lista = document.createElement('div');
  lista.className = 'foto-opcoes';
  for (const n of notas) {
    const b = document.createElement('button');
    b.className = 'foto-opcao';
    b.title = descreverCarta(n);
    const img = document.createElement('img');
    img.loading = 'lazy';
    prepararImagem(img, n.carta);
    img.src = urlImagem(n.carta) ?? '';
    const leg = document.createElement('span');
    leg.textContent = `#${n.carta.localId} ${n.set?.name ?? ''}`;
    b.append(img, leg);
    b.onclick = () => { marcarReconhecida(corpo, { ...n, todas: notas }); desenharSeries(); };
    lista.appendChild(b);
  }
  corpo.appendChild(lista);
}

let filaFotos = Promise.resolve();
function reconhecerFotos(arquivos) {
  for (const arquivo of arquivos) {
    const corpo = linhaResultado(arquivo);
    filaFotos = filaFotos.then(() => reconhecerUma(arquivo, corpo));
  }
  filaFotos = filaFotos.then(() => { $('#fotoStatus').textContent = ''; desenharSeries(); });
}

async function reconhecerUma(arquivo, corpo) {
  const status = $('#fotoStatus');
  try {
    if (!estado.series.length) { corpo.innerHTML = '<p class="sub">Espere o catálogo de coleções carregar e tente de novo.</p>'; return; }
    corpo.innerHTML = '<p class="sub">Preparando o leitor…</p>';
    aoProgredirOCR = (m) => {
      status.textContent = `Baixando o leitor de texto (só na 1ª vez)… ${Math.round((m.progress ?? 0) * 100)}%`;
    };
    const worker = await prepararOCR();
    aoProgredirOCR = null;
    status.textContent = '';
    corpo.innerHTML = '<p class="sub">🔎 Lendo a carta…</p>';
    const leitura = await lerCarta(worker, arquivo);
    corpo.innerHTML = '<p class="sub">📚 Procurando no catálogo…</p>';
    const notas = await acharCandidatas(leitura);
    console.debug('[foto]', leitura, notas);
    if (!notas.length) {
      const lido = leitura.numeros[0] ? ` (li o número ${leitura.numeros[0].numero}/${leitura.numeros[0].total})` : '';
      corpo.innerHTML = '<p class="sub"></p>';
      corpo.firstChild.textContent = `Não reconheci esta carta${lido}. Tente outra foto, mais de perto e sem reflexo — ou use a busca pelo nome.`;
      return;
    }
    if ($('#cfgAutoMarcar').checked && temCerteza(notas)) marcarReconhecida(corpo, { ...notas[0], todas: notas });
    else mostrarEscolhas(corpo, notas, notas.length === 1 ? 'Acho que é esta. Toque para marcar:' : 'Qual destas é a sua? Toque para marcar:');
  } catch (e) {
    console.error(e);
    corpo.innerHTML = '<p class="sub"></p>';
    corpo.firstChild.textContent = `Deu erro: ${e.message}. Verifique a internet e tente de novo.`;
  }
}

$('#btnFoto').onclick = () => {
  $('#modalFoto').abertoEm = Date.now();
  $('#modalFoto').showModal();
  prepararOCR().catch(() => {}); // já vai baixando o leitor enquanto o Mestre tira a foto
};
['#arqFotoCamera', '#arqFotos'].forEach((sel) => {
  $(sel).onchange = (e) => { reconhecerFotos([...e.target.files]); e.target.value = ''; };
});

// ---------- Configurações / backup ----------
$('#btnConfig').onclick = () => { $('#cfgIdioma').value = estado.config.idioma; $('#modalConfig').showModal(); };
document.querySelectorAll('[data-fechar]').forEach((b) => (b.onclick = () => b.closest('dialog').close()));
// Toque no fundo escuro fecha (ignorando o "clique" que sobra ao soltar o dedo depois de segurar a carta)
document.querySelectorAll('dialog').forEach((d) => d.addEventListener('click', (e) => {
  if (e.target === d && Date.now() - (d.abertoEm ?? 0) > 400) d.close();
}));

$('#cfgIdioma').onchange = (e) => {
  estado.config.idioma = e.target.value;
  salvarJSON(CHAVE_CONFIG, estado.config);
  location.hash = '';
  location.reload();
};

$('#btnExportar').onclick = () => {
  const dados = { ...estado.colecao, exportadoEm: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `colecao-pokemon-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  avisar('Backup exportado!');
};

$('#arqImportar').onchange = async (e) => {
  const arq = e.target.files[0];
  if (!arq) return;
  try {
    const dados = JSON.parse(await arq.text());
    if (!dados.cartas || typeof dados.cartas !== 'object') throw new Error('formato');
    const n = Object.keys(dados.cartas).length;
    const juntar = confirm(`Arquivo com ${n} cartas.\n\nOK = JUNTAR com a coleção atual\nCancelar = SUBSTITUIR a coleção atual`);
    if (juntar) {
      for (const [id, c] of Object.entries(dados.cartas)) {
        estado.colecao.cartas[id] = { qtd: Math.max(qtdDe(id), c.qtd ?? 1), set: c.set ?? setDaCarta(id) };
      }
    } else {
      estado.colecao = { versao: 1, cartas: dados.cartas };
    }
    salvarColecao();
    desenharSeries();
    desenharGrade();
    atualizarProgresso();
    avisar('Coleção importada!');
  } catch {
    avisar('Arquivo inválido.');
  }
  e.target.value = '';
};

$('#btnLimparCache').onclick = async () => { await cache.limpar(); location.reload(); };

// ---------- Eventos gerais ----------
function abrirMenu() {
  $('#lateral').classList.add('aberta');
  $('#veu').hidden = false;
  $('#btnMenu').setAttribute('aria-expanded', 'true');
  if (celular.matches) document.body.classList.add('travado');
}
function fecharMenu() {
  $('#lateral').classList.remove('aberta');
  $('#veu').hidden = true;
  $('#btnMenu').setAttribute('aria-expanded', 'false');
  document.body.classList.remove('travado');
}
const celular = matchMedia('(max-width: 760px)');
$('#btnMenu').onclick = () => ($('#lateral').classList.contains('aberta') ? fecharMenu() : abrirMenu());
document.querySelectorAll('[data-abrir-menu]').forEach((b) => (b.onclick = abrirMenu));
$('#veu').onclick = fecharMenu;
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharMenu(); });
celular.addEventListener('change', () => { if (!celular.matches) fecharMenu(); ajustarTextos(); });

// Arrastar a gaveta para a esquerda fecha
(() => {
  let x0 = null;
  const lat = $('#lateral');
  lat.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  lat.addEventListener('touchend', (e) => {
    if (x0 !== null && x0 - e.changedTouches[0].clientX > 70) fecharMenu();
    x0 = null;
  });
})();

// Textos menores no celular
function ajustarTextos() {
  $('#buscaCarta').placeholder = celular.matches
    ? 'Buscar carta (ex: Pikachu)…'
    : 'Buscar carta (ex: Pikachu) — Enter busca em todas as coleções';
}
ajustarTextos();

// Botão "voltar ao topo"
window.addEventListener('scroll', () => { $('#btnTopo').hidden = window.scrollY < 800; }, { passive: true });
$('#btnTopo').onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
$('#buscaSet').oninput = desenharSeries;

let tempoBusca;
$('#buscaCarta').oninput = (e) => {
  const termo = e.target.value.trim();
  if (estado.modo === 'set') { desenharGrade(); return; }
  clearTimeout(tempoBusca);
  if (termo.length >= 3) tempoBusca = setTimeout(() => buscarGlobal(termo), 400);
};

$('#buscaCarta').onkeydown = (e) => {
  const termo = e.target.value.trim();
  if (e.key === 'Enter' && termo.length >= 2) {
    clearTimeout(tempoBusca);
    if (celular.matches) e.target.blur(); // fecha o teclado do celular
    buscarGlobal(termo);
  }
};

document.querySelectorAll('.filtros button').forEach((b) => {
  b.onclick = () => {
    document.querySelectorAll('.filtros button').forEach((x) => x.classList.remove('ativo'));
    b.classList.add('ativo');
    estado.filtro = b.dataset.filtro;
    desenharGrade();
  };
});

// ---------- Início ----------
$('#txtVersao').textContent = `PokéColeção v${VERSAO}`;
atualizarTotal();
carregarSeries().then(() => {
  const setNoLink = decodeURIComponent(location.hash.slice(1));
  if (setNoLink) abrirSet(setNoLink);
});
