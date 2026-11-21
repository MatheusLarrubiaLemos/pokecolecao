# PokéColeção TCG

Site simples para controlar a sua coleção de cartas Pokémon TCG.

- Mostra **todas as coleções e cartas** (com imagem) usando a API gratuita [TCGdex](https://tcgdex.dev), em português. Coleções antigas que ainda não têm cartas em português aparecem em inglês.
- **Toque na carta** para marcar que você tem (fica colorida com ✓). Toque de novo para desmarcar.
- Botão **i** na carta: imagem grande, quantidade (para repetidas), raridade, ilustrador, se vale em torneios e **preço de referência** (Cardmarket e TCGplayer).
- Filtros **Todas / Tenho / Faltam**, busca por nome ou número, progresso de cada coleção (com 🏆 e confete quando completa).
- A coleção fica salva **no seu navegador**. Use ⚙ → **Exportar** para fazer backup (.json) e **Importar** para levar para outro aparelho.

## Menu principal 🏠

- **Cartão de treinador** com seu nível (de Novato a Mestre Pokémon) e os números da coleção: cartas únicas, cópias, repetidas e coleções completas.
- Atalhos para escanear, ver coleções e fazer backup — e um lembrete quando faz tempo que você não faz backup.
- **Continuar colecionando**, **Quase completas**, **últimas cartas marcadas**, **insígnias** para conquistar e **lançamentos**.
- **Guia do colecionador**: como ler o número da carta, símbolos de raridade, sigla e marca de regulamento, como guardar e estado de conservação.

## Do seu jeito 🎨

- Em ⚙, escolha seu **tipo favorito** (Fogo, Água, Planta, Elétrico, Psíquico…) e o app muda de cor.
- Tema **claro, escuro ou automático**.

## Reconhecer por foto 📷

- Toque em **📷** (no celular, a Poké Ball **Escanear** da barra de baixo) e tire foto da carta (em pé, inteira, com boa luz) — ou escolha várias fotos de uma vez.
- Dá para fotografar **várias cartas de uma vez** (ex: uma página do fichário): o site acha cada carta sozinho, ou você escolha em "Cartas na foto" (1, 2, 2×2, 3×3).
- O site lê o nome e o número impresso (ex: `025/198`) e marca a carta sozinho. Se ficar em dúvida, mostra opções para você escolher; dá para desfazer.
- Tudo acontece no seu aparelho (a foto não é enviada a nenhum servidor). Na primeira vez baixa o leitor de texto (~5 MB).

## No celular

- A **barra de baixo** leva a tudo: Início, Coleções, Escanear, Buscar e Ajustes. O botão **voltar** do celular funciona.
- Em **Coleções** abre a lista (toque fora ou arraste para a esquerda para fechar). Os botões **Comecei** e **Completas** filtram a lista.
- **Toque** na carta para marcar/desmarcar; **segure o dedo** nela para ver detalhes, preço e quantidade.
- A busca e os filtros ficam presos no topo enquanto você rola; o botão **↑** volta ao início.
- Dá para **instalar como app**: no Android (Chrome) use ⋮ → *Adicionar à tela inicial*; no iPhone (Safari) use Compartilhar → *Adicionar à Tela de Início*.

Não precisa de servidor, banco de dados nem instalar nada: são só 3 arquivos principais (`index.html`, `style.css`, `app.js`), mais o `manifest.webmanifest`, a pasta `icones/` (instalar no celular) e a pasta `fontes/` (fonte Fredoka, licença livre OFL).

## Rápido

- A lista de coleções e as cartas já vistas ficam guardadas no aparelho: o site abre na hora e se atualiza sozinho em segundo plano.
- As imagens vêm direto do idioma em que existem (sem tentativas que dão erro) e as primeiras da tela chegam antes.

## Rodar no seu PC

Dê dois cliques no `index.html`. Pronto. (Aberto assim, o navegador não carrega a fonte arredondada; para ver igualzinho ao site publicado, rode `python3 -m http.server` na pasta e abra http://localhost:8000.)

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
