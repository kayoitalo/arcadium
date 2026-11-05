# Fotos de artista: comparação e sondagem pública

04/11/2026, PR 17. O proprietário trouxe TheAudioDB e Discogs para avaliação de limites, qualidade e disponibilidade, sem autorizar uma contratação. Nenhum deles foi integrado automaticamente ao app nesta rodada.

## Spotify: correção da consulta existente

O fluxo anterior exigia encontrar uma versão exata da faixa mais observada e somente depois pedia o perfil. Isso era apropriado para escolher a gravação de uma prévia, mas restritivo para obter a foto do artista: um título ao vivo, remix ou nome importado diferente podia impedir a imagem de um perfil existente.

Agora a consulta começa com Search `type=artist`, nome de artista e até dez perfis. Exige nome correspondente. Perfil único usa a própria imagem retornada pelo Search, sem consulta adicional. Se houver homônimos, usa uma busca de faixa como desempate e preserva versão/nome completos. Ambiguidade não resolvida continua sem foto; não escolhe por popularidade ou posição. Limite de dez não certifica ausência de homônimos fora da amostra.

Uma chamada de catálogo no caso comum; até duas com desempate, além do token frio. Cache/singleflight, intervalo, timeout, proxy, créditos e separação do ranking permanecem. Nenhuma flexibilização da correspondência de gravação usada nas prévias/playlists.

Isso corrige uma restrição real do código, **não comprova a causa das falhas na preview**. O processo local não tem Client ID/Secret Spotify disponíveis para uma sondagem autenticada. Configuração, autorização, quota, match e imagem precisam continuar distinguíveis no ambiente real.

## Comparação documental

| Fonte | Imagem / qualidade documentada | Acesso e limite | Adequação |
| --- | --- | --- | --- |
| Spotify | Perfis de artista têm `images`, com URLs e dimensões; Search de artistas já retorna esses objetos. | App/token; cota variável por app em janela de 30 s, respeitar 429. Modo de desenvolvimento exige Premium do proprietário. | Primeira opção já integrada, após corrigir o filtro desnecessário. |
| Apple Music API | `Artists.Attributes.artwork` é explicitamente a imagem do artista; tamanho vem do objeto Artwork. | Developer Token e configuração MusicKit/Media Services. Não é a API sem chave que usamos hoje. | Suporta, mas adicionaria outra integração/autorização Apple. |
| iTunes Search atual | Busca `musicArtist` e fornece links/IDs; documentação não garante foto de perfil. Artwork de música/álbum não prova retrato. | Aproximadamente 20 chamadas/minuto; fila atual preservada. | Não escolher para resolver foto de artista. |
| TheAudioDB | Thumb de artista documentada em 700×700; WideThumb 1000×562, fanart 1280×720. Respostas também têm MBID. | V1 gratuita, chave pública documentada 123, 30 consultas/minuto; um resultado por busca de artista no plano gratuito. | Alternativa nova mais promissora para o cartaz; conferir MBID, cobertura e condições antes de incorporar. |
| Discogs | Recurso de artista devolveu imagens e dimensões variáveis na sondagem; perfil inclui discografia. | Resposta anônima observada informou 25 chamadas/minuto. Página de documentação bloqueou leitura automatizada; quotas autenticadas/condições não foram verificadas. | Alternativa possível; ainda não medida para os artistas da amostra. |
| Last.fm | `artist.getInfo` documenta perfil/biografia e imagem; `artist.search` também documenta imagem. | Chave já existente, fila/cooldown compartilhados. | Mantém perfil, mas documentação antiga não basta para garantir fotos úteis; placeholder é recusado. |

Fontes primárias: [Spotify Get Artist](https://developer.spotify.com/documentation/web-api/reference/get-an-artist), [Search](https://developer.spotify.com/documentation/web-api/reference/search), [rate limits](https://developer.spotify.com/documentation/web-api/concepts/rate-limits), [modo de desenvolvimento](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide); [Apple artist artwork](https://developer.apple.com/documentation/applemusicapi/artists/attributes-data.dictionary), [Apple token](https://developer.apple.com/documentation/applemusicapi/generating-developer-tokens), [iTunes Search](https://performance-partners.apple.com/search-api); [TheAudioDB API](https://www.theaudiodb.com/free_music_api), [artwork](https://www.theaudiodb.com/docs_artwork.php), [JSON](https://www.theaudiodb.com/docs_json); [Discogs docs](https://www.discogs.com/developers), [recurso público sondado](https://api.discogs.com/artists/1); [Last.fm getInfo](https://www.last.fm/api/show/artist.getInfo).

Os [termos TheAudioDB](https://www.theaudiodb.com/docs_terms_of_use.php) permitem lookup de dados/artwork para projetos de desenvolvimento e exigem assinatura para publicação em app store. Pedem preservação de avisos, procedência e atenção aos direitos de imagens de terceiros; acesso à API não transforma todas as fotos em domínio público. Não foi contratada assinatura ou adotada uma interpretação de produção nesta rodada.

## O que foi verificado de fato

Sondagem TheAudioDB: três buscas por nome, seguidas de três lookups pelos IDs retornados e três HEADs de imagens, com espaçamento e sem retry. Chave pública do próprio guia, sem conta/segredo/histórico do proprietário. Nenhum arquivo de foto foi baixado ou colocado no repositório.

| Referência pública | ID TheAudioDB | MBID retornado | Lookup | HEAD da thumb |
| --- | --- | --- | --- | --- |
| Pop Smoke | 160498 | 253c9ae7-850b-46be-8fbb-65e9fa621058 | 200 | 200, JPEG, 125320 bytes |
| Linkin Park | 111358 | f59c5520-5f46-4d2c-b2c4-822eabf53419 | 200 | 200, JPEG, 110214 bytes |
| O Rappa | 122509 | 00034ede-a1f1-4219-be39-02f36853373e | 200 | 200, JPEG, 105568 bytes |

As três buscas retornaram uma linha com thumb e fanart. Linkin Park também tinha WideThumb; os outros dois não. Hosts observados: www.theaudiodb.com e r2.theaudiodb.com. O guia também documenta lookup por MBID, mas esse endpoint não foi sondado nesta rodada. Os HEADs confirmam acesso/MIME, não qualidade estética, recência ou cobertura representativa; as dimensões acima do quadro comparativo são padrões documentados, não dimensões medidas dessas três fotos.

Discogs: uma leitura pública de `/artists/1`, HTTP 200, artista de exemplo The Persuader. Header `X-Discogs-Ratelimit: 25`. Duas imagens com URLs: primária 466×600 e secundária 600×450. Não foram baixadas nem testadas as URLs dessas imagens. Não confundir esse resultado com uma comparação de cobertura dos três artistas acima.

## Decisão para revisão

Corrigir e diagnosticar Spotify antes de atribuir a falha ao catálogo. TheAudioDB é a alternativa que teve evidência pública mais direta nesta amostra; 30 consultas/minuto é compatível com um artista selecionado por vez e cache, mas não autoriza carregar toda a lista ou somar instâncias sem controle. Discogs permanece opção de avaliação; Apple Music tem imagem, com custo de integração diferente do iTunes atual. Nenhuma contratação, migration ou fonte nova ativada.

552 testes em 102 arquivos e build passaram após a correção Spotify. Casos incluem perfil único sem faixa/versão disponível, tributos, homônimos/desempate, ambiguidades, proxy, cache e falhas/token. Testes Spotify são simulados; a sondagem real foi apenas dos endpoints públicos descritos acima.
