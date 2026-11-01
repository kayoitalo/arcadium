# Continuidade do Arcadium

Atualizado em 01/11/2026. Este registro recupera na base atual a continuidade do PR 14 que existia apenas na revisão permanente `da2055a9805ff6d39bdcac1d1211c80bde19c229`.

## Estado confirmado

- PRs 11–14 mergeados. Esta continuação começou numa cópia limpa da master `c501f22` no workspace do chat; a pasta original renomeada `Arcadium`, suas alterações locais e dependências foram preservadas.
- O proprietário relatou aprovação dos testes manuais de mídia, continuidade e visual/mobile do PR 14. Isso não incluiu o ListenBrainz nem uma medição quantitativa de qualidade musical.
- ListenBrainz continua desligado por padrão e fora do ranking. Runner e adaptador agora compartilham contrato/algoritmo; cache limitado; sondagem pública e avaliação offline documentadas em [avaliação](listenbrainz-evaluation.md).
- A preparação dos identificadores representativos ficou incompleta por HTTP 503/429 do MusicBrainz. Não confundir isso com cobertura vazia no ListenBrainz. O controle Roads retornou cem linhas válidas, vinte selecionadas, em uma consulta; não comprova qualidade personalizada.
- Após erro `DISCOVERY_MIGRATION_REQUIRED` relatado em produção e confirmação do destino pelo proprietário, foi aplicada a única migration pendente, `20261030040000_discovery_sessions_feedback`. `migrate status` confirmou as dez em dia. Não foi aplicada migration nova nem acessada a cópia de preview nesta sessão.
- A pedido do proprietário, foi preparada configuração versionada para aplicar migrations após build bem-sucedido nos deploys Vercel, preservando o guard de preview. Conferir estado desta branch/PR antes de afirmar que essa configuração já está publicada. Ver [deploy e migrations](deployment-migrations.md).
- Validação local desta continuação: 386 testes em 72 arquivos, tipos e build passaram. Build comum não executou migrations; testes usaram mocks para banco e provedores.

## Próximos trabalhos

1. Conferir PR/branch e checks atuais, sem presumir merge ou deploy. Na Vercel, observar `build:deploy` e o destino isolado da preview; o painel remoto não foi alterado nesta sessão.
2. Completar a [amostra pública](../scripts/evaluation/listenbrainz-sample.json) com gravações verificadas quando o catálogo estiver disponível, sem retries após limitação. Popularidade dos grupos ainda não foi medida.
3. Avaliar cobertura brasileira/versões, sobreposição com controle comparável, interesse explícito, surpresa útil e custo. Não somar scores nem chamar diferença textual de contribuição exclusiva. O runner offline não substitui escuta.
4. Só então decidir sobre adoção do ListenBrainz e avançar intenções/jornadas: descoberta próxima, exploração progressiva e seleção de repertório. Hoje as entradas continuam presets de proximidade/popularidade; não implementam exploração radical ou mood estrito.
5. Seguir coleção na conta/timeline, conversa/retrato, contexto fundamentado e consolidação conforme [plano](evolution-plan.md), refinando pelos resultados.

## Limites preservados

Narrador/caneta, monólito modular e PostgreSQL. Sem contratação, IA adicional/paga, worker/fila externa, banco vetorial, upload ListenBrainz ou análise acústica ampla. Cotas/cache/filas continuam por processo, sem garantia distribuída entre ambientes. Preview nunca usa produção por fallback. Não copiar `.env`, payloads musicais completos ou resultados pessoais para o Git. Identidade incerta não vira gravação confirmada; avaliações de faixa não bloqueiam automaticamente artista/gênero.

Ler também [mídia e exploração](discovery-continuity-next.md), [motor híbrido](hybrid-discovery.md), [sessões e feedback](sessions-feedback.md) e [visão](brainstorm-evolucao-arcadium.md). O brainstorm é histórico; as autorizações posteriores do plano e desta sessão prevalecem sobre o antigo escopo apenas documental.
