# Histórico de versões

A versão atual aparece em ⚙ Configurações, no rodapé.

## v1.13.0 — Promos MEP, energias e mais 650 cartas no reconhecimento (28/11/2026)

- **653 cartas novas no banco de desenhos**: o TCGdex não tem imagem delas, então o escâner não as reconhecia. Agora as imagens vêm do pokemontcg.io e do Limitless. Entraram:
  - as promos MEP (como o Mega Dragonite ex 091 e o Slowpoke 086);
  - as energias básicas das coleções de energia SV e ME;
  - as promos SVP, SWSH e SM;
  - o Cofre Brilhante, a Galeria do Treinador, a Galeria Galar e as Lendas Brilhantes/Majestade dos Dragões.

  No teste com as fotos do Mestre, o Dragonite e o Slowpoke passaram a ser marcados com certeza. Na página de energias, as cartas erradas (um Electrode e uma Melony no lugar de energias) sumiram.
- **Cartas que faltam no catálogo em português**: das 112 promos MEP, o TCGdex só tem 80 em português. As outras agora aparecem na coleção com o nome em inglês e podem ser marcadas.
- Gerador do banco (`ferramentas/gerar-assinaturas.js`):
  - busca imagens de outras fontes para as cartas que o TCGdex não tem;
  - ganhou `--so-faltando`, que só acrescenta o que falta no banco;
  - tenta de novo quando a API falha, para nenhuma coleção sumir do banco.

## v1.12.0 — Escâner: carta solta depois da página (28/11/2026)

- **Carta solta depois de uma página**: chegando devagar da página do fichário para uma carta só, o escâner não percebia a troca. Ficava preso na página anterior, mostrando os 9 espaços dela, e nunca lia a carta nova. Agora ele compara a imagem parada com a da última leitura e, se a cena mudou, lê de novo do zero.
- **Nome confirma o desenho**: com a foto inclinada ou com reflexo no bolso, o desenho às vezes põe a carta certa em 1º lugar, mas sem folga, e ela ficava em "?". Agora, se o nome lido na carta for o dessa 1ª carta (e não o de outra parecida), ela é marcada. O número pequeno o leitor quase nunca consegue ler na foto; o nome, sim. Exemplo: Milcery 043/094 de Fogo Fantasmagórico.
- Carta "para confirmar" lida de novo não aparece mais como "Não reconheci".
- **Página mais rápida**: na página, o leitor de texto só roda nas cartas em que o desenho chegou perto. Nas outras ele não ajudava e era o que deixava o "Lendo a carta 1 de 9…" demorado.

## v1.11.1 — Imagens que voltam sozinhas (28/11/2026)

- **Servidor de imagens fora do ar**: quando o servidor de imagens do TCGdex cai (a API continua no ar), as cartas aparecem como o verso azul com o nome e o número. Agora o site avisa que é o servidor, e as cartas continuam sendo marcadas normalmente.
- **As imagens voltam sozinhas**: o site tenta de novo de tempos em tempos (e quando a internet ou a aba voltam). Quando o servidor responde, as imagens entram no lugar do verso sem recarregar a página, e aparece o aviso "as imagens das cartas voltaram".
- Os avisos agora aparecem também por cima do escâner e das outras janelas, e usam a largura da tela em vez de ficarem espremidos.

## v1.11.0 — Cartas gêmeas e carta de perto (24/11/2026)

- **Cartas com o mesmo desenho** (reimpressões em outra coleção, como o Gastly e o Haunter de Fogo Fantasmagórico e de Heróis Excelsos). Antes o site via o empate e não dizia nada. Agora ele reconhece o desenho e escolhe a versão:
  - pelo número impresso;
  - ou pelas outras cartas: as da mesma foto e as que você já tem.

  Se não der para saber, a carta aparece em amarelo com as versões, para você tocar na certa. Cerca de 360 cartas do banco têm uma gêmea assim.
- **Carta de perto conta como uma só**: quando a carta enche a câmera, o site não divide mais em várias, nem sugere cartas que não são. O guia inteiro fica verde (ou amarelo) como um espaço só.
- **Página só vale com pelo menos 2 cartas confirmadas** (ou versos). Se só uma bate, fica só ela, sem "3 não reconheci" inventados.
- Mais rápido quando precisa ler o número da carta: a busca pelo desenho não é refeita.

## v1.10.0 — Câmera sem zoom e guia de enquadramento (23/11/2026)

- **Sem o zoom**: a câmera mostra a imagem inteira, no formato 4:3 do sensor. Antes as bordas eram cortadas e parecia zoom. O site também pede o zoom mínimo e o foco automático contínuo quando o celular deixa.
- **Guia de enquadramento**: 9 espaços desenhados por cima da câmera, no formato de uma página de fichário. Carta solta vai no espaço do meio; página inteira, encaixe nos 9. Depois da leitura, cada espaço fica:
  - **verde**: carta marcada;
  - **amarelo**: carta para confirmar;
  - **cinza**: carta virada (verso).
- **🔄 Ler de novo** foi para baixo, à esquerda, logo acima do painel das cartas, onde o polegar alcança.
- **Não inventa carta**: o palpite só aparece se o desenho for bem parecido **e** ficar na frente das outras opções, ou se o número impresso confirmar. Se não achar nada parecido, não sugere nada.
- **Verso** reconhecido também numa carta solta na frente da câmera, com o aviso "vire a carta".
- **Lê de novo sozinho**: se sobrou carta sem reconhecer e a imagem continua parada, o escâner tenta mais até 2 vezes e junta o que achou. O aviso conta a página inteira, por exemplo "✓ 6 novas · 3 viradas".
- A mesma carta lida de novo não repete no painel.
- O celular baixa o código novo assim que sai versão nova, sem ficar preso na antiga.

## v1.9.1 — Não inventa carta (23/11/2026)

- **Carta virada (verso azul com a Poké Ball)** é reconhecida e pulada, em vez de virar um palpite errado.
- Palpite fraco não aparece em lugar nenhum (câmera e galeria); o aviso diz quantas cartas ficaram sem reconhecer ("2 não reconheci — passe uma por uma").
- Páginas com menos de 9 cartas (ou com cartas viradas) funcionam: a carta de partida é procurada na foto toda, não só no centro.

## v1.9.0 — Escâner mais esperto (23/11/2026)

- As cartas escaneadas **não somem mais**: o painel de baixo acumula tudo o que foi lido na sessão (as mais novas primeiro).
- Botão **✕ Nenhuma** nas opções: tira da lista a carta errada (e desmarca, se tinha marcado).
- Botão **🔄 Ler de novo** no topo da câmera.
- **Detector de foco**: com a imagem tremida ou desfocada, o escâner pede para segurar firme / afastar, em vez de ler errado.
- Uma carta por vez é o normal: só lê várias quando há várias cartas juntas na frente da câmera (régua mais exigente para achar página).
- Ao vivo, palpite fraco não aparece mais (pede para enquadrar de novo).

## v1.8.0 — Um botão só: Escanear (23/11/2026)

- **Escanear** abre direto a câmera — sem janela intermediária, sem escolher modo. Aponte para uma carta solta ou para uma página inteira do fichário: o site descobre sozinho o que é e lê tudo o que aparece.
- Dentro da câmera tem **🖼 Galeria** para mandar fotos (uma ou várias de uma vez), com o mesmo reconhecimento.
- Saíram os botões "1 carta" / "Página 3×3" e a janela de fotos. A opção "Marcar sozinho quando tiver certeza" foi para ⚙.
- Toque numa carta do painel para escolher outra ou desfazer.
- Mais rápido: carta solta na câmera em ~1 s.

## v1.7.0 — Reconhece pelo desenho da carta (23/11/2026)

- 📷 e 🎥 agora reconhecem as cartas **pelo desenho**, como os apps de escâner de verdade: o site compara a arte da carta com um banco de "impressões digitais" de todas as ~15.600 cartas físicas (`dados/assinaturas.txt`, baixado só quando o reconhecimento é usado). A leitura do número entra só para desempatar.
- Funciona até com **cartas em japonês**, quando a arte é a mesma da versão internacional.
- **Foto de página do fichário**: o site acha uma carta, anda pelos bolsos vizinhos (corrigindo a perspectiva) e descobre sozinho se é 1 carta, 2×2 ou 3×3 — sem escolher nada. Na foto real de teste: 7 de 9 marcadas sozinhas, nenhuma errada.
- 🎥 Escâner ganhou o modo **📄 Página 3×3**: uma moldura com 9 bolsos para encaixar a página do fichário; lê as 9 de uma vez e você vira a página.
- Saiu a opção "Cartas na foto": agora é tudo automático.
- Ferramenta `ferramentas/gerar-assinaturas.js` para atualizar o banco quando sair coleção nova.

## v1.6.0 — Reconhecer não conta repetidas (21/11/2026)

- 📷 e 🎥: se a carta reconhecida já está na coleção, só avisa "👍 Você já tem esta" (bipe mais grave) e não aumenta a quantidade.
- O contador do escâner mostra só as cartas **novas**.
- A quantidade de repetidas continua podendo ser ajustada no "i" de cada carta.

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
