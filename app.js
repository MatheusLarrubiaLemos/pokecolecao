/* PokéColeção TCG
 * Catálogo de cartas: API pública TCGdex (https://tcgdex.dev) — sem chave, com suporte a português.
 * Coleção: salva no navegador (localStorage) + exportar/importar .json.
 */
'use strict';

const VERSAO = '1.3.0'; // atualize também o CHANGELOG.md
const API = 'https://api.tcgdex.net/v2';
const ASSETS = 'https://assets.tcgdex.net';
const CHAVE_COLECAO = 'pokecolecao:colecao';
const CHAVE_CONFIG = 'pokecolecao:config';
const CHAVE_RECENTES = 'pokecolecao:recentes';          // últimas cartas marcadas (menu principal)
const CHAVE_SETS_RECENTES = 'pokecolecao:setsRecentes'; // últimas coleções abertas
const CACHE_DIAS = 3; // catálogo mais velho que isso é atualizado em segundo plano, sem fazer o Mestre esperar
const SERIES_DIGITAIS = new Set(['tcgp']); // TCG Pocket: cartas só do jogo de celular

const TIPOS = [
  { id: 'classico', nome: 'Clássico', emoji: '🔴', c1: '#e3350d', c2: '#ff7043' },
  { id: 'fogo', nome: 'Fogo', emoji: '🔥', c1: '#d9480f', c2: '#f7a440' },
  { id: 'agua', nome: 'Água', emoji: '💧', c1: '#1f6fd1', c2: '#45b4ef' },
  { id: 'planta', nome: 'Planta', emoji: '🌿', c1: '#23864a', c2: '#6cc24a' },
  { id: 'eletrico', nome: 'Elétrico', emoji: '⚡', c1: '#f2b705', c2: '#ffe14d' },
  { id: 'psiquico', nome: 'Psíquico', emoji: '🔮', c1: '#a8307a', c2: '#e86aa9' },
  { id: 'lutador', nome: 'Lutador', emoji: '👊', c1: '#a14a22', c2: '#d9843f' },
  { id: 'sombrio', nome: 'Sombrio', emoji: '🌙', c1: '#2f2a45', c2: '#5d5480' },
  { id: 'metal', nome: 'Metal', emoji: '⚙️', c1: '#56657a', c2: '#9fb0c2' },
  { id: 'dragao', nome: 'Dragão', emoji: '🐉', c1: '#8a6a0c', c2: '#c9a227' },
  { id: 'fada', nome: 'Fada', emoji: '✨', c1: '#c23a82', c2: '#f59cc7' },
];

// Nível do treinador pelo número de cartas diferentes
const NIVEIS = [
  { min: 0, nome: 'Novato' },
  { min: 10, nome: 'Treinador Iniciante' },
  { min: 50, nome: 'Treinador' },
  { min: 150, nome: 'Treinador Ás' },
  { min: 300, nome: 'Líder de Ginásio' },
  { min: 600, nome: 'Elite dos Quatro' },
  { min: 1000, nome: 'Campeão' },
  { min: 2000, nome: 'Mestre Pokémon' },
];

const INSIGNIAS = [
  { emoji: '🌱', nome: 'Primeira carta', dica: 'Marque sua primeira carta', ok: (e) => e.unicas >= 1 },
  { emoji: '📦', nome: '50 cartas', dica: 'Tenha 50 cartas diferentes', ok: (e) => e.unicas >= 50 },
  { emoji: '💯', nome: 'Centena', dica: 'Tenha 100 cartas diferentes', ok: (e) => e.unicas >= 100 },
  { emoji: '🎖️', nome: '500 cartas', dica: 'Tenha 500 cartas diferentes', ok: (e) => e.unicas >= 500 },
  { emoji: '👑', nome: 'Mil cartas', dica: 'Tenha 1.000 cartas diferentes', ok: (e) => e.unicas >= 1000 },
  { emoji: '🏆', nome: 'Coleção completa', dica: 'Complete uma coleção inteira', ok: (e) => e.completas >= 1 },
  { emoji: '🧭', nome: 'Explorador', dica: 'Tenha cartas de 10 coleções', ok: (e) => e.sets >= 10 },
  { emoji: '🔁', nome: 'Trocador', dica: 'Junte 10 cartas repetidas', ok: (e) => e.repetidas >= 10 },
  { emoji: '📸', nome: 'Olho de águia', dica: 'Reconheça uma carta por foto', ok: () => estado.config.fotosReconhecidas >= 1 },
];

const DICAS = [
  'Segure o dedo numa carta (ou toque no <b>i</b>) para ver raridade, preço de referência e quantidade.',
  'Use o filtro <b>Faltam</b> para ver só as cartas que ainda faltam na coleção.',
  'Carta com número maior que o total (ex: 210/198) é uma <b>carta secreta</b>.',
  'Toque em <b>📷</b> e fotografe a carta com boa luz e sem reflexo: eu marco sozinho.',
  'Faça <b>backup</b> de vez em quando: a coleção fica salva só neste aparelho.',
  'No celular, dá para <b>instalar o PokéColeção</b> como app na tela inicial.',
  'Escolha seu <b>tipo favorito</b> em ⚙ e o app muda de cor.',
  'Na busca, aperte <b>Enter</b> para procurar uma carta em todas as coleções.',
];

const POKEBOLA_SVG = '<svg viewBox="0 0 64 64" width="40" height="40" aria-hidden="true"><circle cx="32" cy="32" r="29" fill="#fff"/><path d="M3 32a29 29 0 0 1 58 0z" fill="#ee1515"/><circle cx="32" cy="32" r="29" fill="none" stroke="#1d2030" stroke-width="4"/><path d="M3 32h58" stroke="#1d2030" stroke-width="5"/><circle cx="32" cy="32" r="9.5" fill="#fff" stroke="#1d2030" stroke-width="4"/><circle cx="32" cy="32" r="4" fill="#fff" stroke="#1d2030" stroke-width="2"/></svg>';

// ---------- Estado ----------
const estado = {
  config: { idioma: 'pt', tema: 'auto', tipo: 'classico', ultimoBackup: null, fotosReconhecidas: 0, ...lerJSON(CHAVE_CONFIG, {}) },
  colecao: lerJSON(CHAVE_COLECAO, { versao: 1, cartas: {} }), // cartas: { "sv01-001": { qtd, set } }
  series: [],            // [{ id, name, releaseDate, digital, sets: [...] }] — mais novas primeiro
  infoSets: new Map(),   // setId -> { id, name, logo, cardCount, serieId, serieNome, digital }
  ordemSet: new Map(),   // setId -> posição (0 = lançamento mais novo)
  setAberto: null,       // id da coleção na tela (mesmo enquanto carrega)
  setAtual: null,        // coleção carregada
  resultadoBusca: [],
  termoBusca: '',
  modo: '',              // 'inicio' | 'set' | 'busca' (vazio até a primeira tela abrir)
  filtro: 'todas',
  filtroSets: 'todas',
  cartaModal: null,
};
const cartasConhecidas = new Map(); // id -> carta vista no catálogo (nome, número, imagem)

// ---------- Utilidades ----------
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function lerJSON(chave, padrao) {
  try { return JSON.parse(localStorage.getItem(chave)) ?? padrao; } catch { return padrao; }
}
function salvarJSON(chave, valor) {
  try { localStorage.setItem(chave, JSON.stringify(valor)); return true; }
  catch { avisar('Não consegui salvar no navegador! Exporte um backup.'); return false; }
}
function salvarConfig() { salvarJSON(CHAVE_CONFIG, estado.config); }

function avisar(msg, ms = 2600) {
  const el = $('#aviso');
  el.textContent = msg;
  el.hidden = false;
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; // reinicia a animação
  clearTimeout(avisar.t);
  avisar.t = setTimeout(() => (el.hidden = true), ms);
}

function setDaCarta(id) { const i = id.lastIndexOf('-'); return i > 0 ? id.slice(0, i) : id; }
function numeroDaCarta(id) { const i = id.lastIndexOf('-'); return i > 0 ? id.slice(i + 1) : ''; }
// Normaliza: minúsculas, sem acento, só letras/números/espaço
function normalizar(t) {
  return (t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
const numeroBusca = (t) => String(t ?? '').trim().toLowerCase().replace(/^0+(?=\d)/, '');
const dataBR = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '');
// 1234 -> "1.234" (sem Intl: criar formatador na abertura custa caro em celular fraco)
const numero = (n) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const plural = (n, um, varios) => `${numero(n)} ${n === 1 ? um : varios}`;
const porcentagem = (n, total) => (total ? Math.min(100, Math.floor((n / total) * 100)) : 0);
const formatosMoeda = new Map();
function moeda(valor, codigo) {
  try {
    if (!formatosMoeda.has(codigo)) formatosMoeda.set(codigo, new Intl.NumberFormat('pt-BR', { style: 'currency', currency: codigo }));
    return formatosMoeda.get(codigo).format(Number(valor));
  } catch { return `${valor} ${codigo}`; }
}
function vibrar(padrao) { try { navigator.vibrate?.(padrao); } catch { /* sem vibração */ } }

// ---------- Cache do catálogo (IndexedDB) ----------
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

const baixando = new Map(); // evita baixar a mesma coisa duas vezes ao mesmo tempo
function baixarJSON(url, guardar) {
  if (baixando.has(url)) return baixando.get(url);
  const p = fetch(url)
    .then(async (resp) => {
      if (!resp.ok) throw new Error(`Erro ${resp.status}`);
      const dados = await resp.json();
      if (guardar) cache.set(url, { quando: Date.now(), dados });
      return dados;
    })
    .finally(() => baixando.delete(url));
  baixando.set(url, p);
  return p;
}
const velho = (quando) => Date.now() - quando > CACHE_DIAS * 864e5;

// Responde na hora com o que já está salvo; se estiver velho, atualiza em segundo plano para a próxima vez.
async function api(caminho, { idioma = estado.config.idioma, usarCache = true } = {}) {
  const url = `${API}/${idioma}${caminho}`;
  if (!usarCache) return baixarJSON(url, false);
  const c = await cache.get(url);
  if (c) {
    if (velho(c.quando)) baixarJSON(url, true).catch(() => {});
    return c.dados;
  }
  return baixarJSON(url, true);
}

// ---------- Catálogo ----------
// A lista de coleções (~20 KB) fica no localStorage: lê na hora, e o site abre já com ela desenhada.
const chaveCatalogo = () => `pokecolecao:catalogo:${estado.config.idioma}`;
function lerCatalogoSalvo() {
  try { return JSON.parse(localStorage.getItem(chaveCatalogo())); } catch { return null; }
}
function salvarCatalogo(series) {
  try { localStorage.setItem(chaveCatalogo(), JSON.stringify({ quando: Date.now(), dados: series })); } catch { /* sem espaço: só não guarda */ }
}

// Baixa todas as séries de uma vez e guarda num pacote só (abrir o site lê 1 item, não 13).
// usarCache: aproveita respostas já guardadas (ex: primeira abertura depois de atualizar o site).
async function baixarSeries(usarCache = false) {
  const lista = await api('/series', { usarCache });
  const completas = await Promise.all(lista.map((s) => api(`/series/${encodeURIComponent(s.id)}`, { usarCache }).catch(() => null)));
  const series = completas.filter((s) => s?.sets?.length).map((s) => ({
    id: s.id,
    name: s.name,
    releaseDate: s.releaseDate ?? '',
    digital: SERIES_DIGITAIS.has(s.id),
    sets: s.sets.map(({ id, name, logo, cardCount }) => ({ id, name, logo, cardCount })),
  }));
  if (!series.length) throw new Error('Catálogo vazio');
  if (!completas.includes(null)) salvarCatalogo(series);
  return series;
}

function aplicarSeries(series) {
  // Mais novas primeiro; as digitais (TCG Pocket) vão para o fim
  estado.series = [...series].sort((a, b) => (a.digital - b.digital) || String(b.releaseDate).localeCompare(String(a.releaseDate)));
  estado.infoSets = new Map();
  estado.ordemSet = new Map();
  let ordem = 0;
  for (const serie of estado.series) {
    for (const s of [...serie.sets].reverse()) {
      estado.infoSets.set(s.id, { ...s, serieId: serie.id, serieNome: serie.name, digital: serie.digital });
      estado.ordemSet.set(s.id, ordem++);
    }
  }
  desenharSeries();
  if (estado.modo === 'inicio') desenharInicio();
  else if (estado.modo === 'set') atualizarProgresso();
}

function carregarSeries() {
  const salvo = lerCatalogoSalvo();
  if (salvo?.dados?.length) {
    aplicarSeries(salvo.dados);
    if (velho(salvo.quando)) baixarSeries().then(aplicarSeries).catch(() => {});
    return;
  }
  baixarSeries(true).then(aplicarSeries).catch((e) => {
    console.error(e);
    $('#listaSeries').innerHTML = '<p class="sub vazio-lista">Não consegui carregar as coleções. Verifique a internet.<br><br><button data-recarregar>Tentar de novo</button></p>';
  });
}

// Carrega uma coleção. O que faltar em português é completado com o catálogo em inglês
// (os IDs das cartas são os mesmos): coleções antigas inteiras e imagens que só existem em inglês.
async function carregarSet(setId) {
  const caminho = `/sets/${encodeURIComponent(setId)}`;
  const set = await api(caminho);
  const cartas = set.cards ?? [];
  if (estado.config.idioma === 'en' || (cartas.length && cartas.every((c) => c.image))) return { ...set, cards: cartas };
  const en = await api(caminho, { idioma: 'en' }).catch(() => null);
  if (!en) return { ...set, cards: cartas };
  const cartasEn = en.cards ?? [];
  if (!cartas.length) {
    return { ...set, logo: set.logo ?? en.logo, emIngles: cartasEn.length > 0, cards: cartasEn.map((c) => (c.image ? c : { ...c, semImagem: true })) };
  }
  const imagemEn = new Map(cartasEn.map((c) => [c.id, c.image]));
  return {
    ...set,
    cards: cartas.map((c) => {
      if (c.image) return c;
      const img = imagemEn.get(c.id);
      return img ? { ...c, image: img } : { ...c, semImagem: true };
    }),
  };
}

async function carregarDetalhe(id) {
  const caminho = `/cards/${encodeURIComponent(id)}`;
  try { return await api(caminho); } catch { return api(caminho, { idioma: 'en' }); }
}

// ---------- Imagens ----------
function urlImagem(carta, qualidade = 'low') {
  if (carta.semImagem) return null;
  let base = carta.image;
  if (!base) {
    // Sem imagem no idioma escolhido: vai direto na versão em inglês (sem pedir o que não existe)
    const setId = setDaCarta(carta.id);
    const serie = estado.infoSets.get(setId)?.serieId ?? estado.setAtual?.serie?.id;
    if (!serie) return null;
    base = `${ASSETS}/en/${serie}/${setId}/${carta.localId ?? numeroDaCarta(carta.id)}`;
  }
  return `${base}/${qualidade}.webp`;
}

// Se a imagem falhar, tenta a versão em inglês; se nem assim, mostra um verso estilizado com o nome.
function prepararImagem(img, carta) {
  img.onerror = () => {
    const url = new URL(img.src, location.href);
    const partes = url.pathname.split('/');
    if (url.host === 'assets.tcgdex.net' && partes[1] && partes[1] !== 'en') {
      partes[1] = 'en';
      url.pathname = partes.join('/');
      img.src = url.href;
    } else {
      img.onerror = null;
      img.replaceWith(criarSemImagem(carta));
    }
  };
}

function criarSemImagem(carta) {
  const d = document.createElement('div');
  d.className = 'sem-img';
  d.innerHTML = '<span class="sem-img-bola"></span><b></b><small></small>';
  d.querySelector('b').textContent = carta.name ?? '';
  d.querySelector('small').textContent = `#${carta.localId ?? numeroDaCarta(carta.id ?? '')}`;
  return d;
}

function criarImagemCarta(carta, { qualidade = 'low', prioridade = false } = {}) {
  const src = urlImagem(carta, qualidade);
  if (!src) return criarSemImagem(carta);
  const img = document.createElement('img');
  img.width = 245;
  img.height = 342;
  img.alt = carta.name ?? '';
  img.decoding = 'async';
  if (prioridade) img.fetchPriority = 'high'; // as primeiras da tela chegam antes
  else img.loading = 'lazy';
  prepararImagem(img, carta);
  img.src = src;
  return img;
}

// ---------- Coleção ----------
function qtdDe(id) { return estado.colecao.cartas[id]?.qtd ?? 0; }
function salvarColecao() { salvarJSON(CHAVE_COLECAO, estado.colecao); atualizarTotal(); }

function definirQtd(id, qtd, carta = cartasConhecidas.get(id)) {
  const antes = qtdDe(id);
  qtd = Math.max(0, Math.floor(qtd) || 0);
  if (qtd === antes) return;
  const setId = setDaCarta(id);
  if (qtd === 0) delete estado.colecao.cartas[id];
  else estado.colecao.cartas[id] = { qtd, set: setId };
  salvarColecao();
  registrarRecente(id, carta, qtd, qtd > antes);
  atualizarCartaNaGrade(id, qtd > antes);
  atualizarProgresso();
  atualizarItemSet(setId);
  agendarInicio();
  if (antes === 0) verificarColecaoCompleta(setId);
}

function alternar(id) { definirQtd(id, qtdDe(id) > 0 ? 0 : 1); }

function contagemPorSet() {
  const m = new Map();
  for (const [id, c] of Object.entries(estado.colecao.cartas)) {
    const s = c.set ?? setDaCarta(id);
    m.set(s, (m.get(s) ?? 0) + 1);
  }
  return m;
}
function contarDoSet(setId) {
  if (estado.setAtual?.id === setId) return estado.setAtual.cards.reduce((n, c) => n + (qtdDe(c.id) > 0 ? 1 : 0), 0);
  let n = 0;
  for (const [id, c] of Object.entries(estado.colecao.cartas)) if ((c.set ?? setDaCarta(id)) === setId) n++;
  return n;
}
function totalDoSet(setId) {
  if (estado.setAtual?.id === setId && estado.setAtual.cards.length) return estado.setAtual.cards.length;
  return estado.infoSets.get(setId)?.cardCount?.total ?? 0;
}

function registrarRecente(id, carta, qtd, aumentou) {
  const lista = lerJSON(CHAVE_RECENTES, []);
  const resto = Array.isArray(lista) ? lista.filter((r) => r?.id !== id) : [];
  if (qtd === 0) salvarJSON(CHAVE_RECENTES, resto);
  else if (aumentou && carta) {
    const item = { id, name: carta.name, localId: carta.localId ?? null, image: carta.image ?? null, semImagem: !!carta.semImagem };
    salvarJSON(CHAVE_RECENTES, [item, ...resto].slice(0, 20));
  }
}
function recentes() {
  const l = lerJSON(CHAVE_RECENTES, []);
  return Array.isArray(l) ? l.filter((r) => r?.id && qtdDe(r.id) > 0) : [];
}
function lembrarSetRecente(setId) {
  const l = lerJSON(CHAVE_SETS_RECENTES, []);
  salvarJSON(CHAVE_SETS_RECENTES, [setId, ...(Array.isArray(l) ? l : []).filter((s) => s !== setId)].slice(0, 8));
}

function verificarColecaoCompleta(setId) {
  const total = totalDoSet(setId);
  if (!total || contarDoSet(setId) < total) return;
  const nome = estado.infoSets.get(setId)?.name ?? estado.setAtual?.name ?? setId;
  comemorar(`🏆 Parabéns, Mestre! Você completou ${nome}!`);
}

function atualizarTotal() {
  $('#totalGeral').textContent = plural(Object.keys(estado.colecao.cartas).length, 'carta', 'cartas');
}

// ---------- Lateral: coleções ----------
function anel(pct, tam = 28, traco = 4) {
  const r = (tam - traco) / 2, c = 2 * Math.PI * r, meio = tam / 2;
  const p = Math.max(0, Math.min(100, pct));
  return `<svg class="anel${p >= 100 ? ' completo' : ''}" width="${tam}" height="${tam}" viewBox="0 0 ${tam} ${tam}" aria-hidden="true">`
    + `<circle class="anel-fundo" cx="${meio}" cy="${meio}" r="${r}" stroke-width="${traco}"/>`
    + (p > 0 ? `<circle class="anel-valor" cx="${meio}" cy="${meio}" r="${r}" stroke-width="${traco}" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${(c * (1 - p / 100)).toFixed(2)}" transform="rotate(-90 ${meio} ${meio})"/>` : '')
    + '</svg>';
}

function itemSetHTML(s, n) {
  const total = s.cardCount?.total ?? 0;
  const completo = total > 0 && n >= total;
  return `<button class="item-set${estado.setAberto === s.id ? ' ativo' : ''}${completo ? ' completo' : ''}" data-set="${esc(s.id)}">`
    + `${anel(porcentagem(n, total))}<span class="nome">${esc(s.name)}</span><span class="cont">${completo ? '🏆 ' : ''}${n}/${total || '?'}</span></button>`;
}

// No celular a gaveta começa fechada: a lista (126 coleções) é desenhada quando o navegador estiver
// livre, ou na hora de abrir a gaveta. Assim a primeira tela aparece mais rápido.
let listaDesatualizada = true;
const quandoLivre = window.requestIdleCallback ? (f) => requestIdleCallback(f, { timeout: 2000 }) : (f) => setTimeout(f, 300);
function desenharSeries() {
  listaDesatualizada = true;
  if (celular.matches && !$('#lateral').classList.contains('aberta')) {
    if (!desenharSeries.agendado) {
      desenharSeries.agendado = true;
      quandoLivre(() => { desenharSeries.agendado = false; if (listaDesatualizada) desenharSeriesAgora(); });
    }
    return;
  }
  desenharSeriesAgora();
}

function desenharSeriesAgora() {
  if (!estado.series.length) return;
  listaDesatualizada = false;
  const termo = normalizar($('#buscaSet').value);
  const contagem = contagemPorSet();
  const html = [];
  for (const serie of estado.series) {
    const serieBate = termo && normalizar(serie.name).includes(termo);
    const sets = [...serie.sets].reverse().filter((s) => {
      if (termo && !serieBate && !normalizar(s.name).includes(termo) && !normalizar(s.id).includes(termo)) return false;
      const n = contagem.get(s.id) ?? 0, total = s.cardCount?.total ?? 0;
      if (estado.filtroSets === 'comecadas') return n > 0;
      if (estado.filtroSets === 'completas') return total > 0 && n >= total;
      return true;
    });
    if (!sets.length) continue;
    // Tamanho estimado: o navegador só calcula as séries fora da tela quando chegam perto
    html.push(`<section class="serie" style="contain-intrinsic-size:auto ${sets.length * 44 + 44}px"><h3>${esc(serie.name)}${serie.digital ? '<span class="etiqueta">digital</span>' : ''}</h3>`
      + sets.map((s) => itemSetHTML(s, contagem.get(s.id) ?? 0)).join('') + '</section>');
  }
  const vazio = estado.filtroSets === 'comecadas' ? 'Você ainda não começou nenhuma coleção.'
    : estado.filtroSets === 'completas' ? 'Nenhuma coleção completa ainda. Bora, Mestre! 💪' : 'Nenhuma coleção encontrada.';
  $('#listaSeries').innerHTML = html.join('') || `<p class="sub vazio-lista">${vazio}</p>`;
}

function atualizarItemSet(setId) {
  const b = $(`.item-set[data-set="${CSS.escape(setId)}"]`, $('#listaSeries'));
  const s = estado.infoSets.get(setId);
  if (b && s) b.outerHTML = itemSetHTML(s, contarDoSet(setId));
}

function marcarSetAtivo(setId) {
  $$('.item-set.ativo').forEach((b) => b.classList.remove('ativo'));
  if (setId) $(`.item-set[data-set="${CSS.escape(setId)}"]`)?.classList.add('ativo');
}

const celular = matchMedia('(max-width: 760px)');
function abrirMenu() {
  if (!celular.matches) { $('#buscaSet').focus(); return; } // no PC a lista já está à vista
  if (listaDesatualizada) desenharSeriesAgora();
  $('#lateral').classList.add('aberta');
  $('#veu').hidden = false;
  document.body.classList.add('travado');
  atualizarNav();
  $('.item-set.ativo')?.scrollIntoView({ block: 'center' });
}
function fecharMenu() {
  $('#lateral').classList.remove('aberta');
  $('#veu').hidden = true;
  document.body.classList.remove('travado');
  atualizarNav();
}

// ---------- Navegação (o botão "voltar" do celular funciona) ----------
let carregamento = 0; // identifica a tela atual: respostas atrasadas de telas antigas são ignoradas
let abrindo = true;   // primeira tela ao abrir o site (já começa no topo)

// Volta ao topo ao trocar de tela (na abertura não precisa: evita forçar o navegador a calcular a página antes da hora)
function irAoTopo() { if (!abrindo) window.scrollTo({ top: 0 }); }

function irPara(hash) {
  const novo = hash.replace(/^#/, '');
  if (location.hash.replace(/^#/, '') === novo) rota();
  else location.hash = novo;
}

function rota() {
  fecharMenu();
  $$('dialog[open]').forEach((d) => d.close());
  let h = '';
  try { h = decodeURIComponent(location.hash.replace(/^#/, '')); } catch { /* link quebrado: vai para o início */ }
  if (!h || h === 'inicio') mostrarInicio();
  else if (h === 'busca' || h.startsWith('busca=')) abrirBusca(h.slice(6).trim());
  else abrirSet(h);
  atualizarNav();
}

function mostrarTela(qual) {
  $('#telaInicio').hidden = qual !== 'inicio';
  $('#telaCartas').hidden = qual !== 'cartas';
}

function atualizarNav() {
  const menuAberto = $('#lateral').classList.contains('aberta');
  $$('.nav-inferior [data-nav]').forEach((b) => {
    const n = b.dataset.nav;
    const ativo = menuAberto ? n === 'colecoes'
      : (n === 'inicio' && estado.modo === 'inicio') || (n === 'colecoes' && estado.modo === 'set') || (n === 'busca' && estado.modo === 'busca');
    b.classList.toggle('ativo', ativo);
    if (ativo) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
}

// ---------- Menu principal ----------
function mostrarInicio() {
  carregamento++;
  estado.modo = 'inicio';
  estado.setAtual = null;
  estado.setAberto = null;
  mostrarTela('inicio');
  marcarSetAtivo(null);
  document.title = 'PokéColeção TCG';
  desenharInicio();
  irAoTopo();
}

function agendarInicio() {
  if (estado.modo !== 'inicio') return;
  clearTimeout(agendarInicio.t);
  agendarInicio.t = setTimeout(desenharInicio, 150);
}

function estatisticas() {
  const porSet = contagemPorSet();
  let unicas = 0, copias = 0, repetidas = 0, completas = 0;
  for (const c of Object.values(estado.colecao.cartas)) {
    unicas++;
    copias += c.qtd;
    repetidas += Math.max(0, c.qtd - 1);
  }
  for (const [setId, n] of porSet) {
    const total = estado.infoSets.get(setId)?.cardCount?.total;
    if (total && n >= total) completas++;
  }
  return { unicas, copias, repetidas, completas, porSet, sets: porSet.size };
}

function nivel(unicas) {
  let i = NIVEIS.length - 1;
  while (i > 0 && unicas < NIVEIS[i].min) i--;
  const atual = NIVEIS[i], proximo = NIVEIS[i + 1];
  const pct = proximo ? ((unicas - atual.min) / (proximo.min - atual.min)) * 100 : 100;
  return { atual, proximo, pct };
}

function saudacao() {
  const h = new Date().getHours();
  return h < 5 ? 'Boa noite' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}
const dicaDoDia = () => DICAS[Math.floor(Date.now() / 864e5) % DICAS.length];

function desenharInicio() {
  const e = estatisticas();
  const partes = [cartaoTreinadorHTML(e), acoesRapidasHTML(), alertaBackupHTML(e)];
  if (!e.unicas) partes.push(primeirosPassosHTML());
  else {
    const continuar = idsContinuar(e);
    const colunas = continuarHTML(e, continuar) + quaseCompletasHTML(e, continuar);
    if (colunas) partes.push(`<div class="inicio-colunas">${colunas}</div>`);
    partes.push(ultimasCartasHTML());
  }
  partes.push(insigniasHTML(e), lancamentosHTML(e));
  const alvo = $('#inicioDinamico');
  alvo.innerHTML = partes.filter(Boolean).join('');
  // Imagens das últimas cartas (com troca para inglês ou verso, se faltar)
  const porId = new Map(recentes().map((r) => [r.id, r]));
  $$('.mini-carta', alvo).forEach((b) => {
    const r = porId.get(b.dataset.carta);
    if (r) b.prepend(criarImagemCarta(r));
  });
}

function cartaoTreinadorHTML(e) {
  const nv = nivel(e.unicas);
  const tipo = TIPOS.find((t) => t.id === estado.config.tipo) ?? TIPOS[0];
  return `<section class="cartao-treinador">
    <div class="ct-topo">
      <div class="ct-avatar" title="Tipo favorito: ${esc(tipo.nome)}">${tipo.id === 'classico' ? POKEBOLA_SVG : tipo.emoji}</div>
      <div class="ct-nome">
        <p class="ct-saudacao">${saudacao()}, Mestre!</p>
        <h2>${esc(nv.atual.nome)}</h2>
      </div>
    </div>
    <div class="ct-nivel">
      <div class="barra-nivel" role="progressbar" aria-label="Progresso de nível" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(nv.pct)}"><div style="width:${nv.pct.toFixed(1)}%"></div></div>
      <p>${nv.proximo ? `Faltam <b>${numero(nv.proximo.min - e.unicas)}</b> cartas para virar <b>${esc(nv.proximo.nome)}</b>` : 'Nível máximo! Você é uma lenda. 👑'}</p>
    </div>
    <div class="ct-stats">
      <div><b>${numero(e.unicas)}</b><span>únicas</span></div>
      <div><b>${numero(e.copias)}</b><span>cópias</span></div>
      <div><b>${numero(e.repetidas)}</b><span>repetidas</span></div>
      <div><b>${numero(e.completas)}</b><span>completas</span></div>
    </div>
    <p class="ct-dica">💡 ${dicaDoDia()}</p>
  </section>`;
}

function acoesRapidasHTML() {
  const n = estado.infoSets.size;
  return `<section class="acoes-rapidas">
    <button data-acao="foto"><span class="ar-icone">📷</span><b>Escanear</b><small>marcar por foto</small></button>
    <button data-acao="colecoes"><span class="ar-icone">📚</span><b>Coleções</b><small>${n ? `${n} no catálogo` : 'ver todas'}</small></button>
    <button data-acao="backup"><span class="ar-icone">💾</span><b>Backup</b><small>salvar coleção</small></button>
  </section>`;
}

function alertaBackupHTML(e) {
  if (e.unicas < 10) return '';
  const ultimo = estado.config.ultimoBackup;
  const dias = ultimo ? (Date.now() - new Date(ultimo)) / 864e5 : Infinity;
  if (dias < 30) return '';
  return `<section class="alerta" role="note"><span>💾</span><div><b>Faça um backup, Mestre!</b>
    <p>${plural(e.unicas, 'carta está salva', 'cartas estão salvas')} só neste aparelho. ${ultimo ? `Último backup: ${dataBR(ultimo)}.` : 'Você ainda não fez nenhum.'}</p></div>
    <button data-acao="backup">Fazer agora</button></section>`;
}

function primeirosPassosHTML() {
  return `<section class="bloco primeiros-passos"><h3>🚀 Comece sua jornada, Mestre</h3><ol>
    <li><b>Escolha uma coleção</b> em 📚 Coleções.</li>
    <li><b>Toque nas cartas</b> que você tem: elas ficam coloridas com ✓.</li>
    <li>Ou use <b>📷 Escanear</b> e fotografe suas cartas, que eu marco sozinho.</li>
  </ol></section>`;
}

function miniSetHTML(setId, n) {
  const s = estado.infoSets.get(setId);
  if (!s) return '';
  const total = s.cardCount?.total ?? 0;
  const pct = porcentagem(n, total);
  const status = total && n >= total ? '🏆 completa' : `faltam ${numero(Math.max(0, total - n))}`;
  return `<button class="mini-set" data-set="${esc(setId)}">${anel(pct, 42, 5)}`
    + `<span class="ms-textos"><b>${esc(s.name)}</b><small>${numero(n)}/${numero(total)} · ${status}</small></span><span class="ms-pct">${pct}%</span></button>`;
}

// Últimas coleções abertas (ou, se nenhuma, as que têm mais cartas)
function idsContinuar(e) {
  const salvos = lerJSON(CHAVE_SETS_RECENTES, []);
  let ids = (Array.isArray(salvos) ? salvos : []).filter((id) => estado.infoSets.has(id));
  if (!ids.length) ids = [...e.porSet].sort((a, b) => b[1] - a[1]).map(([id]) => id).filter((id) => estado.infoSets.has(id));
  return ids.slice(0, 4);
}

function continuarHTML(e, ids) {
  if (!ids.length) return '';
  return `<section class="bloco"><h3>🕹️ Continuar colecionando</h3>${ids.map((id) => miniSetHTML(id, e.porSet.get(id) ?? 0)).join('')}</section>`;
}

// Coleções com pelo menos metade das cartas, ainda incompletas (sem repetir as do "Continuar")
function quaseCompletasHTML(e, jaMostradas) {
  const lista = [...e.porSet]
    .map(([id, n]) => ({ id, n, total: estado.infoSets.get(id)?.cardCount?.total ?? 0 }))
    .filter((x) => x.total && x.n < x.total && x.n / x.total >= 0.5 && !jaMostradas.includes(x.id))
    .sort((a, b) => b.n / b.total - a.n / a.total || (a.total - a.n) - (b.total - b.n))
    .slice(0, 4);
  if (!lista.length) return '';
  return `<section class="bloco"><h3>🎯 Quase completas</h3>${lista.map((x) => miniSetHTML(x.id, x.n)).join('')}</section>`;
}

function ultimasCartasHTML() {
  const lista = recentes().slice(0, 12);
  if (!lista.length) return '';
  return `<section class="bloco"><h3>🆕 Últimas cartas marcadas</h3><div class="fileira-cartas">`
    + lista.map((r) => `<button class="mini-carta" data-carta="${esc(r.id)}" title="${esc(r.name)}"><span>${esc(r.name)}</span></button>`).join('')
    + '</div></section>';
}

function insigniasHTML(e) {
  const ganhas = INSIGNIAS.filter((i) => i.ok(e)).length;
  return `<section class="bloco"><h3>🎖️ Insígnias <span class="contador">${ganhas}/${INSIGNIAS.length}</span></h3><div class="insignias">`
    + INSIGNIAS.map((i) => {
      const ok = i.ok(e);
      return `<div class="insignia${ok ? ' ganha' : ''}" title="${esc(i.dica)}"><span class="ins-icone" aria-hidden="true">${i.emoji}</span><b>${esc(i.nome)}</b><small>${ok ? 'Conquistada!' : esc(i.dica)}</small></div>`;
    }).join('') + '</div></section>';
}

function lancamentosHTML(e) {
  const lista = [];
  for (const serie of estado.series) {
    if (serie.digital) continue;
    for (const s of [...serie.sets].reverse()) if (lista.length < 6) lista.push(s);
    if (lista.length >= 6) break;
  }
  if (!lista.length) return '';
  return `<section class="bloco"><h3>✨ Lançamentos</h3><div class="lancamentos">` + lista.map((s) => {
    const n = e.porSet.get(s.id) ?? 0, total = s.cardCount?.total ?? 0;
    const logo = s.logo ? `<img src="${esc(s.logo)}.webp" alt="" loading="lazy" fetchpriority="low" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'l-bola'}))">` : '<span class="l-bola"></span>';
    return `<button class="lancamento" data-set="${esc(s.id)}">${logo}<b>${esc(s.name)}</b><small>${numero(n)}/${numero(total)} cartas</small></button>`;
  }).join('') + '</div></section>';
}

function acao(qual) {
  if (qual === 'foto') abrirFoto();
  else if (qual === 'colecoes') abrirMenu();
  else if (qual === 'backup') exportarBackup();
  else if (qual === 'busca') irPara('#busca');
  else if (qual === 'config') abrirConfig();
}

// ---------- Abrir uma coleção ----------
async function abrirSet(setId) {
  const meu = ++carregamento;
  estado.modo = 'set';
  estado.setAberto = setId;
  estado.setAtual = null;
  mostrarTela('cartas');
  marcarSetAtivo(setId);
  const busca = $('#buscaCarta');
  busca.value = '';
  busca.placeholder = celular.matches ? 'Filtrar nesta coleção…' : 'Filtrar nesta coleção (nome ou número) — Enter busca em todas';
  const info = estado.infoSets.get(setId);
  $('#cabecalhoSet').innerHTML = `<div class="cab-info"><div class="cab-textos"><h2>${esc(info?.name ?? 'Carregando…')}</h2><p class="sub">${esc(info?.serieNome ?? '')}</p></div></div>`;
  desenharEsqueleto();
  irAoTopo();
  let set;
  try {
    set = await carregarSet(setId);
  } catch {
    if (meu === carregamento) mostrarErroGrade('Não consegui carregar essa coleção. Verifique a internet e tente de novo.');
    return;
  }
  if (meu !== carregamento) return; // o Mestre já foi para outra tela
  estado.setAtual = set;
  lembrarSetRecente(setId);
  document.title = `${set.name} — PokéColeção`;
  desenharCabecalhoSet();
  desenharGrade(set.cards);
}

function desenharEsqueleto(n = 12) {
  $('#grade').innerHTML = '<div class="esqueleto"></div>'.repeat(n);
  $('#gradeVazia').hidden = true;
}
function mostrarErroGrade(msg) {
  $('#grade').innerHTML = '';
  const v = $('#gradeVazia');
  v.textContent = msg;
  v.hidden = false;
}

function desenharCabecalhoSet() {
  const s = estado.setAtual;
  const total = s.cards.length || s.cardCount?.total || 0;
  const oficiais = s.cardCount?.official ?? 0;
  const secretas = oficiais && total > oficiais ? total - oficiais : 0;
  const detalhes = [s.serie?.name, s.abbreviation?.official, s.releaseDate && `lançada em ${dataBR(s.releaseDate)}`].filter(Boolean);
  $('#cabecalhoSet').innerHTML = `
    <div class="cab-info">
      ${s.logo ? `<img class="logo" src="${esc(s.logo)}.webp" alt="" onerror="this.remove()">` : ''}
      <div class="cab-textos">
        <h2>${esc(s.name)}</h2>
        <p class="sub">${detalhes.map((d) => esc(d)).join(' · ')}</p>
        <p class="sub">${plural(total, 'carta', 'cartas')}${secretas ? ` (${numero(oficiais)} + ${plural(secretas, 'secreta', 'secretas')})` : ''}</p>
      </div>
    </div>
    <div class="cab-progresso">
      <div class="anel-grande" id="anelSet"></div>
      <div><p class="cab-num" id="txtProgresso"></p><p class="sub" id="txtFaltam"></p></div>
    </div>
    <div class="acoes-set">
      <button id="btnMarcarTodas">✓ Marcar todas</button>
      <button id="btnDesmarcarTodas">✕ Desmarcar todas</button>
    </div>
    ${s.emIngles ? '<p class="nota">ℹ️ Esta coleção ainda não tem cartas em português no catálogo, então mostro em inglês. A marcação vale do mesmo jeito.</p>' : ''}`;
  $('#btnMarcarTodas').onclick = () => marcarVarias(true);
  $('#btnDesmarcarTodas').onclick = () => marcarVarias(false);
  atualizarProgresso();
}

function atualizarProgresso() {
  if (estado.modo !== 'set' || !estado.setAtual || !$('#anelSet')) return;
  const s = estado.setAtual;
  const total = s.cards.length || s.cardCount?.total || 0;
  const tenho = contarDoSet(s.id);
  const pct = porcentagem(tenho, total);
  $('#anelSet').innerHTML = `${anel(pct, 72, 8)}<span>${pct}%</span>`;
  $('#txtProgresso').textContent = `${numero(tenho)} de ${numero(total)}`;
  $('#txtFaltam').textContent = total && tenho >= total ? '🏆 Coleção completa!' : `faltam ${numero(total - tenho)}`;
}

function marcarVarias(marcar) {
  const alvo = $$('#grade .carta:not([hidden])').map((el) => el.dataset.id).filter((id) => (marcar ? !qtdDe(id) : qtdDe(id)));
  if (!alvo.length) { avisar(marcar ? 'Todas as cartas visíveis já estão marcadas.' : 'Nenhuma carta visível está marcada.'); return; }
  if (!confirm(`Deseja ${marcar ? 'marcar' : 'desmarcar'} ${alvo.length} cartas visíveis?`)) return;
  for (const id of alvo) {
    if (marcar) estado.colecao.cartas[id] = { qtd: 1, set: setDaCarta(id) };
    else delete estado.colecao.cartas[id];
  }
  salvarColecao();
  $$('#grade .carta').forEach(pintarCarta);
  aplicarFiltro();
  atualizarProgresso();
  atualizarItemSet(estado.setAtual.id);
  if (marcar) verificarColecaoCompleta(estado.setAtual.id);
}

// ---------- Busca em todas as coleções ----------
const buscasFeitas = new Map(); // termo -> resultado (só nesta visita)
async function abrirBusca(termo) {
  const meu = ++carregamento;
  estado.modo = 'busca';
  estado.setAtual = null;
  estado.setAberto = null;
  estado.termoBusca = termo;
  mostrarTela('cartas');
  marcarSetAtivo(null);
  const input = $('#buscaCarta');
  input.value = termo;
  input.placeholder = 'Buscar carta em todas as coleções (ex: Pikachu)';
  document.title = termo ? `Busca: ${termo} — PokéColeção` : 'Buscar — PokéColeção';
  const cab = $('#cabecalhoSet');
  cab.innerHTML = '<div class="cab-info"><div class="cab-textos"><h2></h2><p class="sub"></p></div></div>';
  $('h2', cab).textContent = termo ? `🔎 “${termo}”` : '🔎 Buscar cartas';
  $('.sub', cab).textContent = termo ? 'Procurando…' : 'Digite o nome de uma carta (ex: Pikachu, Charizard) e aperte Enter.';
  if (!termo) {
    $('#grade').innerHTML = '';
    $('#gradeVazia').hidden = true;
    setTimeout(() => input.focus(), 60);
    return;
  }
  desenharEsqueleto();
  try {
    const chave = termo.toLowerCase();
    let res = buscasFeitas.get(chave);
    if (!res) {
      res = await api(`/cards?name=${encodeURIComponent(termo)}`, { usarCache: false });
      res = Array.isArray(res) ? res : [];
      buscasFeitas.set(chave, res);
    }
    if (meu !== carregamento) return;
    // Coleções mais novas primeiro
    const ordem = (c) => estado.ordemSet.get(setDaCarta(c.id)) ?? 1e9;
    const lista = [...res].sort((a, b) => ordem(a) - ordem(b));
    estado.resultadoBusca = lista;
    $('.sub', cab).textContent = lista.length
      ? `${plural(lista.length, 'carta encontrada', 'cartas encontradas')} · toque para marcar/desmarcar`
      : 'Nenhuma carta com esse nome. Confira a escrita (os nomes estão em português).';
    desenharGrade(lista);
  } catch {
    if (meu === carregamento) mostrarErroGrade('Erro na busca. Verifique a internet e tente de novo.');
  }
}

// ---------- Grade de cartas ----------
// A grade é montada uma vez; filtros e busca só escondem/mostram (rápido e sem baixar imagens de novo).
function desenharGrade(cartas) {
  const frag = document.createDocumentFragment();
  cartas.forEach((c, i) => {
    cartasConhecidas.set(c.id, c);
    frag.appendChild(criarCarta(c, i < 12));
  });
  $('#grade').replaceChildren(frag);
  aplicarFiltro();
}

function aplicarFiltro() {
  const bruto = estado.modo === 'set' ? $('#buscaCarta').value.trim() : '';
  const termo = normalizar(bruto);
  const termoNum = numeroBusca(bruto);
  let visiveis = 0, total = 0;
  for (const el of $('#grade').children) {
    if (!el.dataset.id) continue;
    total++;
    const qtd = qtdDe(el.dataset.id);
    let mostrar = estado.filtro === 'tenho' ? qtd > 0 : estado.filtro === 'faltam' ? qtd === 0 : true;
    if (mostrar && termo) mostrar = el.dataset.busca.includes(termo) || el.dataset.num === termoNum;
    el.hidden = !mostrar;
    if (mostrar) visiveis++;
  }
  const vazio = $('#gradeVazia');
  if (!total) {
    vazio.hidden = estado.modo !== 'set' || !estado.setAtual;
    vazio.textContent = 'Nenhuma carta nesta coleção ainda.';
    return;
  }
  vazio.hidden = visiveis > 0;
  vazio.textContent = termo ? `Nenhuma carta com “${bruto}” aqui.`
    : estado.filtro === 'tenho' ? 'Você ainda não tem cartas desta lista. Toque numa carta para marcar!'
      : estado.filtro === 'faltam' ? '🏆 Não falta nenhuma, Mestre!' : 'Nenhuma carta aqui.';
}

function criarCarta(c, prioridade = false) {
  const el = document.createElement('div');
  el.className = 'carta';
  el.dataset.id = c.id;
  el.dataset.busca = normalizar(c.name);
  el.dataset.num = numeroBusca(c.localId ?? numeroDaCarta(c.id));
  el.setAttribute('role', 'button');
  el.setAttribute('aria-label', `${c.name} #${c.localId ?? ''}`);
  el.tabIndex = 0;

  const moldura = document.createElement('div');
  moldura.className = 'moldura';
  moldura.appendChild(criarImagemCarta(c, { prioridade }));

  const selo = document.createElement('span');
  selo.className = 'selo';

  const info = document.createElement('button');
  info.className = 'info';
  info.textContent = 'i';
  info.title = 'Detalhes, preço e quantidade';
  info.setAttribute('aria-label', `Detalhes de ${c.name}`);
  info.onclick = (e) => { e.stopPropagation(); abrirModalCarta(c); };

  const leg = document.createElement('div');
  leg.className = 'legenda';
  leg.innerHTML = `#${esc(c.localId ?? '')} <b>${esc(c.name)}</b>`;
  if (estado.modo === 'busca') {
    leg.insertAdjacentHTML('beforeend', `<small>${esc(estado.infoSets.get(setDaCarta(c.id))?.name ?? setDaCarta(c.id))}</small>`);
  }

  el.append(moldura, selo, info, leg);
  pintarCarta(el);

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

function pintarCarta(el) {
  const qtd = qtdDe(el.dataset.id);
  el.classList.toggle('tenho', qtd > 0);
  el.querySelector('.selo').textContent = qtd > 1 ? `×${qtd}` : '✓';
}

function atualizarCartaNaGrade(id, animar = false) {
  const el = $(`.carta[data-id="${CSS.escape(id)}"]`, $('#grade'));
  if (!el) return;
  pintarCarta(el);
  const qtd = qtdDe(id);
  if (animar) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
  // Se o filtro esconderia a carta agora, ela sai com uma animação curtinha
  if ((estado.filtro === 'tenho' && !qtd) || (estado.filtro === 'faltam' && qtd)) {
    el.classList.add('saindo');
    setTimeout(() => { el.classList.remove('saindo'); aplicarFiltro(); }, 220);
  }
}

// ---------- Janela da carta ----------
async function abrirModalCarta(c) {
  estado.cartaModal = c;
  cartasConhecidas.set(c.id, c);
  const caixa = $('.mc-img');
  caixa.replaceChildren();
  const baixa = urlImagem(c, 'low');
  if (baixa) {
    const img = document.createElement('img');
    img.alt = c.name;
    img.width = 600;
    img.height = 825;
    prepararImagem(img, c);
    img.src = baixa; // a pequena já está no cache: aparece na hora, e a grande entra quando chegar
    caixa.appendChild(img);
    const grande = new Image();
    grande.onload = () => { if (estado.cartaModal === c && img.isConnected) img.src = grande.src; };
    grande.onerror = () => { if (!grande.src.includes('/en/')) grande.src = grande.src.replace(/(assets\.tcgdex\.net\/)[a-z-]+\//, '$1en/'); };
    grande.src = urlImagem(c, 'high');
  } else {
    caixa.appendChild(criarSemImagem(c));
  }
  $('#mcNome').textContent = c.name;
  const setId = setDaCarta(c.id);
  const info = estado.infoSets.get(setId);
  const oficial = info?.cardCount?.official;
  $('#mcInfo').textContent = `#${c.localId ?? numeroDaCarta(c.id)}${oficial ? `/${oficial}` : ''} · ${info?.name ?? setId}`;
  $('#mcQtd').textContent = qtdDe(c.id);
  $('#mcVerSet').hidden = estado.modo === 'set' && estado.setAberto === setId;
  $('#mcDetalhes').innerHTML = '<p class="sub">Carregando detalhes…</p>';
  const modal = $('#modalCarta');
  modal.abertoEm = Date.now();
  if (!modal.open) modal.showModal();
  try {
    const d = await carregarDetalhe(c.id);
    if (estado.cartaModal === c) $('#mcDetalhes').innerHTML = detalhesHTML(d);
  } catch {
    if (estado.cartaModal === c) $('#mcDetalhes').innerHTML = '<p class="sub">Detalhes indisponíveis agora (sem internet?).</p>';
  }
}

function detalhesHTML(d) {
  const itens = [];
  if (d.rarity) itens.push(['Raridade', d.rarity]);
  const categoria = [d.category, d.trainerType ?? d.energyType, d.stage].filter(Boolean).join(' · ');
  if (categoria) itens.push(['Categoria', categoria]);
  if (d.types?.length) itens.push(['Tipo', d.types.join(', ')]);
  if (d.hp) itens.push(['PS', d.hp]);
  if (d.illustrator) itens.push(['Ilustrador', d.illustrator]);
  if (d.regulationMark) itens.push(['Regulamento', d.regulationMark]);
  if (d.legal) itens.push(['Torneios', `${d.legal.standard ? '✅' : '❌'} Padrão · ${d.legal.expanded ? '✅' : '❌'} Expandido`, true]);
  const lista = itens.map(([k, v, largo]) => `<div${largo ? ' class="largo"' : ''}><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
  return (lista ? `<dl class="detalhes">${lista}</dl>` : '') + precosHTML(d.pricing);
}

function precosHTML(p) {
  if (!p) return '';
  const linhas = [];
  const cm = p.cardmarket;
  const valorCm = cm && (cm.trend || cm.avg || cm['trend-holo'] || cm['avg-holo']);
  if (valorCm) linhas.push(['Cardmarket (Europa)', moeda(valorCm, cm.unit || 'EUR')]);
  const tp = p.tcgplayer;
  if (tp) {
    const preferidas = ['normal', 'holofoil', 'reverse-holofoil', '1st-edition-holofoil', '1st-edition-normal', 'unlimited-holofoil'];
    const temPreco = (x) => x && typeof x === 'object' && (x.marketPrice || x.midPrice);
    const v = preferidas.map((k) => tp[k]).find(temPreco) ?? Object.values(tp).find(temPreco);
    if (v) linhas.push(['TCGplayer (EUA)', moeda(v.marketPrice || v.midPrice, tp.unit || 'USD')]);
  }
  if (!linhas.length) return '';
  const quando = cm?.updated || tp?.updated;
  return `<div class="precos"><h4>💰 Preço de referência</h4><ul>${linhas.map(([k, v]) => `<li><span>${esc(k)}</span><b>${esc(v)}</b></li>`).join('')}</ul>`
    + `<p class="sub">Preços do mercado internacional, só para ter uma ideia${quando ? ` (atualizado em ${dataBR(quando)})` : ''}.</p></div>`;
}

$('#mcMais').onclick = () => { const c = estado.cartaModal; definirQtd(c.id, qtdDe(c.id) + 1, c); $('#mcQtd').textContent = qtdDe(c.id); };
$('#mcMenos').onclick = () => { const c = estado.cartaModal; definirQtd(c.id, qtdDe(c.id) - 1, c); $('#mcQtd').textContent = qtdDe(c.id); };
$('#mcVerSet').onclick = () => irPara('#' + encodeURIComponent(setDaCarta(estado.cartaModal.id)));

// ---------- Configurações, aparência e backup ----------
function aplicarAparencia() {
  const html = document.documentElement;
  html.dataset.tipo = estado.config.tipo || 'classico';
  if (estado.config.tema === 'claro' || estado.config.tema === 'escuro') html.dataset.tema = estado.config.tema;
  else delete html.dataset.tema;
  const tipo = TIPOS.find((t) => t.id === estado.config.tipo) ?? TIPOS[0];
  $('meta[name="theme-color"]').setAttribute('content', tipo.c1);
}

function abrirConfig() {
  $('#cfgIdioma').value = estado.config.idioma;
  $('#cfgTema').value = estado.config.tema;
  desenharTipos();
  $('#txtUltimoBackup').textContent = estado.config.ultimoBackup
    ? `Último backup: ${dataBR(estado.config.ultimoBackup)}.` : 'Você ainda não fez nenhum backup.';
  const m = $('#modalConfig');
  m.abertoEm = Date.now();
  if (!m.open) m.showModal();
}

function desenharTipos() {
  $('#cfgTipos').innerHTML = TIPOS.map((t) => {
    const ativo = t.id === estado.config.tipo;
    const amostra = t.id === 'classico' ? '<span class="amostra amostra-bola"></span>' : `<span class="amostra">${t.emoji}</span>`;
    return `<button class="tipo${ativo ? ' ativo' : ''}" data-escolher-tipo="${t.id}" style="--c1:${t.c1};--c2:${t.c2}" aria-pressed="${ativo}">${amostra}${esc(t.nome)}</button>`;
  }).join('');
}

$('#cfgTipos').onclick = (e) => {
  const b = e.target.closest('[data-escolher-tipo]');
  if (!b) return;
  estado.config.tipo = b.dataset.escolherTipo;
  salvarConfig();
  aplicarAparencia();
  desenharTipos();
  agendarInicio();
  vibrar(10);
};
$('#cfgTema').onchange = (e) => { estado.config.tema = e.target.value; salvarConfig(); aplicarAparencia(); };
$('#cfgIdioma').onchange = (e) => {
  estado.config.idioma = e.target.value;
  salvarConfig();
  location.hash = '';
  location.reload();
};

function exportarBackup() {
  const dados = { ...estado.colecao, exportadoEm: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `colecao-pokemon-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  estado.config.ultimoBackup = new Date().toISOString();
  salvarConfig();
  avisar('Backup exportado! 💾');
  agendarInicio();
  if ($('#modalConfig').open) $('#txtUltimoBackup').textContent = `Último backup: ${dataBR(estado.config.ultimoBackup)}.`;
}
$('#btnExportar').onclick = exportarBackup;

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
    redesenharTudo();
    avisar('Coleção importada!');
  } catch {
    avisar('Arquivo inválido.');
  }
  e.target.value = '';
};

function redesenharTudo() {
  atualizarTotal();
  desenharSeries();
  if (estado.modo === 'inicio') desenharInicio();
  else {
    $$('#grade .carta').forEach(pintarCarta);
    aplicarFiltro();
    atualizarProgresso();
  }
}

$('#btnLimparCache').onclick = async () => {
  for (const chave of Object.keys(localStorage)) if (chave.startsWith('pokecolecao:catalogo:')) localStorage.removeItem(chave);
  await cache.limpar();
  location.reload();
};

// ---------- Comemoração ----------
function comemorar(msg) {
  avisar(msg, 4500);
  vibrar([40, 60, 40]);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const caixa = document.createElement('div');
  caixa.className = 'confete';
  const cores = ['#ee1515', '#ffcb05', '#3b6fd8', '#1f9d55', '#ff7043', '#a8307a', '#ffffff'];
  for (let i = 0; i < 70; i++) {
    const p = document.createElement('i');
    p.style.left = `${Math.random() * 100}%`;
    p.style.background = cores[i % cores.length];
    p.style.setProperty('--x', `${(Math.random() - 0.5) * 220}px`);
    p.style.setProperty('--r', `${Math.random() * 720 - 360}deg`);
    p.style.setProperty('--d', `${1.6 + Math.random() * 1.6}s`);
    p.style.animationDelay = `${Math.random() * 0.4}s`;
    caixa.appendChild(p);
  }
  document.body.appendChild(caixa);
  setTimeout(() => caixa.remove(), 4000);
}

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

// Procura o nome "escondido" no meio de outras letras: o OCR costuma grudar lixo antes e depois
// (ex: "priidVolcaroniilP"). Compara o nome com cada trecho do mesmo tamanho do texto sem espaços.
function semelhancaDentro(nome, textoJunto) {
  const alvo = normalizar(nome).replace(/ /g, '');
  if (alvo.length < 4 || textoJunto.length < alvo.length) return 0;
  if (textoJunto.includes(alvo)) return 0.95;
  let melhor = 0;
  for (let i = 0; i + alvo.length <= textoJunto.length && melhor < 0.9; i++) {
    melhor = Math.max(melhor, parecido(alvo, textoJunto.slice(i, i + alvo.length)));
  }
  return melhor * 0.95; // um pouco abaixo de achar a palavra certinha
}

// "025" -> "25", "tg05" -> "TG5", "SV-P 012" -> "SVP12"
function normalizarNumero(t) {
  const m = String(t ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').match(/^([A-Z]*)0*(\d+)$/);
  return m ? m[1] + m[2] : String(t ?? '').toUpperCase();
}

// Procura "025/198", "TG05/TG30", "GG01/GG70"… (o OCR às vezes troca "/" por "|", "l" ou "I")
function lerNumero(texto) {
  const t = texto.toUpperCase().replace(/[Oo](?=\d)|(?<=\d)[Oo]/g, '0');
  const achados = [];
  const re = /(?:^|[^A-Z0-9])([A-Z]{0,2}\d{1,3})\s*[\/|\\lI]\s*([A-Z]{0,2}\d{2,3})(?![0-9])/g;
  for (const m of t.matchAll(re)) {
    const lido = normalizarNumero(m[1]);
    const total = parseInt(m[2].replace(/^[A-Z]+/, ''), 10);
    const n = parseInt(lido.replace(/^[A-Z]+/, ''), 10);
    if (total >= 10 && total <= 400 && n >= 1 && (n <= total + 150)) achados.push({ numero: lido, total });
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

// Coleções físicas por total impresso (mais novas primeiro)
function setsPorTotal() {
  const porTotal = new Map();
  for (const s of estado.infoSets.values()) {
    const t = s.cardCount?.official;
    if (s.digital || !t) continue; // TCG Pocket não tem carta de papel
    if (!porTotal.has(t)) porTotal.set(t, []);
    porTotal.get(t).push(s.id);
  }
  return porTotal;
}

// Junta candidatas pelo número impresso e pelo nome, e dá uma nota para cada
async function acharCandidatas(leitura) {
  const porTotal = setsPorTotal();
  const palavrasTopo = normalizar(leitura.textoTopo).split(' ').filter(Boolean);
  const palavrasTudo = normalizar(leitura.textoTopo + ' ' + leitura.textoInteiro).split(' ').filter(Boolean);
  const candidatas = new Map();
  const add = (c) => { if (c?.id && !candidatas.has(c.id) && !estado.infoSets.get(setDaCarta(c.id))?.digital) candidatas.set(c.id, c); };

  // 1) Pelo número: coleções com esse total impresso, carta com esse número
  for (const { numero: lido, total } of leitura.numeros.slice(0, 3)) {
    for (const setId of (porTotal.get(total) ?? []).slice(0, 15)) {
      const set = await carregarSet(setId).catch(() => null);
      add(set?.cards?.find((c) => normalizarNumero(c.localId) === lido));
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
    const set = estado.infoSets.get(setDaCarta(c.id));
    const nome = Math.max(semelhancaNome(c.name, palavrasTopo), semelhancaNome(c.name, palavrasTudo) * 0.9);
    const num = leitura.numeros.find((n) => n.numero === normalizarNumero(c.localId));
    const bateNumero = !!num;
    const bateTotal = !!num && set?.cardCount?.official === num.total;
    return { carta: c, set, nome, bateNumero, bateTotal };
  });
  const calcularNota = (n) => { n.nota = n.nome * 0.5 + (n.bateNumero ? 0.3 : 0) + (n.bateTotal ? 0.2 : 0); };
  notas.forEach(calcularNota);
  // Em caso de empate, coleções mais novas primeiro
  const ordem = (n) => estado.ordemSet.get(setDaCarta(n.carta.id)) ?? 1e9;
  const ordenar = () => notas.sort((a, b) => b.nota - a.nota || ordem(a) - ordem(b));
  ordenar();
  // Segunda olhada, só nas melhores: o nome pode estar grudado em outras letras
  const juntoTopo = palavrasTopo.join(''), juntoTudo = palavrasTudo.join('');
  for (const n of notas.slice(0, 12)) {
    const dentro = Math.max(semelhancaDentro(n.carta.name, juntoTopo), semelhancaDentro(n.carta.name, juntoTudo) * 0.9);
    if (dentro > n.nome) { n.nome = dentro; calcularNota(n); }
  }
  ordenar();
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
  definirQtd(id, qtdDe(id) + 1, n.carta);
  estado.config.fotosReconhecidas = (estado.config.fotosReconhecidas || 0) + 1;
  salvarConfig();
  vibrar(20);
  corpo.innerHTML = '';
  const img = criarImagemCarta(n.carta);
  img.classList.add('foto-carta');
  const txt = document.createElement('div');
  txt.innerHTML = '<b class="ok">✓ Marcada!</b><p class="sub nome"></p><p class="sub qtd-txt"></p>';
  txt.querySelector('.nome').textContent = descreverCarta(n);
  txt.querySelector('.qtd-txt').textContent = `Agora você tem ${qtdDe(id)}.`;
  const desfazer = document.createElement('button');
  desfazer.textContent = '↶ Desfazer';
  desfazer.onclick = () => {
    definirQtd(id, qtdDe(id) - 1, n.carta);
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
    const leg = document.createElement('span');
    leg.textContent = `#${n.carta.localId} ${n.set?.name ?? ''}`;
    b.append(criarImagemCarta(n.carta), leg);
    b.onclick = () => marcarReconhecida(corpo, { ...n, todas: notas });
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
  filaFotos = filaFotos.then(() => { $('#fotoStatus').textContent = ''; });
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

function abrirFoto() {
  const m = $('#modalFoto');
  m.abertoEm = Date.now();
  if (!m.open) m.showModal();
  prepararOCR().catch(() => {}); // já vai baixando o leitor enquanto o Mestre tira a foto
}
['#arqFotoCamera', '#arqFotos'].forEach((sel) => {
  $(sel).onchange = (e) => { reconhecerFotos([...e.target.files]); e.target.value = ''; };
});

// ---------- Eventos gerais ----------
$('.marca').onclick = (e) => { e.preventDefault(); irPara(''); };
$('#btnFoto').onclick = abrirFoto;
$('#btnConfig').onclick = abrirConfig;

document.querySelectorAll('[data-fechar]').forEach((b) => (b.onclick = () => b.closest('dialog').close()));
// Toque no fundo escuro fecha (ignorando o "clique" que sobra ao soltar o dedo depois de segurar a carta)
document.querySelectorAll('dialog').forEach((d) => d.addEventListener('click', (e) => {
  if (e.target === d && Date.now() - (d.abertoEm ?? 0) > 400) d.close();
}));

$('.nav-inferior').onclick = (e) => {
  const b = e.target.closest('[data-nav]');
  if (!b) return;
  vibrar(8);
  const n = b.dataset.nav;
  if (n === 'inicio') irPara('');
  else if (n === 'colecoes') ($('#lateral').classList.contains('aberta') ? fecharMenu() : abrirMenu());
  else if (n === 'foto') abrirFoto();
  else if (n === 'busca') { if (estado.modo === 'busca') $('#buscaCarta').focus(); else irPara('#busca'); }
  else if (n === 'config') abrirConfig();
};

$('#telaInicio').addEventListener('click', (e) => {
  const alvo = e.target.closest('[data-set], [data-acao], [data-carta]');
  if (!alvo) return;
  if (alvo.dataset.set) irPara('#' + encodeURIComponent(alvo.dataset.set));
  else if (alvo.dataset.carta) {
    const r = recentes().find((x) => x.id === alvo.dataset.carta);
    if (r) abrirModalCarta(r);
  } else acao(alvo.dataset.acao);
});

$('#formBuscaInicio').onsubmit = (e) => {
  e.preventDefault();
  const termo = $('#buscaInicio').value.trim();
  if (termo.length < 2) { avisar('Digite pelo menos 2 letras, Mestre.'); return; }
  $('#buscaInicio').value = '';
  $('#buscaInicio').blur();
  irPara('#busca=' + encodeURIComponent(termo));
};

$('#listaSeries').onclick = (e) => {
  const b = e.target.closest('[data-set], [data-recarregar]');
  if (!b) return;
  if (b.dataset.set) irPara('#' + encodeURIComponent(b.dataset.set));
  else { $('#listaSeries').innerHTML = '<div class="esq-linha"></div><div class="esq-linha"></div><div class="esq-linha"></div>'; carregarSeries(); }
};
// No PC, passar o mouse numa coleção já começa a baixar as cartas dela
$('#listaSeries').addEventListener('pointerover', (e) => {
  if (e.pointerType !== 'mouse') return;
  const b = e.target.closest('[data-set]');
  if (!b || b.dataset.pre) return;
  b.dataset.pre = '1';
  setTimeout(() => { if (b.matches(':hover')) carregarSet(b.dataset.set).catch(() => {}); }, 120);
});

$$('.chips [data-fs]').forEach((b) => {
  b.onclick = () => {
    $$('.chips [data-fs]').forEach((x) => x.classList.toggle('ativo', x === b));
    estado.filtroSets = b.dataset.fs;
    desenharSeries();
  };
});
$('#buscaSet').oninput = desenharSeries;
$$('[data-fechar-menu]').forEach((b) => (b.onclick = fecharMenu));
$('#veu').onclick = fecharMenu;
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharMenu(); });
celular.addEventListener('change', () => { if (!celular.matches) { fecharMenu(); if (listaDesatualizada) desenharSeriesAgora(); } });

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

// Botão "voltar ao topo"
window.addEventListener('scroll', () => { $('#btnTopo').hidden = window.scrollY < 800; }, { passive: true });
$('#btnTopo').onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });

let tempoBusca;
$('#buscaCarta').oninput = (e) => {
  if (estado.modo === 'set') { aplicarFiltro(); return; }
  const termo = e.target.value.trim();
  clearTimeout(tempoBusca);
  if (termo.length >= 3) {
    tempoBusca = setTimeout(() => {
      history.replaceState(null, '', '#busca=' + encodeURIComponent(termo));
      abrirBusca(termo);
    }, 500);
  }
};
$('#buscaCarta').onkeydown = (e) => {
  const termo = e.target.value.trim();
  if (e.key !== 'Enter' || termo.length < 2) return;
  clearTimeout(tempoBusca);
  if (celular.matches) e.target.blur(); // fecha o teclado do celular
  if (estado.modo === 'busca') {
    history.replaceState(null, '', '#busca=' + encodeURIComponent(termo));
    abrirBusca(termo);
  } else {
    irPara('#busca=' + encodeURIComponent(termo));
  }
};

$$('.filtros button').forEach((b) => {
  b.onclick = () => {
    $$('.filtros button').forEach((x) => x.classList.toggle('ativo', x === b));
    estado.filtro = b.dataset.filtro;
    aplicarFiltro();
  };
});

window.addEventListener('hashchange', rota);

// ---------- Início ----------
aplicarAparencia();
carregarSeries(); // lista de coleções guardada: aparece já na primeira pintura (na 1ª visita, baixa em segundo plano)
$('#txtVersao').textContent = `PokéColeção v${VERSAO}`;
$('#txtVersaoRodape').textContent = `PokéColeção v${VERSAO}`;
atualizarTotal();
rota();           // abre a tela do link (início, coleção ou busca) sem esperar a lista de coleções
abrindo = false;
