# Histórico de versões

A versão atual aparece em ⚙ Configurações, no rodapé.

## v1.5.0 — Modo escâner (21/11/2026)

- 🎥 **Modo escâner**: a câmera fica aberta e você vai passando as cartas na frente, uma por uma. Quando a carta fica parada dentro da moldura, ela é lida e marcada sozinha, com bipe e vibração. Ideal para dezenas de cartas.
- Não marca a mesma carta duas vezes enquanto ela continua na frente da câmera; passar uma cópia repetida depois conta +1.
- Na dúvida, mostra as opções na própria tela. Tem desfazer, contador de cartas e lanterna 💡 (se o celular tiver).

## v1.4.0 — Várias cartas numa foto só (21/11/2026)

- 📷 agora reconhece **várias cartas na mesma foto**, como uma página inteira do fichário: o site acha o número impresso de cada carta, descobre a grade (2×2, 3×3…) e lê uma por uma.
- Escolha **"Cartas na foto"**: Auto (descobre sozinho), 1, 2, 4 (2×2) ou 9 (3×3), caso o automático erre.
- Cada carta da foto ganha sua própria linha com a miniatura daquele pedaço, e a foto mostra um resumo (marcadas, para confirmar, sem reconhecer).
- Corrigida a imagem da carta reconhecida que aparecia esticada.

## v1.3.0 — Mais rápido, visual temático e menu principal (20/11/2026)

**Mais rápido**
- A lista de coleções fica guardada no aparelho e aparece já na primeira tela (2× mais rápido ao voltar ao site). O catálogo se atualiza sozinho em segundo plano, sem fazer o Mestre esperar.
- Cartas sem imagem em português vão direto na imagem em inglês. Antes o site tentava a portuguesa, dava erro e só depois buscava a inglesa: nessas coleções as cartas aparecem até 6× mais rápido.
- Acabaram os ~100 pedidos de símbolos de coleção que não existem mais no servidor.
- Filtros (Todas/Tenho/Faltam) e a busca dentro da coleção ficaram instantâneos: a grade não é mais remontada.
- As primeiras cartas da tela carregam com prioridade e aparecem esqueletos animados enquanto carrega.
- Abrir um link direto de coleção não espera mais a lista inteira.

**Visual temático**
- Topo estilo Poké Ball, fonte arredondada (Fredoka), fundo com Poké Balls, anéis de progresso em cada coleção, brilho holográfico nas cartas que você tem (no PC) e confete ao completar uma coleção.
- **Tipo favorito** em ⚙: Fogo, Água, Planta, Elétrico, Psíquico… o app muda de cor.
- Tema claro, escuro ou automático.
- No celular: barra de navegação embaixo (Início, Coleções, Escanear, Buscar, Ajustes) e o botão voltar do celular funciona.

**Menu principal**
- Cartão de treinador com nível (de Novato a Mestre Pokémon), cartas únicas, cópias, repetidas e coleções completas.
- Atalhos, lembrete de backup, Continuar colecionando, Quase completas, últimas cartas marcadas, 9 insígnias e lançamentos.
- Guia do colecionador: número da carta, raridades, sigla e marca de regulamento, como guardar e estado de conservação.
- Janela da carta com raridade, tipo, PS, ilustrador, marca de regulamento, se vale em torneios e **preço de referência** (Cardmarket e TCGplayer).

**Catálogo**
- Coleções antigas sem cartas em português no catálogo (Coleção Básica, EX, DP, HGSS…) agora aparecem em inglês, em vez de vazias.
- Coleções do TCG Pocket (digitais) foram para o fim da lista, marcadas como "digital".
- Busca mostra a coleção de cada carta, com as mais novas primeiro.
- 📷: reconhece o nome mesmo quando a leitura vem "grudada" em outras letras.

A coleção e o formato do backup continuam iguais.

## v1.2.0 — Reconhecer cartas por foto (20/11/2026)

- Botão **📷** no topo: tire foto da carta (ou escolha várias fotos da galeria) e eu **reconheço e marco sozinho**.
- Lê o **nome** e o **número impresso** (ex: `025/198`, `TG05/TG30`) direto no navegador, sem enviar a foto para lugar nenhum.
- Quando tem certeza, marca (+1 na quantidade) com botão **↶ Desfazer**; quando fica em dúvida, mostra as cartas parecidas para o Mestre escolher.
- Opção "Marcar sozinho quando tiver certeza" pode ser desligada para sempre confirmar.
- O leitor de texto (~5 MB) só é baixado na primeira vez que a câmera é usada.

## v1.1.0 — Versão para celular (12/11/2026)

- **Gaveta de coleções:** o ☰ abre a lista com fundo escurecido; toque fora ou arraste para a esquerda para fechar.
- **Busca e filtros fixos** no topo enquanto rola a página, com botões maiores.
- **3 cartas por linha** no celular (2 em telas bem pequenas).
- **Segurar o dedo na carta** abre a imagem grande e a quantidade; o botão "i" ficou maior.
- Janelas de detalhes e configurações **sobem de baixo** da tela.
- **Vibração leve** ao marcar uma carta (Android).
- Botão **↑** para voltar ao topo.
- Sem zoom automático no iPhone ao tocar na busca; respeita o notch e a barra de gestos.
- **Instalar como app** na tela inicial (manifesto + ícones).
- Número da versão exibido em ⚙ Configurações.

## v1.0.0 — Primeira versão

- Catálogo de coleções e cartas pela API TCGdex, em português.
- Marcar/desmarcar cartas, quantidade, filtros Todas/Tenho/Faltam e busca.
- Progresso por coleção, backup em JSON (exportar/importar).
