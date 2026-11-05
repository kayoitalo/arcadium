# Conversa visível e imagens nas fontes existentes

Revisão solicitada em 04/11/2026 no PR 17. O proprietário rejeitou abrir a Conversa sem assuntos já disponíveis e relatou novamente o cartaz sem fotografia. Não adicionar outra API para resolver cobertura.

## Conversa

A causa era o filtro editorial: um assunto visto nos últimos 72 h saía da resposta inicial. Quando todos estavam vistos, a página exigia “rever as leituras”. Agora os assuntos vistos **continuam visíveis** ao abrir/reabrir. O intervalo de 72 h apenas prioriza os não vistos/recentemente não apresentados; a ordem de origem é preservada dentro de cada grupo. Não gera leitura/IA adicional para preencher a página.

Silêncio explícito continua respeitado, com restauração no Retrato. O estado vazio reservado a todos os assuntos silenciados explica essa escolha; ausência de histórico ou prova continua com os estados próprios. Dedupe de assunto, versão dos recibos e prova factual permanecem.

## O que a documentação permite

| API já usada | Perfil / imagem | Decisão |
| --- | --- | --- |
| Last.fm | [artist.getInfo](https://www.last.fm/api/show/artist.getInfo) documenta nome, MBID, URL, biografia e imagens. [artist.search](https://www.last.fm/api/show/artist.search) também documenta busca de artistas e imagem. | Alternativa integrada com getInfo exato, sem autocorreção. A documentação não garante cobertura atual; vazio/placeholder não vira foto. |
| Spotify | [Get Artist](https://developer.spotify.com/documentation/web-api/reference/get-an-artist) tem imagens, mas depende da configuração e disponibilidade do app. | Continua como primeira tentativa; lacuna/falha pode recorrer ao Last.fm. Ambiguidade de identidade não é substituída silenciosamente por match só de nome. |
| iTunes Search | [musicArtist](https://performance-partners.apple.com/search-api) permite buscar artista, mas a [documentação de artwork](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/UnderstandingSearchResults.html) não estabelece uma foto de perfil de artista. | Não usar capa de álbum como retrato. Não confundir iTunes Search com outra API do Apple Music. |
| MusicBrainz | [Relação image](https://musicbrainz.org/relationship/221132e9-e30e-43f2-a741-15afc4c5fa7c) aponta arquivos em hosts externos. | Metadados/relações não são um catálogo próprio de fotos; não liberar novos hosts ou seguir sites externos. |
| Cover Art Archive | [API](https://musicbrainz.org/doc/Cover_Art_Archive/API) trabalha com capas por release/release-group. | Não atende a foto de perfil. |

Comparação documental, sem medição de cobertura dos artistas da conta. As capturas mostram ausência de imagem; não comprovam sozinhas se a causa foi configuração, match ou catálogo. O texto genérico anterior escondia essa distinção.

## Last.fm integrado sem ampliar fornecedores

Depois de Spotify sem configuração/match/foto ou temporariamente indisponível, uma consulta `artist.getInfo`, com `autocorrect=0`, usando a chave Last.fm existente. Só o artista selecionado é enviado, sem histórico completo, usuário, contagens ou datas. Nome retornado e slug da URL de perfil devem corresponder ao pedido. Sem busca ampla, scraping, IA, nova variável/login ou migration.

Usa a **mesma fila, singleflight e cooldown Last.fm** do adaptador existente. Intervalo habitual de 300 ms por processo; timeout de 6 s, sem retry automático. A consulta da foto não começa se esperar mais de 2,5 s na fila, preservando o orçamento da rota. Cache próprio de até 64 perfis: foto 24 h e lacuna 1 h. Não modifica cache/score de afinidade. Sem controle distribuído entre instâncias.

Aceita somente os dois CDNs Last.fm já permitidos, em `/i/u/`, JPEG/PNG/WebP; recusa URL vazia, host inesperado e placeholder conhecido. Foto válida tem fonte/link do perfil; sem imagem válida mas com perfil correspondente, esse link continua disponível. Foto não certifica identidade global de homônimos pelo nome. Nenhuma imagem Spotify/Last.fm entra na IA ou ranking.

O proxy recebe `kind=portrait` para aplicar lista de origens, MIME bitmap e ausência de redirect também às fotos Last.fm, mantendo as capas existentes. Nenhum domínio novo foi permitido. Falta de configuração, placeholder, ambiguidade, lacuna e falha temporária têm mensagens distintas.

## Apresentação e validação

Sem imagem, o cartaz **não deixa um grande retângulo vazio**: nome e dados ocupam o espaço, com nota curta e perfil quando disponível. A caneta original da Conversa continua medindo os elementos reais, grifando nome e circulando dado; contorna a fotografia apenas depois de carregar. Movimento reduzido preservado.

550 testes em 102 arquivos e build passaram. Testes verificam reabertura com todos os temas vistos, prioridade sem ocultação, silêncio/restauração, fallback limitado, preservação de ambiguidade, identidade/URL Last.fm, cache/singleflight, placeholder e erro. Banco, credenciais e retornos são simulados.

Chrome headless em 1280/1920/390 px e 390 px com movimento reduzido: foto Spotify, foto Last.fm, placeholder com perfil e composição compacta, erro/retry e gestos. Imagem/nome/dados explicitamente sintéticos; capturas com e sem foto no diretório ignorado de avaliação. Sem consulta autenticada real ou banco real; fotos reais dependem do retorno e configuração dessas APIs na preview.

Revisão: abrir/reabrir **Conversa** após ver os assuntos; devem continuar à vista. Silenciar explicitamente e conferir restauração. Em **teu retrato**, escolher artistas e observar fonte efetiva, mensagem de ausência e perfil. Não confundir placeholder rejeitado com fotografia carregada.
