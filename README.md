# PokéColeção TCG

Site simples para controlar a sua coleção de cartas Pokémon TCG.

- Mostra **todas as coleções e cartas** (com imagem) usando a API gratuita [TCGdex](https://tcgdex.dev), em português.
- **Toque na carta** para marcar que você tem (fica colorida com ✓). Toque de novo para desmarcar.
- Botão **i** na carta: imagem grande + quantidade (para cartas repetidas).
- Filtros **Todas / Tenho / Faltam**, busca por nome, progresso de cada coleção.
- A coleção fica salva **no seu navegador**. Use ⚙ → **Exportar** para fazer backup (.json) e **Importar** para levar para outro aparelho.

Não precisa de servidor, banco de dados nem instalar nada: são só 3 arquivos (`index.html`, `style.css`, `app.js`).

## Rodar no seu PC

Dê dois cliques no `index.html`. Pronto.

## Publicar no GitHub Pages

1. Crie um repositório em https://github.com/new (ex: `pokecolecao`, público).
2. Envie os arquivos (veja o passo a passo no chat ou use os comandos abaixo dentro da pasta):
   ```
   git init
   git add .
   git commit -m "Primeira versão da PokéColeção"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/pokecolecao.git
   git push -u origin main
   ```
3. No GitHub: **Settings → Pages → Source: Deploy from a branch → Branch: main / (root) → Save**.
4. Em 1–2 minutos o site estará em `https://SEU-USUARIO.github.io/pokecolecao/`.

## Formato do backup

```json
{
  "versao": 1,
  "cartas": {
    "sv01-001": { "qtd": 1, "set": "sv01" },
    "sv01-025": { "qtd": 3, "set": "sv01" }
  }
}
```

O ID da carta é o mesmo da TCGdex (`<coleção>-<número>`).

Dados e imagens das cartas: TCGdex. Pokémon e seus nomes são marcas da Nintendo / The Pokémon Company. Projeto de fã, sem fins comerciais.
