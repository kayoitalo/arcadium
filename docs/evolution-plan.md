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
| 3 | Retomar/buscar mais/outra entrada distintos; feedback revisável com escopo correto e histórico preservado. | Implementação em revisão. Requer migration aditiva primeiro na cópia isolada; aplicação e testes com banco real pendentes. Ver [procedimento](sessions-feedback.md). |
| 4 | Perfil longo/recente, similaridade por faixa, adequação antes de afinidade, diversidade depois das exclusões; efeito do feedback observável. | Incorporada ao PR 13 junto da etapa 3 por escolha do proprietário. Motor híbrido e comparação sintética implementados; qualidade musical, latência e migração continuam para avaliação isolada. Ver [motor e comparação](hybrid-discovery.md). |
| 5 | ListenBrainz opt-in por gravação; contribuição exclusiva medida; fontes não compartilham uma escala artificial de score. | Pendente |
| 6 | Três intenções, restrições sustentadas, curadoria versionada aprovada, redescobertas identificadas, jornadas e álbuns. | Pendente |
| 7 | Comparar e escolher interface; coleção na conta, continuidade, mobile e timeline agrupada, feedback/contexto opcionais. | Pendente; escolha explícita entre alternativas antes da ativação |
| 8 | Conversa dinâmica, retrato acumulado, histórico direto, convites contextualizados e menor repetição editorial. | Pendente |
| 9 | Fontes culturais rastreáveis, pistas de escuta, reutilização e comparação Lite/Flash; contagem real de tentativas/tokens e reserva atômica. | Pendente |
| 10 | Consultas, retenção, recuperação de falhas e avaliação acumulada; registrar ganhos e retirar hipóteses sem benefício. | Pendente |

PRs pequenos devem entregar ganhos identificáveis, mantendo o motor atual como referência e dados legados legíveis. Não ativar mudanças dependentes de migrations em produção antes da validação isolada. Não presumir merge ou deploy autorizado por abrir um PR.

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

## Validação

Cada PR declara hipótese, aceitação e observação na preview. Executar testes proporcionais, tipos e build; banco/migrations apenas no ambiente isolado e provedores reais apenas em consultas limitadas. Avaliar adequação, interesse, surpresa útil, variedade, retornos, cobertura, latência e custo; score interno e permanência no app não provam qualidade.

Primeiro marco musical: descoberta próxima na interface existente, com razões sustentadas e feedback influenciando seleções seguintes. Comparação visual pode ocorrer em paralelo após a base de avaliação. A implementação das etapas seguintes será refinada pelos resultados comprovados, sem substituir esta referência por um roadmap independente.
