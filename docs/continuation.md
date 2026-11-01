# Continuidade do Arcadium

Atualizado em 01/11/2026. Este registro recupera na base atual a continuidade do PR 14 que existia apenas na revisão permanente `da2055a9805ff6d39bdcac1d1211c80bde19c229`.

## Estado confirmado

- PRs 11–14 mergeados. Esta continuação começou numa cópia limpa da master `c501f22` no workspace do chat; a pasta original renomeada `Arcadium`, suas alterações locais e dependências foram preservadas.
- O proprietário relatou aprovação dos testes manuais de mídia, continuidade e visual/mobile do PR 14. Isso não incluiu o ListenBrainz nem uma medição quantitativa de qualidade musical.
- ListenBrainz continua desligado por padrão e fora do ranking. Runner e adaptador agora compartilham contrato/algoritmo; cache limitado; sondagem pública e avaliação offline documentadas em [avaliação](listenbrainz-evaluation.md).
- Rodada pública seguinte: Kaatayra/Inpariquipê e Sessa/Grandeza sem relações tanto no ListenBrainz quanto no controle por faixa Last.fm. About a Girl revelou mapeamento de identificador histórico para grupo canônico que agrega versões; o teste ao vivo é inconclusivo. Dez consultas controladas e [métricas derivadas públicas](../scripts/evaluation/listenbrainz-coverage.public-probe.json). Não usar listas vazias como medida de popularidade. O contrato explicita identidade de versão não verificada.
- A preparação dos identificadores representativos ficou incompleta por HTTP 503/429 do MusicBrainz. Não confundir isso com cobertura vazia no ListenBrainz. O controle Roads retornou cem linhas válidas, vinte selecionadas, em uma consulta; não comprova qualidade personalizada.
- Após erro `DISCOVERY_MIGRATION_REQUIRED` relatado em produção e confirmação do destino pelo proprietário, foi aplicada a única migration pendente, `20261030040000_discovery_sessions_feedback`. `migrate status` confirmou as dez em dia. Não foi aplicada migration nova nem acessada a cópia de preview nesta sessão.
- A pedido do proprietário, foi preparada configuração versionada para aplicar migrations após build bem-sucedido nos deploys Vercel, preservando o guard de preview. Conferir estado desta branch/PR antes de afirmar que essa configuração já está publicada. Ver [deploy e migrations](deployment-migrations.md).
- Validação local após a rodada de cobertura/canonização: 387 testes em 72 arquivos, tipos e build passaram. Build comum não executou migrations; testes usaram mocks para banco e provedores.

## Próximos trabalhos

1. Conferir PR/branch e checks atuais, sem presumir merge ou deploy. Na Vercel, observar `build:deploy` e o destino isolado da preview; o painel remoto não foi alterado nesta sessão.
2. A decisão desta rodada é adiar incorporação do ListenBrainz ao ranking padrão; manter opt-in. Para adoção futura, completar a [amostra pública](../scripts/evaluation/listenbrainz-sample.json) e resolver a semântica de grupos canônicos/versões. Popularidade dos grupos ainda não foi medida; o controle de versão segue inconclusivo.
3. Julgamentos pessoais de escuta e comparações com referências indicadas na conversa permanecem apenas nos arquivos locais ignorados `.next/evaluation/`; não foram publicados no PR, sincronizados com produção ou generalizados para artistas/gêneros. Comparações locais por uma referência não são o motor completo.
4. Avançar intenções/jornadas com as fontes atuais: descoberta próxima, exploração progressiva e seleção de repertório. Hoje as entradas continuam presets de proximidade/popularidade; não implementam exploração radical ou mood estrito. A adoção futura de outra fonte não é pré-requisito para esse contrato de produto.
5. Seguir coleção na conta/timeline, conversa/retrato, contexto fundamentado e consolidação conforme [plano](evolution-plan.md), refinando pelos resultados.

## Limites preservados

Narrador/caneta, monólito modular e PostgreSQL. Sem contratação, IA adicional/paga, worker/fila externa, banco vetorial, upload ListenBrainz ou análise acústica ampla. Cotas/cache/filas continuam por processo, sem garantia distribuída entre ambientes. Preview nunca usa produção por fallback. Não copiar `.env`, payloads musicais completos ou resultados pessoais para o Git. Identidade incerta não vira gravação confirmada; avaliações de faixa não bloqueiam automaticamente artista/gênero.

Ler também [mídia e exploração](discovery-continuity-next.md), [motor híbrido](hybrid-discovery.md), [sessões e feedback](sessions-feedback.md) e [visão](brainstorm-evolucao-arcadium.md). O brainstorm é histórico; as autorizações posteriores do plano e desta sessão prevalecem sobre o antigo escopo apenas documental.
