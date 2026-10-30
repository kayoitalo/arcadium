# Evolução do Arcadium — registro inicial do brainstorm

Atualizado em 29/10/2026. Estado: discussão pausada para continuidade em outro ambiente.

Este documento preserva contexto, constatações e direções discutidas. Os acordos abaixo são direções de produto revisáveis, não uma especificação fechada nem autorização para implementar. A criação deste documento e do PR foi solicitada para permitir a retomada em nuvem.

## Como retomar

Leia este documento, o [README](../README.md), o [ADR de autenticação](adr-001-personal-authentication.md) e as [notas de revisão](pr-9-review-notes.md). Confira o código atual antes de tratar as constatações como permanentes.

Continue como parceiro de discussão de produto, UX, arquitetura, dados e recomendação musical. Use partes curtas, exemplos concretos, contrapontos e uma pergunta por vez. O usuário prefere discutir progressivamente a receber outro panorama muito extenso.

Nesta etapa, não implementar funcionalidades, executar migrations, modificar infraestrutura ou fechar um roadmap. O PR documenta a conversa; não aprova execução. Novas alterações dependem de uma mudança explícita de escopo pelo usuário.

**Pausa inicial (superada na continuação abaixo):** foi proposta a distinção entre “fugiu do pedido”, “respeitou o pedido, mas não agradou” e “despertou interesse, com ressalvas”. Naquela pausa, a pergunta ainda não tinha sido respondida:

> Você acha natural ter uma opção como “não era o que pedi” separada de “não gostei”, deixando os detalhes opcionais?

A opção foi aprovada na continuação registrada ao final deste documento. O ponto atual é a análise da limpeza e identificação do catálogo. Métricas, viabilidade dos dados, responsabilidades da IA e arquitetura continuam abertas.

Sugestão de mensagem para retomar:

> Leia docs/brainstorm-evolucao-arcadium.md e continue o brainstorm de onde paramos, sem implementar. Diferencie acordos, hipóteses e pendências. Faça uma pergunta por vez e mantenha atenção à viabilidade dos dados e ao limite gratuito da IA.

## Propósito e limites

Arcadium é um projeto pessoal em evolução contínua. Não estamos criando um produto do zero nem preparando imediatamente um lançamento público. A prioridade é melhorar profundamente recomendações e descoberta, preservando identidade e prazer de desenvolver.

> Não recomendar somente o que você já sabe que gosta. Descobrir aquilo que você ainda não sabe que pode gostar.

Mais APIs, modelos ou IA só se justificam por uma contribuição identificável e, quando possível, mensurável. Arquitetura, interface e narrativa devem contribuir para a experiência musical.

## Síntese dos acordos de produto

| Tema | Direção discutida e aceita |
| --- | --- |
| Home | Priorizar acontecimentos, mudanças e fases relevantes; alternar assuntos sem repetir uma constatação apenas porque continua verdadeira. |
| Retrato histórico | Análises acumuladas e duradouras merecem área própria. Podem voltar à home como contexto de uma mudança real. |
| Entrada da descoberta | Começar pela intenção, revelando refinamentos aos poucos. |
| Escopo | O pedido explícito orienta a personalização. Misturar territórios é uma escolha do usuário. |
| Cobertura insuficiente | Entregar menos opções bem sustentadas e oferecer ampliar a busca; não completar silenciosamente com escolhas fora do pedido. |
| Novos territórios | Equilibrar busca automática com curadoria pequena e fundamentada de portas de entrada. |
| Apresentação | Uma faixa principal por vez, com alternativas opcionais. Evitar cansar antes de começar a ouvir. |
| Narrativa | Explicar a escolha, oferecer pistas de escuta e contexto relevante, fundamentado e aprofundável. |
| Feedback | Reação simples; depois de curtir, aprofundamento opcional “o que te pegou?”, com múltiplos motivos. |
| Aprendizado | Reconhecer curiosidade e preferência duradoura como resultados diferentes e válidos. |
| Retorno explícito | O narrador pode perguntar ocasionalmente se uma indicação funcionou, especialmente quando o histórico não esclarece. |
| Navegação | A home introduz e convida para a área específica de descoberta; a exploração completa acontece nessa área. |

Nomes das entradas, textos dos botões, layout e detalhes de interação são provisórios.

## Gosto: várias preferências, sem inferir além dos dados

Combinar histórico de longo prazo, fase recente e intenção momentânea é um caminho considerado útil. Um retrato dominado por poucos artistas não representa necessariamente preferências menores, exceções e diferentes motivos para gostar.

A transformação proposta é reconhecer regiões de gosto por faixas, comportamento e características. Sua viabilidade depende dos dados. Primeiro podemos reconhecer conjuntos de músicas revisitadas, sem inventar uma explicação sonora para o que as une.

| Evidência | Interpretação possível | Limite |
| --- | --- | --- |
| Retornos em dias distintos | Preferência persistente provável. | Não revela o motivo sonoro. |
| Músicas na mesma sessão | Associação de comportamento. | Pode refletir uma playlist; não prova semelhança ou intenção. |
| Atributos documentados por gravação | Conexões musicais possíveis. | Não explicam automaticamente a preferência pessoal. |
| Motivo declarado pelo usuário | Evidência direta de sua percepção daquela faixa. | Não generalizar para todo artista ou gênero. |

O usuário valoriza voz/interpretação, instrumental/arranjo, ritmo, letra, atmosfera e história/contexto. Pode gostar de um aspecto e estranhar outro. Isso não equivale a aprovar ou rejeitar todos os elementos da faixa.

Registrar esses motivos é viável antes de resolver análise acústica. Já procurar precisamente “o mesmo instrumental com outra voz” exige descritores e cobertura que ainda não comprovamos. A proposta de feedback simultâneo positivo e negativo por aspecto continua como possibilidade, não como interação fechada.

Separar gênero/subgênero, características sonoras, ritmo/energia, mood/atmosfera, intenção, familiaridade pessoal e alcance. Não equiparar BPM a felicidade, popularidade a qualidade ou ausência no histórico a rejeição. Não inferir estado emocional do ouvinte pelo repertório.

## Intenções de descoberta

| Entrada provisória | Expectativa |
| --- | --- |
| Quero sair da minha bolha | Conhecer um gênero ou universo desconhecido, com uma porta de entrada justificável. |
| Quero descobrir algo que combine comigo | Encontrar banda, faixa ou subgênero novo a partir das preferências. |
| Quero ouvir o que combina com hoje | Selecionar, misturar ou compilar repertório conhecido por mood, gênero ou características; novidade não é obrigatória. |

Mood e características podem atravessar as três intenções. Distância do repertório e liberdade para misturar devem ser dimensões distintas: é possível surpreender dentro de um gênero.

Exemplos que motivaram a discussão: o usuário relata mixes de arrocha com músicas percebidas como fora do gênero e mixes felizes com músicas percebidas como melancólicas. São relatos de inadequação ao pedido, não uma auditoria ou comprovação do funcionamento interno do Spotify.

Para mood, distinguir som, ritmo, letra e efeito pessoal. Uma faixa dançante pode ter letra melancólica. Evitar atribuir uma única emoção a toda a discografia de um artista.

## Portas de entrada e contexto

Quando não houver destino escolhido, oferecer uma pequena degustação de territórios; o interesse em um deles abre uma introdução focada. Se o usuário já escolher um gênero, ir direto à introdução. A apresentação permanece uma faixa por vez.

Escolher entradas equilibrando acessibilidade para aquela pessoa, representatividade e reconhecimento dentro do universo. Popularidade é uma pista, não decisão suficiente. Evitar escolher algo tão atípico que apresente uma imagem enganosa do gênero.

Possíveis papéis para faixas alternativas: uma conexão com preferências conhecidas, uma referência representativa e outra face do gênero. Isso não é uma quantidade obrigatória de músicas ou uma sequência fechada.

O relato pessoal sobre Chico Science é referência importante: o estranhamento inicial foi acompanhado de interesse pelo instrumental, letras, interpretação e história/representação cultural ligada a Recife e ao Brasil. O produto deve permitir que esses detalhes despertem curiosidade. Afirmações históricas específicas precisam de fontes.

Uma recomendação pode oferecer:

1. Por que ela foi escolhida: razões reais usadas pelo motor.
2. Uma pista para escutar: um destaque sustentado por evidência da gravação.
3. Contexto ou curiosidade: quando relevante, com fonte e aprofundamento opcional.

A explicação convida a perceber; não tenta convencer a gostar. Pode ser curta ou dispensável. Não exigir aula, leitura ou “preparo” antes do play.

## Aprendizado e avaliação

Resultados aceitos como valiosos: despertar vontade de conhecer mais e entrar no repertório com o tempo. A primeira indicação pode abrir curiosidade e outra faixa criar vínculo.

Separar geração, exposição, reprodução, curiosidade, avaliação, salvamento, retorno e exportação. “Outra entrada” não é rejeição do universo. “Guardar” não é gostar. Ausência de scrobble não prova rejeição. Retorno posterior não prova causalidade da recomendação nem conclusão da escuta.

O narrador pode perguntar ocasionalmente se a indicação funcionou. Respostas candidatas: gostei; fiquei curioso/quero outra; não funcionou; ainda não ouvi direito. A lista final não foi fechada. Perguntas devem poder ser dispensadas e não insistir repetidamente.

Métricas sugeridas, ainda sem definição operacional: adequação ao pedido, aprovação entre sugestões experimentadas, curiosidade, surpresa útil, retornos em dias distintos, expansão de repertório, diversidade, qualidade de identificação, cobertura, latência e custo por descoberta útil. Avaliar por intenção; exploração radical não precisa ter a mesma aprovação imediata do modo próximo.

Comparar fontes por contribuição exclusiva e modelos contra uma referência simples. Testes de score não demonstram qualidade musical. Avaliações retrospectivas precisam evitar dados do futuro e reconhecem mal descobertas que nunca chegaram a ser ouvidas.

## Constatações do repositório

Base da análise local: commit `55e183333011e6cac6aa4d7ed3f6fbc156d6955f`. Na criação deste registro, a master remota era `fbebb9396a642d2c3a6f21f2ba72ec7fc959f992`, merge do PR de autenticação que inclui essa base. O repositório remoto atual se chama `kayoitalo/arcadium`; o endereço antigo Spot-Stats redireciona.

Não houve inspeção visual da aplicação renderizada nem avaliação musical contra o banco real. A consulta agregada ao banco falhou em resolução de endereço. Não se executaram testes, builds ou migrations nesta etapa documental.

| Constatação estática | Referência no código | Implicação a investigar |
| --- | --- | --- |
| Perfil com top 20 artistas; busca externa com parte das sementes. Gêneros contados por presença em artistas enriquecidos. | [recommendation-service](../src/modules/recommendations/application/recommendation-service.ts) | Pouca representação de preferências menores; falta de ponderação e cobertura. |
| Busca externa por artistas semelhantes, até 18 artistas e uma faixa do topo por artista. | Mesmo serviço | Similaridade de artista não escolhe necessariamente a faixa adequada. |
| Interface sempre envia BALANCED e GENERAL. | [descobertas](../src/components/descobertas/descobertas.tsx) | Ajustar o mapa não ativa os pesos do modo experimental; contexto não participa do score. |
| Limite por artista aplicado antes de exclusões e ranking. | recommendation-service | Pode descartar alternativas inéditas antes de excluir uma faixa conhecida. |
| Sessões reutilizadas por seis horas; “busca mais” repete parâmetros. | recommendation-service e descobertas | Pode reapresentar a mesma sequência. |
| Feedback resumido por artista; “pula” envia NOT_INTERESTED. | Mesmo serviço e interface | Reação à faixa ou ao momento pode penalizar o artista. |
| DISLIKED pode excluir artista inteiro. | recommendation-service | Granularidade merece revisão; botão não está na tela atual. |
| Similaridade usa posição da semente; proximidade usa match do provedor; fama ausente recebe 0,35. | [scoring](../src/modules/recommendations/domain/scoring.ts) | Heurísticas não são probabilidades calibradas; desconhecido pode parecer obscuro. |
| Gêneros comparados por texto e tags do artista. | scoring e [genre-tags](../src/modules/enrichment/domain/genre-tags.ts) | Faltam dimensões e evidências por gravação. |
| Enriquecimento atualiza faixas já ouvidas, sem importar automaticamente discografias inéditas. | [enrichment-service](../src/modules/enrichment/application/enrichment-service.ts) | Fontes locais tendem a ter pouco material novo numa conta pessoal. |
| Não há ciclo específico de exposição e escutas posteriores. | [schema Prisma](../prisma/schema.prisma) | Falta avaliar o efeito posterior das recomendações. |

Preservar como ativos: narrador e caneta, evidências determinísticas, PostgreSQL como fonte de verdade, adaptadores substituíveis, autenticação pessoal, sessões/feedback persistidos, testes existentes e monólito modular.

O exemplo de repetição de Can't Hold Us por mais de um mês e o retrato dos anos 2010 motivaram a discussão da home. Atualizar redação não resolve repetição editorial. Precisamos escolher o que vale contar, considerando mudanças e o que já foi mostrado.

## Fontes e viabilidade: hipóteses de contribuição

As fontes abaixo foram consultadas durante o brainstorm. Condições, disponibilidade e cobertura precisam ser reconfirmadas antes de uma integração; documentação pública não comprova acesso da conta nem adequação ao repertório.

| Fonte | Contribuição investigada | Limite relevante |
| --- | --- | --- |
| Last.fm | Histórico, similaridade de artista e faixa, tags, alcance. | Similaridade de escuta não explica qual atributo sonoro conecta itens; atribuição e condições de uso/cache. |
| ListenBrainz | Recomendações colaborativas e gravações semelhantes. | Cobertura e disponibilidade a validar; recomendações pessoais experimentais. Publicar histórico é decisão separada de consultar relações entre itens. |
| MusicBrainz | Identidade, versões, créditos, relações e lançamentos. | Não é catálogo acústico completo; limite de taxa e licenças por conjunto de dados. |
| Apple/iTunes | Catálogo, links, capas e prévias; MusicKit para integração autorizada mais completa. | Previews não concedem automaticamente direito de baixar ou extrair embeddings. Search API e MusicKit são integrações distintas. |
| Spotify | Destino de escuta/exportação. | Não depender de audio features/recomendações sem acesso confirmado; restrições ao uso de conteúdo em análise e IA. |
| Wikidata | Contexto estruturado. | Verificar cada afirmação e sua referência. |
| Jamendo | Território alternativo com metadados e licenças por faixa. | Não presumir permissão uniforme. |
| Essentia | Descritores e embeddings especializados, se houver áudio utilizável. | Licença, cobertura, custo e qualidade a validar. |
| AcousticBrainz | Dados históricos. | Projeto descontinuado; não assumir enriquecimento ativo. |

Fontes para reconferência:

- [Last.fm: faixas semelhantes](https://www.last.fm/api/show/track.getSimilar) e [termos](https://www.last.fm/api/tos).
- [ListenBrainz: recomendações](https://listenbrainz.readthedocs.io/en/latest/users/api/recommendation.html), [gravações semelhantes](https://labs.api.listenbrainz.org/similar-recordings) e [termos](https://listenbrainz.org/terms-of-service/).
- [MusicBrainz: API](https://musicbrainz.org/doc/MusicBrainz_API) e [licenças](https://musicbrainz.org/doc/About/Data_License).
- [iTunes Search API](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/) e [MusicKit](https://developer.apple.com/musickit/).
- [Spotify: mudanças de acesso](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api), [guia de 2026](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide) e [política](https://developer.spotify.com/policy).
- [Wikidata](https://www.wikidata.org/wiki/Help%3AData_access), [Jamendo](https://developer.jamendo.com/v3.0/tracks), [Essentia](https://essentia.upf.edu/models.html) e [AcousticBrainz](https://acousticbrainz.org/download).

## IA e orçamento gratuito

Não há decisão fechada de conversa livre ou distribuição de tarefas por modelo. O usuário pediu que custos e capacidade gratuita fossem considerados antes de expandir o uso.

O [adaptador Gemini](../src/modules/ai-analysis/infrastructure/gemini-adapter.ts) gera pacotes reutilizáveis: quatro leituras, até 24 comentários de discos e 12 frases auxiliares. O recomendador atual e suas justificativas não chamam o Gemini por faixa.

O [orçamento](../src/modules/ai-analysis/application/ai-budget.ts) tem padrões de 12 gerações/24h e 3/h. A configuração local consultada tinha 30/24h e 10/h e modelo `gemini-3.5-flash`; isso não confirma configuração da produção. Nenhuma credencial é reproduzida aqui.

Uma geração pode gerar até três chamadas externas, por retry e fallback. O contador é por execução registrada, não por tentativa de API; `tokenCount` não é preenchido pelo fluxo lido. A medição atual não reconstrói precisamente o consumo.

O usuário compartilhou capturas do AI Studio com janela de 28 dias. Os valores eram **máximos observados na janela**, não consumo do dia, médias ou garantia permanente de cota:

| Modelo exibido | Pico / limite RPM | Pico / limite TPM de entrada | Pico / limite RPD |
| --- | --- | --- | --- |
| Gemini 3.6 Flash | 4 / 5 | 18,12 mil / 250 mil | 11 / 20 |
| Gemini 3.5 Flash Lite | 2 / 15 | 10,3 mil / 250 mil | 5 / 500 |

O gráfico de erros identificava 503 ServiceUnavailable. Isso não demonstra esgotamento de cota. Os modelos no painel divergem da configuração local; reconciliar produção, aliases e histórico de configuração antes de concluir. As imagens não estão versionadas; a tabela preserva a leitura feita na conversa.

Hipótese a testar: Lite para interpretação curta e explicações estruturadas; Flash onde houver ganho demonstrável de qualidade narrativa. Reutilizar contexto de gêneros e gerar em conjuntos. Conversa livre permanece opcional, limitada e condicionada a qualidade e orçamento. A descoberta deve funcionar sem geração disponível.

Separar fatos calculados, informações documentadas e inferências. IA apresenta e interpreta evidências; não inventa atributos, músicas, razões ou fatos históricos. Textos factuais precisam de procedência, mesmo quando a voz é informal.

Consultar [limites oficiais](https://ai.google.dev/gemini-api/docs/rate-limits) e [preços/disponibilidade](https://ai.google.dev/gemini-api/docs/pricing). Limites ativos são por projeto/modelo e devem ser confirmados no AI Studio. Não usar o comentário antigo de “20/dia” como regra universal.

## Engenharia e assuntos ainda abertos

Manter como hipóteses, sem transformar em backlog aprovado:

- Separar conceitualmente catálogo, perfil, busca de candidatos, avaliação de faixa, composição da sessão, exposição/resultados e narrativa dentro do monólito.
- Melhorar identidade de gravações, aliases, versões e relações de faixa/lançamento sem reproduzir todo o MusicBrainz.
- Preservar fonte, confiança, data e versão dos atributos; distinguir falta de dados de valor baixo.
- Usar cache persistente e controle de concorrência onde demonstrado necessário e permitido pelos provedores.
- Avaliar geração de contexto em lote, latência e custo por fonte; não multiplicar chamadas por padrão.
- Investigar recuperação de sync interrompido, locks antigos e reserva atômica de orçamento de IA.
- Perfil da narrativa e perfil de recomendação precisam de fatos compatíveis; hoje calculam gêneros de maneiras diferentes.
- Cobertura musical brasileira, subgêneros e entradas culturais precisam de validação específica.
- UX mobile, compreensão do mapa, acessibilidade e alternativas ao arrasto precisam de inspeção real.
- Definir métricas, registros de exposição, atribuição e comparação com o motor atual antes de afirmar melhora.
- Cadastro público, operação multiusuário, novos modelos, infraestrutura e roadmap continuam sem decisão.

## Ideias preservadas para discussão posterior

- “Muda isso, mantém aquilo”: explorar mudando uma dimensão e preservando outra, quando houver dados.
- Exceções apreciadas como sementes de descoberta.
- “Outra porta de entrada” e segunda chance contextual, respeitando rejeições explícitas.
- Descobertas que voltam à conversa quando há desdobramento real.
- Escuta opcional sem rótulos prévios, respeitando atribuições das fontes.
- Reconhecer quando o motor insistiu demais numa região musical.
- Sessão “quero só ouvir”, sem obrigação de avaliar.

## Escopo deste registro

Este documento é o único conteúdo proposto no PR. Alterações preexistentes em dependências locais não fazem parte dele. As decisões de produto continuam revisáveis. Retomar a discussão antes de planejar ou iniciar implementação.


## Continuação — feedback, justificativas e memória de descobertas

Direções adicionais explicitamente aceitas pelo usuário:

- Separar “não era o que pedi” de “não gostei”. A primeira reação corrige adequação à intenção sem concluir desagrado pela faixa; a segunda informa preferência sem rejeitar automaticamente o artista.
- Ajustes da busca valem para a sessão; avaliações explícitas de músicas são lembradas e podem ser revistas. Uma avaliação de mood permanece contextual.
- Reconhecer “valeu conhecer” como exploração válida, sem marcar aprovação musical nem excluir tentativas futuras. Uma retomada precisa de motivo; não insistir automaticamente na mesma aposta.
- Aprofundamento só com permissão/iniciativa do usuário. A reação simples já é suficiente. Oferecer convite discreto, sem abrir perguntas automaticamente ou bloquear a próxima música.
- A justificativa inicial pode unir adequação ao pedido e conexão com o gosto em uma ou duas frases, quando houver evidência para ambas. Na exploração radical, não inventar afinidade para preencher essa estrutura.
- Criar uma timeline visual de descobertas, agrupada por sessão/jornada, com capas e comentários pontuais do amigo. Datas discretas e caneta conectando desdobramentos; detalhes abertos sob demanda.
- Agrupar interações para evitar repetir a mesma capa a cada clique. O histórico não precisa expor todo evento como um destaque.
- Acrescentar retornos observados automaticamente à jornada, com opção de corrigir ou dispensar a observação. “Voltou a tocar” não significa “virou favorita”.
- A timeline fica na área de descoberta; acontecimentos relevantes podem gerar convites na home.

Sugestões de rótulos e menus são exemplos revisáveis. Não interpretar esses acordos como desenho final ou autorização de implementação.

## Investigação adicional — limpeza já existente e identidade musical

O usuário lembrou que já havia limpeza de músicas. A leitura estática confirmou camadas úteis, com responsabilidades diferentes:

| Camada existente | Comportamento observado | Limite |
| --- | --- | --- |
| [normalizeText](../src/modules/listening/domain/normalization.ts) | Remove acentos, ajusta caixa, espaços e extremidades. | Não resolve aliases, homônimos, participações ou versões. |
| [Chave de evento](../src/modules/listening/domain/event-key.ts) e sync | Deduplicam por conta, provedor, instante, artista e faixa normalizados; mantêm nomes brutos. | Evitam reimportação da mesma escuta, não identificam universalmente a gravação; provedores diferentes geram chaves diferentes. |
| [Correspondência Apple](../src/modules/enrichment/infrastructure/itunes-catalog-adapter.ts) | Limpa títulos, compara artista/título e busca catálogo/prévia. Há testes que preservam números em títulos. | Remoção ampla de parênteses e sufixos pode perder distinções sonoras importantes. |
| [Filtros de candidatos](../src/modules/recommendations/domain/candidate-filters.ts) | Identificam colaborações de artistas conhecidos e limitam itens por artista. | Heurística por separadores pode confundir nomes legítimos; colaboração também pode trazer contribuição nova. |
| [MusicBrainz](../src/modules/enrichment/infrastructure/musicbrainz-adapter.ts) | Seleciona artista por nome e score heurístico, resolve gêneros e outros metadados. | Nome igual não prova identidade quando há homônimos; o score não é uma probabilidade calibrada. |

Achados específicos para validar antes de futuras mudanças:

1. No matching Apple, `normalizeTitle` remove parênteses/colchetes e sufixos que incluem live, acoustic, mix e version. Assim, “Numb - Live” e “Numb” podem corresponder; existe teste que confirma essa normalização. Isso ajuda buscas, mas não garante a versão da prévia ou do atributo anexado.
2. O sync identifica faixa por artista e título normalizado, sem álbum na chave. Isso evita separar a mesma faixa só porque aparece em coletânea, mas pode juntar gravações distintas com o mesmo nome.
3. No adaptador Last.fm, o campo único `mbid` recebe `t.mbid || t.artist.mbid`. O sync grava `item.mbid` no artista. Quando houver MBID da faixa, ele pode ser armazenado como se fosse do artista. É um caminho de código confirmado; não se verificou ocorrência no banco.
4. A comparação de nomes de artista na Apple usa inclusão e sobreposição de tokens. No MusicBrainz, igualdade normalizada recebe confiança máxima. Essas aproximações precisam de contexto para homônimos e créditos.
5. A normalização da ingestão é mais conservadora que a busca Apple; outros filtros usam apenas trim/lowercase. São regras distintas, que podem reconhecer familiaridade e identidade de forma inconsistente.

Hipótese de evolução, ainda em discussão: separar nome bruto, chave de busca e identidade confirmada; preservar qualificadores de versão; tipar identificadores externos por entidade; manter correspondências incertas como candidatas, sem fusão automática. Popularidade, curadoria e inferências sonoras não corrigem uma gravação identificada incorretamente.

Uma auditoria futura poderia usar uma amostra com coletâneas, remasters, versões ao vivo/acústicas, remixes, participações, títulos com parênteses e artistas homônimos. Verificar correspondência da prévia, agrupamento, identificadores e procedência de gênero. Não foi executada auditoria do banco nem alteração do catálogo.

**Ponto atual da discussão:** aprofundar como aproveitar essa limpeza existente sem apagar diferenças musicalmente relevantes. Continuar com exemplos e uma pergunta por vez; não iniciar implementação.
