# Contexto para o Claude Code

Projeto: PokéColeção TCG — site estático (sem build) para marcar cartas Pokémon TCG que o usuário possui. Publicado no GitHub Pages.

- `index.html`, `style.css`, `app.js` — JavaScript puro, sem frameworks, sem npm. Manter assim (simples de publicar). `fontes/fredoka.woff2` (licença OFL em `fontes/OFL.txt`).
- Catálogo: API TCGdex `https://api.tcgdex.net/v2/{idioma}` (`/series`, `/series/{id}`, `/sets/{id}`, `/cards/{id}`, `/cards?name=`). Idioma padrão `pt`. O que falta em `pt` vem do catálogo `en` (mesmos IDs): coleções vazias em pt (antigas e TCG Pocket) e imagens que só existem em inglês (`carregarSet`). Série `tcgp` = TCG Pocket (digital): fica no fim da lista e fora do 📷.
- Imagens: `{card.image}/low.webp` (grade) e `/high.webp` (modal).
- Coleção: `localStorage['pokecolecao:colecao']` = `{ versao: 1, cartas: { [idCarta]: { qtd, set } } }`. Exportar/importar em JSON.
- Cache: lista de coleções num pacote só em `localStorage['pokecolecao:catalogo:{idioma}']` (abre na hora); demais respostas da API em IndexedDB (`pokecolecao-cache`). Os dois respondem com o que está salvo e, depois de `CACHE_DIAS` (3), atualizam em segundo plano.
- Outras chaves: `pokecolecao:config` (idioma, tema, tipo, ultimoBackup, fotosReconhecidas), `pokecolecao:recentes` (últimas cartas marcadas), `pokecolecao:setsRecentes`.
- Rotas pelo hash: vazio = menu principal, `#<idDaColeção>` = coleção, `#busca=<termo>` = busca.
- Não pedir `symbol` das coleções: as URLs `univ/.../symbol` dão 404 no TCGdex.
- Reconhecimento (📷/🎥): pelo **desenho** (hash perceptual pHash+dHash da janela da arte, `assinaturaArte` + `AREA_ARTE`) comparado com `dados/assinaturas.txt` (uma linha por carta: `id hash128hex`). OCR (Tesseract) só desempata. Régua: `DESENHO_CERTO`/`DESENHO_FOLGA`. Página de fichário: `acharPagina3x3` acha uma carta e anda pelos vizinhos. Ao mudar `assinaturaArte` ou `AREA_ARTE`, ou quando sair coleção nova, regenere o banco com `node ferramentas/gerar-assinaturas.js` (Playwright).
- Textos da interface e nomes de variáveis em português. O usuário é chamado de "Mestre".
- Versão: constante `VERSAO` no `app.js` (aparece em ⚙). A cada mudança, suba a versão (semver) e registre no `CHANGELOG.md`, em português. Títulos de PR e commits em português, com a versão (ex: "v1.2.0 — …").
- Depois de mudar algo, abra o `index.html` no navegador para testar e faça commit + push para atualizar o site. Para ver com a fonte, sirva por HTTP (`python3 -m http.server`): em `file://` o navegador bloqueia a fonte.
