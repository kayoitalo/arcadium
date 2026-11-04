# A caneta é o personagem — cartaz do artista

Revisão de 03/11/2026 no PR 17. O proprietário esclareceu que a presença do amigo é a **caneta mágica**, como na Conversa: ela viaja, grifa, circula e reage ao conteúdo. A figura literal com rosto/fones foi retirada de todas as telas. A composição escolhida explicitamente para o retrato foi **Cartaz do artista**: foto em destaque, nome grande e a caneta conectando imagem e escutas.

## Composição e gestos

- Índice horizontal de nomes, cartaz com foto e tipografia grande, números observados ao lado. No celular, nome, foto e dados se reorganizam, com retorno ao índice.
- O mesmo `usePen`/`Trace` da Conversa mede o texto e as caixas reais: grifa o nome escolhido, contorna a área da foto depois do carregamento e circula dias distintos ou reproduções recentes. Troca de artista/perspectiva refaz os alvos. Nenhuma linha amarela de CSS simula a caneta.
- A caneta também grifa a pergunta de versão ao abrir um disco e circula o título do capítulo aberto no diário. Cada página usa uma camada de caneta; não há rosto, cursor substituto, partículas ou mascote em loop.
- Movimento reduzido preserva as marcas e os controles sem viagem animada. Imagem não recebe filtros, recorte ou transformação; mantém proporção dentro do cartaz.
- Foto ausente deixa uma composição tipográfica. Falha temporária oferece nova tentativa; nenhuma delas impede escolher outro nome, ler os números ou seguir para o histórico.

## Fotografias e identidade

A nova integração é **visual**, separada das fontes de afinidade e do ranking. Não usa Spotify, chave nova, assinatura ou IA; não cria migration. A consulta começa somente para o artista selecionado, com debounce de 300 ms e cancelamento da requisição antiga no navegador. Cancelar no navegador não desfaz uma consulta já iniciada no servidor.

`POST /api/artist-portrait` exige autenticação/origem e um nome presente no histórico da conta. O serviço usa apenas o MBID já associado a um artista `RESOLVED`, com nome compatível. Sem identidade segura, retorna lacuna; não procura foto por texto nem chama MusicBrainz para completar o identificador. O endpoint não recebe URL, MBID ou usuário arbitrário do cliente e não grava no banco.

Até **três requisições sequenciais de metadados** por MBID sem cache:

1. Busca exata de identificador externo no Wikidata (`P434`), limitada a duas entidades.
2. Leitura dos claims: verifica o MBID independentemente da busca, recusa ambiguidades e escolhe o `P18` não obsoleto, preferencial quando informado.
3. Commons `imageinfo`: pede miniatura de 720 px e obtém autor, licença e página do arquivo. O provedor pode devolver um tamanho padronizado maior.

Uma busca ativa por processo, espaçamento mínimo de 1.100 ms entre chamadas, timeout de 6 s por chamada, `maxlag=5`, User-Agent identificado e sem retry automático. Requisições simultâneas do mesmo MBID compartilham o trabalho; outro MBID enquanto ocupado recebe falha temporária. HTTP 429 com `Retry-After` em segundos suspende consultas novas pelo intervalo recebido (mínimo de 30 s); sem valor válido, usa 60 s. Esses controles são locais ao processo, sem coordenação distribuída.

Cache público de até 64 MBIDs: foto 24 h, lacuna 1 h e falha 30 s. No navegador, até 32 resultados durante a montagem da página. Nenhum enriquecimento em lote, polling ou busca antecipada de toda a lista. O proxy da imagem é uma requisição adicional aos metadados, com cache HTTP existente de uma semana.

São aceitos somente JPEG/PNG/WebP nos hosts exatos `upload.wikimedia.org` e `thumb.wikimedia.org`, em `/wikipedia/commons/`, sem redirects. Página de origem precisa ser um arquivo do Commons; licença deve ser CC BY, CC BY-SA, CC0 ou domínio público identificado. Sem autor/licença/origem válidos, a imagem não aparece. Créditos são texto escapado com links visíveis à licença, Commons e identidade no Wikidata; HTML do provedor não é renderizado. O proxy recusa MIME ausente ou ativo.

Foto associada a uma entidade não significa foto atual ou garantia de cobertura para todo artista. Número de reproduções, dias e janelas continuam vindo do retrato observado; os metadados visuais não entram em prompts ou recomendações.

Fontes técnicas: [acesso ao Wikidata](https://www.wikidata.org/wiki/Wikidata:Data_access), [propriedade de imagem P18](https://www.wikidata.org/wiki/Property:P18), [API do Commons](https://commons.wikimedia.org/wiki/Commons:API/MediaWiki) e [Imageinfo](https://www.mediawiki.org/wiki/API:Imageinfo).

## Verificação e revisão

Uma sondagem pública do adaptador confirmou a identidade de Linkin Park e retornou [foto de James Minchin III, CC BY-SA 4.0](https://commons.wikimedia.org/wiki/File:Linkin_Park_-_From_Zero_Lead_Press_Photo_-_James_Minchin_III.jpg). Foram nove chamadas de metadados em três diagnósticos deliberados, usados para corrigir o host atual de miniaturas, e um HEAD que confirmou JPEG/200 sem redirect. Não foi acessado banco real nem importado histórico; isso valida o caminho público de uma banda, sem medir cobertura representativa.

Testes automatizados verificam identidade/propriedade, ambiguidade, crédito, cache/singleflight, limite de consultas, 429 e proxy fechado. Chrome headless usa componentes/fontes reais com nomes, estatísticas e imagem explicitamente sintéticos: verifica os alvos da caneta, atribuição, troca de artista, estados de foto, janelas, teclado, largura e movimento reduzido. Não usa foto inventada de artista real nem substitui aceitação visual na preview.

Na preview: abrir **teu retrato**, escolher nomes e perspectivas, conferir os dados conhecidos e o histórico filtrado. Quando houver foto, conferir artista/créditos e a viagem da caneta; quando faltar, conferir o cartaz tipográfico. Abrir/fechar versões em Álbuns e capítulos em Caminhos. Repetir no celular e com movimento reduzido, observando se os gestos ajudam a leitura sem disputar com o conteúdo.
