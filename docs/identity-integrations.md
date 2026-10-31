# Etapa 2 — identidade, versões e integrações

Hipótese: impedir trocas silenciosas de gravação torna a escuta e o feedback mais confiáveis, mesmo que menos músicas tenham prévia. Esta etapa não altera o ranking musical nem afirma que texto compatível comprova a gravação exata.

## Alterações

- Last.fm: `artistMbid`, `recordingMbid` e `releaseMbid` independentes. Nenhum fallback entre tipos. Os nomes originais, inclusive versões, continuam nos eventos.
- Sincronização: MBIDs conhecidos conflitantes não compartilham o mesmo registro apenas pelo nome. Sem identificador, um nome único permite agrupamento provisório; não permite atribuir um MBID novo. Ambiguidade pode criar registros paralelos, sem fusão nem transferência dos eventos antigos.
- Erro histórico: quando uma observação demonstra que o MBID armazenado no artista é o da gravação, o artista recebe `IDENTITY_REVIEW`. O identificador original e os eventos anteriores são preservados. Esses registros não são reutilizados pela sincronização nem usados na busca de lançamentos por MBID. Não há varredura nem correção em massa: registros ainda não observados podem continuar pendentes.
- MusicBrainz: um MBID conhecido consulta o endpoint de artista, sem substituição por busca nominal. Busca sem MBID exige um único nome exato; rejeita homônimos presentes na resposta e aproximações por substring. Isso reduz falsos vínculos, mas não resolve identidades cuja ambiguidade não aparece nos resultados. O `score` legado é compatibilidade textual, não probabilidade de identidade.
- Apple e Spotify: comparação de artista e título completos, tolerando caixa e pontuação. Mantém palavras de parênteses, participações, remaster, live, acústico, remix e edição clean. Não assume equivalência entre versões; diferenças de grafia/aliases ainda podem deixar uma faixa sem correspondência.
- Enriquecimento Apple: verifica também o artista de cada faixa, importante em coletâneas. A normalização permissiva de edição fica restrita à busca de álbuns, não à escolha de áudio ou duração de faixas.
- Descoberta: a identidade retornada pela Apple fica em `scoreComponents.previewIdentity`, sem migration, e aparece também no campo aditivo `previewIdentity` da resposta. O feedback continua vinculado ao item. Sessões antigas permanecem legíveis; áudio e link de faixa sem evidência compatível não são reapresentados como verificados. Avaliações antigas não são reinterpretadas.
- Prévias guardadas em `Track`: Conversa, Retrato/estatísticas e Histórico usam `/api/preview/[trackId]`. Só ao tocar há busca com a comparação atual, com proprietário verificado; a URL antiga nunca é usada como fallback. Um 404 significa ausência de correspondência e um 503, indisponibilidade temporária. O redirecionamento não é cacheado pelo navegador/CDN. Pode existir espera antes da primeira reprodução, ou a prévia antiga deixar de estar disponível.
- Cache Apple por loja e faixa, com consultas simultâneas iguais compartilhadas. Erros temporários e payloads inválidos não viram ausência cacheada por 24 horas. Prévia e enriquecimento passam pela mesma fila de aproximadamente 19 chamadas/minuto **por processo**.
- Spotify: criação via `POST /me/playlists`, adição via `POST /playlists/{id}/items`. Busca compara até dez resultados antes de aceitar uma faixa. A exportação informa `addedCount` e `partial`, distintos de correspondências encontradas; um envio incompleto é mostrado na interface. Não há repetição automática de escrita, que poderia duplicar faixas.

Não se oferece uma versão diferente como se fosse a pedida. Uma interface de escolha explícita de alternativas ainda depende de desenho próprio; a ausência de correspondência mantém a indicação sem áudio.

## Limites e operação

A fila e o cache Apple são locais ao processo. Duas instâncias da Vercel, ou produção e preview, não compartilham essa reserva. Isso não é uma garantia de cota global. Respeitar essa restrição nos testes manuais; um controle distribuído exige uma avaliação própria, sem contratação implícita. Uma sessão fria de oito faixas pode levar aproximadamente 22 segundos só no espaçamento das buscas, além da rede e das outras fontes. Observar latência e timeouts na preview.

Nenhuma migration, instalação de infraestrutura ou alteração de variável é necessária nesta etapa. Nenhuma migration foi executada. As configurações isoladas da etapa 1 continuam obrigatórias. Os testes automatizados usam dados sintéticos e simulam banco/provedores; não certificam as permissões reais da conta Spotify. Não foi criada playlist na conta do proprietário durante o desenvolvimento.

## Validação na preview

1. Em novas indicações, conferir título, artista e versão; tentar casos live, remaster, clean, participação e artista homônimo. Sem correspondência, não deve tocar outra versão.
2. Abrir sessões antigas: posição/avaliações continuam legíveis; prévias antigas sem procedência podem ficar indisponíveis. Não apagar a sessão para contornar isso.
3. Tocar músicas na Conversa, no Histórico e nos álbuns do Retrato. Conferir reprodução após redirecionamento autenticado, inclusive no mobile. Não deve haver busca de áudio ao simplesmente abrir o rack de álbuns.
4. Em uma sincronização/enriquecimento manual na cópia isolada, conferir os identificadores por entidade e eventuais `IDENTITY_REVIEW`. Não fundir registros por nome para eliminar duplicatas.
5. Com OAuth autorizado e callback da preview configurado, exportar poucas faixas para uma playlist de teste; conferir gravações e quantidade adicionada. Se o callback não estiver disponível nesse ambiente, registrar essa validação como pendente, sem usar o banco de produção na preview.
6. Observar latência, ausência de prévias e falhas Apple/Spotify. Mais correspondências não demonstram melhoria se o áudio estiver errado.

Testes cobrem separação dos três MBIDs, nomes brutos, conflitos/homônimos, sinalização sem reescrita de identificador, versões e convidados, prévias legadas, propriedade do áudio, falha temporária, fila compartilhada e resultados parciais de exportação. Checagens: suíte completa, tipos e build.

## Referências verificadas em 30/10/2026

- [Spotify: migração da Web API em fevereiro de 2026](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide): novos endpoints de playlist, limite de busca e diferenças do modo de desenvolvimento. A disponibilidade na conta ainda requer teste autorizado.
- [Apple: iTunes Search API](https://performance-partners.apple.com/search-api): loja, busca/lookup, limites e condições do material promocional. As prévias continuam vinculadas à descoberta e ao destino da loja; não há download nem extração de descritores de áudio nesta etapa.

Esta entrega prepara dados e interações mais confiáveis para as sessões e o aprendizado das etapas 3 e 4. Não é evidência de melhora de afinidade do recomendador.
