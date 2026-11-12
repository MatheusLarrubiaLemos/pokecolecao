# Contexto para o Claude Code

Projeto: PokéColeção TCG — site estático (sem build) para marcar cartas Pokémon TCG que o usuário possui. Publicado no GitHub Pages.

- `index.html`, `style.css`, `app.js` — JavaScript puro, sem frameworks, sem npm. Manter assim (simples de publicar).
- Catálogo: API TCGdex `https://api.tcgdex.net/v2/{idioma}` (`/series`, `/series/{id}`, `/sets/{id}`, `/cards?name=`). Idioma padrão `pt`, com fallback de imagem para `en`.
- Imagens: `{card.image}/low.webp` (grade) e `/high.webp` (modal).
- Coleção: `localStorage['pokecolecao:colecao']` = `{ versao: 1, cartas: { [idCarta]: { qtd, set } } }`. Exportar/importar em JSON.
- Cache do catálogo em IndexedDB (`pokecolecao-cache`), validade 7 dias.
- Textos da interface e nomes de variáveis em português. O usuário é chamado de "Mestre".
- Depois de mudar algo, abra o `index.html` no navegador para testar e faça commit + push para atualizar o site.
