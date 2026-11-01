# Continuidade do Arcadium

Atualizado em 01/11/2026. Este registro recupera na base atual a continuidade do PR 14 que existia apenas na revisão permanente `da2055a9805ff6d39bdcac1d1211c80bde19c229`.

## Estado confirmado

- PRs 11–15 mergeados. O proprietário informou aprovação dos testes do PR 15 e merge confirmado na master `4c1aa4f` em 01/11/2026. A branch seguinte parte dessa master e combina recortes das etapas 6–7, por solicitação do proprietário. Ver [intenções e jornadas](intentions-journeys.md).
- O proprietário relatou aprovação dos testes manuais de mídia, continuidade e visual/mobile do PR 14. Isso não incluiu o ListenBrainz nem uma medição quantitativa de qualidade musical.
- ListenBrainz continua desligado por padrão e fora do ranking. Runner e adaptador agora compartilham contrato/algoritmo; cache limitado; sondagem pública e avaliação offline documentadas em [avaliação](listenbrainz-evaluation.md).
- Rodada pública seguinte: Kaatayra/Inpariquipê e Sessa/Grandeza sem relações tanto no ListenBrainz quanto no controle por faixa Last.fm. About a Girl revelou mapeamento de identificador histórico para grupo canônico que agrega versões; o teste ao vivo é inconclusivo. Dez consultas controladas e [métricas derivadas públicas](../scripts/evaluation/listenbrainz-coverage.public-probe.json). Não usar listas vazias como medida de popularidade. O contrato explicita identidade de versão não verificada.
- A preparação dos identificadores representativos ficou incompleta por HTTP 503/429 do MusicBrainz. Não confundir isso com cobertura vazia no ListenBrainz. O controle Roads retornou cem linhas válidas, vinte selecionadas, em uma consulta; não comprova qualidade personalizada.
- Após erro `DISCOVERY_MIGRATION_REQUIRED` relatado em produção e confirmação do destino pelo proprietário, foi aplicada a única migration pendente, `20261030040000_discovery_sessions_feedback`. `migrate status` confirmou as dez em dia. Não foi aplicada migration nova nem acessada a cópia de preview nesta sessão.
- A configuração versionada de migrations após build foi testada e mergeada pelo proprietário no PR 15, preservando o guard de preview. O incremento de jornadas acrescenta uma nova migration que ainda precisa passar na cópia isolada. Ver [deploy e migrations](deployment-migrations.md) e [jornadas](intentions-journeys.md).
- Validação local após a rodada de cobertura/canonização: 387 testes em 72 arquivos, tipos e build passaram. Build comum não executou migrations; testes usaram mocks para banco e provedores.
- Incremento seguinte de intenções/jornadas: 401 testes em 74 arquivos, tipos/build, validação de schema e diff offline passaram. Fixtures desktop e mobile foram inspecionadas em Chrome headless com dados fictícios. Validação funcional e migration isolada ainda requerem a preview. A seleção de um caminho antigo fica preservada ao recarregar por `lastOpenedAt`, sem mudar cursor ou feedback.
- O proprietário autorizou ampliar o PR 16 com fluidez da Descoberta e aceitou PRs maiores reunindo etapas/assuntos. Transições de faixa/painéis, sincronização da caneta/foco/exposição, posição corrente e recuperação do histórico foram acrescentadas; ver [movimento, limites e roteiro](discovery-motion.md). Validação final local: 404 testes/74 arquivos, tipos/build e seis grupos de cenários em cada configuração headless (desktop, mobile e movimento reduzido), mais Enter/Espaço nativos. Usa respostas e áudio simulados, sem banco/provedores; não equivale à aprovação manual da preview.

## Próximos trabalhos

1. Conferir PR/branch e checks atuais, sem presumir merge ou deploy. Na Vercel, observar `build:deploy` e o destino isolado da preview; o painel remoto não foi alterado nesta sessão.
2. A decisão desta rodada é adiar incorporação do ListenBrainz ao ranking padrão; manter opt-in. Para adoção futura, completar a [amostra pública](../scripts/evaluation/listenbrainz-sample.json) e resolver a semântica de grupos canônicos/versões. Popularidade dos grupos ainda não foi medida; o controle de versão segue inconclusivo.
3. O build removeu as capturas e avaliações temporárias de `.next/evaluation/`. As notas pessoais foram recuperadas a partir das declarações explícitas desta conversa em `.local/evaluation/`, agora ignorada pelo Git e preservada entre builds. Não são snapshots reconstruídos dos provedores e não foram publicados/sincronizados com produção. As métricas públicas versionadas permanecem disponíveis. Comparações locais por uma referência não são o motor completo.
4. Conferir a revisão de intenções/jornadas: repertório local, aprofundamento por uma indicação e histórico de caminhos. A coluna JSON é aditiva; validar primeiro no banco isolado pelo deploy aprovado. Curadoria de territórios, filtros estritos e álbuns em ordem seguem pendentes; a adoção de outra fonte não é pré-requisito para esse trabalho.
5. Seguir coleção na conta/timeline, conversa/retrato, contexto fundamentado e consolidação conforme [plano](evolution-plan.md), refinando pelos resultados.

## Limites preservados

Narrador/caneta, monólito modular e PostgreSQL. Sem contratação, IA adicional/paga, worker/fila externa, banco vetorial, upload ListenBrainz ou análise acústica ampla. Cotas/cache/filas continuam por processo, sem garantia distribuída entre ambientes. Preview nunca usa produção por fallback. Não copiar `.env`, payloads musicais completos ou resultados pessoais para o Git. Identidade incerta não vira gravação confirmada; avaliações de faixa não bloqueiam automaticamente artista/gênero.

Ler também [mídia e exploração](discovery-continuity-next.md), [motor híbrido](hybrid-discovery.md), [sessões e feedback](sessions-feedback.md) e [visão](brainstorm-evolucao-arcadium.md). O brainstorm é histórico; as autorizações posteriores do plano e desta sessão prevalecem sobre o antigo escopo apenas documental.
