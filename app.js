/* PokéColeção TCG
 * Catálogo de cartas: API pública TCGdex (https://tcgdex.dev) — sem chave, com suporte a português.
 * Coleção: salva no navegador (localStorage) + exportar/importar .json.
 */
'use strict';

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
atualizarTotal();
carregarSeries().then(() => {
  const setNoLink = decodeURIComponent(location.hash.slice(1));
  if (setNoLink) abrirSet(setNoLink);
});
