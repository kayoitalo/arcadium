# Próxima evolução — trabalho em revisão

Base: PR 13 mergeado. Este incremento separa mídia da criação da sessão híbrida. O frontend pede mídia apenas da indicação atual, sem autoplay, e ignora respostas de uma faixa que saiu da tela. Falha de rede oferece nova tentativa; ausência no catálogo é informada separadamente.

POST de mídia verifica conta, sessão e item antes das chamadas. A gravação deve manter artista/título/versão compatíveis. O salvamento bloqueia a sessão na mesma ordem das avaliações e preserva os demais componentes do item. Não muda cursor, ranking ou feedback. Reutilização de resultado e coalescência por processo reduzem consultas; não constituem reserva distribuída entre ambientes. Não há worker, fila externa nem migration nova.

O fluxo híbrido deixa de buscar oito prévias durante a geração. Cada item solicitado pode consultar Apple e, se faltar capa, Last.fm. Visitar todos os oito itens pode custar até oito consultas de cada fonte antes de cache, além do orçamento de geração. Falhas de áudio têm cooldown de 30 s; ausência confirmada, uma hora. Nenhum resultado é uma garantia permanente de cobertura.

## Visual e significado

A entrada passa a usar Fala, usePen e PenLayer do sistema, com grifo medido sobre o texto e redução de movimento. O texto de cada caminho explica sua relação com o repertório; durante a escuta, essa intenção permanece visível. Os controles atuais ainda são heurísticas de proximidade e popularidade. Exploração radical e seleção por mood não estão implementadas. A distinção musical entre as duas entradas ainda exige avaliação; a alteração visual não comprova qualidade musical.

## ListenBrainz: sondagem isolada

Fonte oficial: https://labs.api.listenbrainz.org/similar-recordings

O endpoint público por gravação foi confirmado no formulário oficial. Uma consulta ao MBID de exemplo da documentação retornou HTTP 200 e lista vazia. Isso confirma resposta do endpoint, não cobertura útil nem adequação ao gosto do proprietário.

`node scripts/evaluation/listenbrainz-probe.mjs <recording-mbid>` executa até três consultas explícitas, espaçadas, com timeout e interrupção em erro. Não lê banco, publica histórico ou salva payloads musicais completos. A saída contém somente contagens e métricas operacionais. A integração continua fora do motor padrão.

Uma segunda consulta pública, usando Roads / Portishead como referência do próprio site, retornou 100 linhas com o algoritmo `session_based_days_7500_session_300_contribution_5_threshold_15_limit_50_skip_30_top_n_listeners_1000`. O adaptador experimental valida gravação/referência, remove duplicações, limita a 20 candidatas e conserva score bruto separado. Não considera score uma probabilidade nem o soma ao Last.fm. Cache de uma hora, coalescência, espaçamento conservador e tratamento de limites reduzem chamadas. Filas são locais ao processo, sem garantia global entre ambientes.

Para avaliação manual na preview, habilitar `ARCADIUM_LISTENBRAINZ_EXPERIMENT=true` e fazer POST autenticado em `/api/recommendations/experiment` com `recordingMbid` e `baselineSessionId`. A conta precisa ser proprietária da sessão antes de qualquer consulta. A resposta traz candidatas e sobreposição textual com a sessão; isso não confirma identidade entre fontes nem mede preferência. A rota não altera a sessão nem publica escutas. Desativada por padrão e sem inclusão automática no motor.

Referências: [API e limites](https://listenbrainz.readthedocs.io/en/latest/users/api/index.html), [termos](https://listenbrainz.org/terms-of-service/) e [dataset público](https://labs.api.listenbrainz.org/similar-recordings). Licença aberta das escutas não transfere direitos sobre áudio ou capas. O experimento conserva apenas cache transitório de metadados e não copia áudio ou arte.

Ainda pendentes para adoção padrão: amostra representativa com cobertura brasileira, comparação de interesse/candidatas exclusivas/duplicadas/custo e revisão de condições específicas do dataset. Uma referência pública com resultados não conclui a etapa 5 nem justifica ativar a fonte por padrão.

## Revisão necessária

Testar preview com faixa sem mídia, retorno à sessão, falha temporária, troca rápida de faixa e duas abas. Confirmar que áudio nunca inicia sozinho e que posição/avaliações não mudam quando a mídia termina. Revisão visual no navegador ainda pendente.
