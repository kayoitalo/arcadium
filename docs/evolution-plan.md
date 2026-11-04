# Evolução da descoberta — execução por PRs

Plano aprovado em 29/10/2026. A implementação começou pela base de avaliação. A visão e o brainstorm estão no [PR 10](https://github.com/kayoitalo/arcadium/pull/10); aprovação do plano não elimina os checkpoints de escolha visual e curadoria.

## Direção

Três intenções: descobrir algo próximo, explorar outro universo e selecionar repertório para o momento. Pedido explícito prevalece; pouca cobertura produz menos indicações e convite para ampliar, sem mistura silenciosa. Preservar narrador, caneta, monólito modular e PostgreSQL.

Faixa por vez, contexto fundamentado e aprofundamentos opcionais. Álbuns podem iniciar ou continuar uma jornada, preservando a ordem. Popularidade não garante afinidade. Exploração progride por interesse observado, sem escada fixa entre gêneros ou rótulo permanente de mente aberta.

## Entregas e dependências

| Etapa | Entrega e aceitação | Estado |
| --- | --- | --- |
| 1 | Avaliação reproduzível, capacidades e limites, cópia isolada, baseline. | PR 11 mergeado; preview testada e aprovada pelo proprietário. A amostra completa de fontes continua uma avaliação manual, não um resultado inferido dos testes. Ver [procedimento](evaluation-foundation.md). |
| 2 | Identificadores por entidade, versões preservadas, integrações e limites corrigidos; prévia/feedback na gravação certa. | PR 12 mergeado após avaliação do proprietário. Ver [alterações e limites](identity-integrations.md). |
| 3 | Retomar/buscar mais/outra entrada distintos; feedback revisável com escopo correto e histórico preservado. | PR 13 mergeado; proprietário relatou testes manuais aprovados. Migration pendente foi aplicada em produção em 01/11/2026 após confirmação do destino; status em dia. Concorrência PostgreSQL não foi medida nesta sessão. Ver [procedimento](sessions-feedback.md) e [deploy](deployment-migrations.md). |
| 4 | Perfil longo/recente, similaridade por faixa, adequação antes de afinidade, diversidade depois das exclusões; efeito do feedback observável. | PR 13 mergeado. Motor híbrido e comparação sintética implementados; qualidade musical e latência representativa continuam para avaliação isolada. PR 14 desacoplou mídia; validação funcional relatada como aprovada. Ver [motor e comparação](hybrid-discovery.md). |
| 5 | ListenBrainz opt-in por gravação; contribuição exclusiva medida; fontes não compartilham uma escala artificial de score. | Experimento isolado e desligado por padrão. Piloto público executado: lacunas nas duas sondas brasileiras e canonização que impede concluir identidade de versões. Decisão: adiar incorporação ao ranking; avaliação representativa e contribuição exclusiva continuam pendentes para adoção futura. Intenções/jornadas podem seguir com fontes atuais. Ver [avaliação](listenbrainz-evaluation.md). |
| 6 | Três intenções, restrições sustentadas, curadoria versionada aprovada, redescobertas identificadas, jornadas e álbuns. | PR 16 mergeado: intenção persistida, repertório e aprofundamento. PR 17 acrescenta álbuns em ordem com edição escolhida explicitamente, mídia da mesma coleção e retomada. Portas curadas e filtros estritos permanecem pendentes. Ver [intenções](intentions-journeys.md) e [álbuns](albums-sourced-context.md). |
| 7 | Comparar e escolher interface; coleção na conta, continuidade, mobile e timeline agrupada, feedback/contexto opcionais. | PR 17 ampliado em revisão: coleção/importação, diário com prévias iniciadas/exportações, cópia completa e exclusão por escopo. Revisão visual reúne a caneta como personagem (sem rosto), quatro abas, cartaz interativo do artista e estante; ver [interface](interface-caderno.md). Não reconstrói eventos antigos nem presume escuta completa. Ver [ampliação](portrait-editorial-operations.md). |
| 8 | Conversa dinâmica, retrato acumulado, histórico direto, convites contextualizados e menor repetição editorial. | Funcionalidades implementadas para revisão no PR 17: retrato observado com cartaz/foto identificada sob demanda, fase recente separada, histórico direto, convites, memória editorial na conta, intervalo de repetição, revisita e silêncio/restauração por tema. Aceitação editorial/manual na preview permanece. Ver [ampliação](portrait-editorial-operations.md). |
| 9 | Fontes culturais rastreáveis, pistas de escuta, reutilização e comparação Lite/Flash; contagem real de tentativas/tokens e reserva atômica. | Reserva atômica por tentativa SDK, retry/fallback contados, tokens observados e diagnóstico implementados no PR 17. Contexto sob demanda com fonte/data/snapshot acrescentado no PR 17, sem certificar a gravação. Fotos Wikidata/Commons são enriquecimento visual identificado, separado do ranking; ver [limites](magic-pen-artist-poster.md). Pistas específicas por gravação e comparação qualitativa de modelos permanecem pendentes. Ver [contexto](albums-sourced-context.md). |
| 10 | Consultas, retenção, recuperação de falhas e avaliação acumulada; registrar ganhos e retirar hipóteses sem benefício. | Recorte no PR 17: consultas/exportações limitadas, cache limitado, recuperação/continuação, escopos de exclusão e registros operacionais. Retenção automática e medição real longitudinal de qualidade, desempenho e concorrência seguem pendentes. |

Em 01/11/2026, o proprietário autorizou PRs maiores, agrupando etapas e assuntos. Cada bloco deve entregar ganhos identificáveis e ter critérios de revisão claros, mantendo o motor atual como referência e dados legados legíveis. Não ativar mudanças dependentes de migrations em produção antes da validação isolada. Não presumir merge ou deploy autorizado por abrir um PR.

## Regras de execução

- Preview Vercel com banco separado; cópia e variáveis configuradas manualmente pelo proprietário e preview aprovada na etapa 1. Manter o isolamento nas próximas entregas.
- Sem contratação, IA paga, análise acústica ampla, worker/fila, banco vetorial ou publicação de histórico no ListenBrainz por padrão.
- Identidade incerta não vira correspondência confirmada. Mesma gravação em outro lançamento é diferente de outra interpretação; alternativas são explícitas.
- “Não era o que pedi”, “não gostei”, “já conheço”, pular, guardar, curiosidade e “ainda não ouvi” têm significados separados. Não converter feedback legado em motivos não declarados.
- Reação de faixa não bloqueia artista/gênero automaticamente. Ajustes de busca valem para a sessão; avaliações podem ser revistas. A intenção controla familiaridade/surpresa automaticamente.
- Exposição requer visibilidade; geração não conta como vista. Guardar, tocar e exportar são eventos diferentes. Retorno observado não comprova causalidade ou preferência por todos os aspectos.
- Memória pessoal vinculada à conta com revisão/exportação/exclusão; catálogo mantém procedência e condições de uso. Relatos de metadados incorretos ficam discretos.
- Filtros estritos de mood, voz e instrumentação só com cobertura comprovada. IA não inventa músicas, atributos ou justificativas; funcionamento básico independe de geração.
- Navegação proposta: Conversa, Descoberta, Retrato e Histórico. Radar deve ser comparado com intenções/conexões da caneta; player global permanece fora da execução inicial.
- Mudanças de schema aditivas; migração na cópia primeiro; configurações permitem retornar ao motor anterior e sessões não se misturam entre versões.
- Em 01/11/2026, após erro de schema em produção, o proprietário pediu configurar migrations no deploy. Fluxo versionado preparado para aplicar após compilação bem-sucedida, com preview isolada e falha bloqueando a publicação. Ver [limites e operação](deployment-migrations.md); isso atualiza a operação manual anterior sem dispensar revisão e validação da migration na cópia.

## Validação

Cada PR declara hipótese, aceitação e observação na preview. Executar testes proporcionais, tipos e build; banco/migrations apenas no ambiente isolado e provedores reais apenas em consultas limitadas. Avaliar adequação, interesse, surpresa útil, variedade, retornos, cobertura, latência e custo; score interno e permanência no app não provam qualidade.

Primeiro marco musical: descoberta próxima na interface existente, com razões sustentadas e feedback influenciando seleções seguintes. Comparação visual pode ocorrer em paralelo após a base de avaliação. A implementação das etapas seguintes será refinada pelos resultados comprovados, sem substituir esta referência por um roadmap independente.
