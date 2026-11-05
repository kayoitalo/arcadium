# Interface como caderno de escuta — revisão do PR 17

Pedido de 03/11/2026: tornar o amigo mais presente, compor as telas com mais personalidade e interação e separar opções da Descoberta. As dicas enviadas são referência; as menções a jogos, bibliotecas adicionais, cursores e efeitos contínuos não viraram requisitos do Arcadium.

## Direção aplicada

- **A caneta é o personagem:** o proprietário corrigiu a interpretação literal; rosto/fones foram retirados de todas as telas. Reutiliza-se a caneta original da Conversa, com gestos contextuais, sem animação decorativa contínua. A escolha explícita do retrato é o **Cartaz do artista**; ver [composição, identidade e limites das fotos](magic-pen-artist-poster.md).
- **Retrato como cartaz:** índice horizontal de artistas, foto com crédito quando identificada, nome grande e dados observados. A caneta grifa o nome, contorna a imagem carregada e circula um dado das escutas. Alternância local entre histórico acumulado e dois períodos recentes; valores e escala permanecem observados. Seleção/período não repetem a leitura do retrato ou geram IA; só o nome selecionado pode consultar a fonte visual, com cache. No celular, escolher leva ao detalhe e há volta ao índice. Sem foto, a composição segue tipográfica.
- **Memória como fio:** sessões em capítulos visuais, datas, uma linha de continuidade e comentários/revisões como anotações dentro do caminho. Numeração visual é relativa à página, não posição absoluta no histórico. Recortes e significados dos eventos permanecem explícitos.
- **Álbuns como estante:** rótulos tipográficos locais, sem fingir capas oficiais. A arte do catálogo aparece quando uma versão é confirmada na consulta. Seis discos por vez, expandindo localmente até o limite já recebido; busca continua limitada a vinte resultados e não há consulta externa por miniatura.
- **Conversa:** apresentação do amigo, índice de assuntos e contraste do rodapé de respostas. A fala, os dados e os controles mantêm seus papéis; não são inventadas observações para preencher a composição.

## Quatro áreas

O menu principal passa a chamar a área de **Descobrir**. Dentro dela:

| Aba | Função |
| --- | --- |
| Descobrir | Intenção, faixa atual, resposta e ajustes opcionais. |
| Álbuns | Escolher um disco e confirmar a versão para percorrer. |
| Para depois | Coleção da conta, importação local explícita, remoção e exportação. |
| Caminhos | Diário paginado, retomada/revisão, cópias e gestão da memória. |

A coleção/exportação foram extraídas da escuta. A sessão mantém cursor e respostas no servidor; o provider da coleção continua acima das páginas. O link antigo `?collection=1` redireciona à aba própria. O painel curto de histórico deixa de repetir na escuta o conteúdo acessível em Caminhos; o serviço e os contratos antigos continuam disponíveis.

Navegação principal/abas têm indicador que acompanha a escolha. Troca de página usa entrada curta; não retém duas sessões de áudio ao mesmo tempo para animar a saída. Templates do App Router mantêm a navegação correspondente e remontam o conteúdo. Sem movimento reduzido: aproximadamente 180–240 ms; com a preferência ativa, conteúdo entra diretamente e o indicador não viaja. Teclado e toque usam os mesmos links/botões nativos. Atalhos de avaliação não interceptam controles ou links com foco.

## Correção do álbum

Antes, “ver edições” montava o resultado depois da lista inteira e focava com `preventScroll`. Em uma biblioteca longa, consulta/erro/resultados ficavam fora da vista. Isso explica o comportamento de aparente inação da interface; não certifica a disponibilidade de cada álbum no provedor.

Agora **ouvir este álbum** abre a consulta junto ao disco escolhido, traz o título das opções à vista e anuncia o carregamento. O texto explica que “versão” pode significar estúdio, ao vivo ou faixas extras. **Começar com esta versão** continua exigindo escolha explícita. Fechar devolve o foco ao botão de origem. Lacuna, erro, retry e confirmação ficam no mesmo local, preservando a seleção e os limites anteriores.

## Revisão executada

Componentes/CSS/fontes reais em Chrome headless, dados e áudio fictícios. Configurações: 1280 px, 1920 px, 390 px e 390 px com movimento reduzido. Os quatro runners existentes verificam navegação/coleção/exportação, álbum, memória e retrato/conversa. A amostra de álbum contém vinte referências para reproduzir o caso da lista longa; o retrato possui mais de um artista e comparação com zero no período anterior.

Após a primeira renderização foram corrigidos: estreitamento excessivo da fala lateral na Descoberta, estante longa demais no celular e viagem do traço através de outros trechos do retrato. O traço original agora mede também nome, imagem e dados do cartaz; a mesma caneta reage à pergunta de versão e ao capítulo aberto no diário. Capturas ficam no diretório de avaliação ignorado, junto dos relatórios.

Verificações funcionais incluem ausência de releitura do retrato ao trocar artista e de chamadas extras ao mostrar mais discos; painel de versão no próprio item e visível; nenhum autoplay ao trocar de área; importação parcial e remoção independentes; exportação repetida protegida, modal/foco e navegação inerte enquanto aberto. A revisão ampliada passou 550 testes em 102 arquivos, tipos/build e os quatro runners headless (3 grupos de retrato, além dos demais). Mocks não substituem avaliação da navegação autenticada e dos dados reais na preview.

## Revisão do proprietário

Conferir nas quatro áreas a presença/personagem, ritmo de leitura e legibilidade, inclusive em tela larga. Escolher um artista no retrato e alternar as perspectivas; abrir versões de um disco no início/meio da estante; guardar uma faixa, ir a Para depois e retornar à escuta. Repetir teclado, mobile e movimento reduzido. Aceitação visual ainda depende do retorno do proprietário.

Sem novas dependências, migrations adicionais, chamadas de IA, fontes de afinidade, infraestrutura ou mudança no ranking/ListenBrainz. Fotos reutilizam Spotify e Last.fm já integrados, com Spotify pelo perfil do artista (faixa só para desempatar homônimos) e Last.fm por nome/perfil, fontes e limites documentados; Wikidata/Commons foram retirados por orientação do proprietário. Cotas musicais existentes permanecem, com cooldown 429 Spotify compartilhado por processo.

A revisão posterior mantém assuntos vistos na abertura da Conversa e distingue ausência/configuração/placeholder nas fotos; sem foto, não há quadro vazio. Ver [correção e fontes documentadas](conversation-visible-artist-sources.md).
