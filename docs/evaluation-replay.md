# Avaliação pareada e narrativa com fontes

04/11/2026. A referência desta rodada é o motor híbrido que estava na master após o PR 17, `v3-hybrid-3@6a9799c`, não o antigo motor `legacy`.

## Reprodução sem chamadas

`pnpm exec vitest run --config scripts/evaluation/replay.config.mts` executa a fixture sintética de descoberta e prepara a comparação narrativa. Resultados ficam em `.local/evaluation/`, ignorada pelo Git e preservada entre builds. Não há SDK, credencial de provedor ou acesso a histórico.

O motor de controle tem snapshots de ranking, composição e elegibilidade extraídos do commit de origem, com manifest/hashes verificáveis em `src/modules/recommendations/evaluation`. O hash usa UTF-8/LF, normalizando CRLF no checkout Windows. Pesos/perfis/presets e cálculo de público estão congelados no snapshot de ranking. Tipos e utilitário de chave de feedback são compartilhados; mudanças nesses contratos exigem revisão do controle. O tratamento usa as funções atuais e o recorte de destino.

Uma entrada contém versão, origem `SYNTHETIC` ou `OBSERVED_SNAPSHOT`, data, pedido, perfil reduzido e pools pareados. A fixture não é o motor online completo: geração e rede são representadas pelos pools fornecidos. Para comparar fontes reais, capturar ambos os pools sob condições equivalentes, com procedência, sem publicar histórico/payloads pessoais. `ARCADIUM_EVALUATION_INPUT` seleciona um arquivo local. A validação recusa contratos inválidos e julgamentos duplicados; o hash identifica a entrada efetivamente normalizada.

| Medida | O que é calculado | O que não é inferido |
| --- | --- | --- |
| Adequação | Aderência estrutural ao destino, mais taxa de julgamento humano explícito quando presente. | Score ou tag de artista não provam adequação musical de cada gravação. |
| Interesse | Somente julgamento explícito, denominador julgado e pendentes. | Tempo no app, clique e play não viram interesse automaticamente. |
| Surpresa útil | Somente julgamento explícito separado. | Artista sem reprodução é apenas novidade observada, não surpresa útil. |
| Diversidade | Razão de artistas distintos e contagem de gêneros conhecidos. | Metadado ausente não conta como novo gênero. |
| Cobertura | Selecionados/pedido e candidatos/elegíveis. | Lista curta não vira pedido satisfeito. |
| Latência | Tempo local do replay separado de `endToEndMs` observado, ou `null`. | Replay síncrono não simula fila, cache, rede ou instância fria. |
| Consumo | Tentativas e tokens informados por instrumentação, ou `null`. | Teto configurado não é consumo; ausência de medição não é zero. |

Exposição, início de prévia, apreciação e escuta completa continuam sendo eventos/declarações distintos. O avaliador não reconstrói nenhum deles a partir da lista selecionada. Não calcula causalidade ou aceitação longitudinal. As observações públicas anteriores de ListenBrainz continuam separadas; ele não entra em nenhum pool padrão ou ranking.

## Lite/Flash sem orçamento adicional

A fixture narrativa usa os nomes dos modelos como rótulos de comparação. `ARCADIUM_NARRATIVE_INPUT` aceita evidências públicas observadas ou sintéticas, cada uma com ID, fonte, data e escopo de artista, álbum, música, entrada de faixa ou crédito de gravação. Um crédito de gravação requer a fonte editorial e o link Apple com o ID da faixa na coleção aprovada.

O preparo gera um prompt idêntico, versão/hash e ordem A/B estável. O mapa dos modelos fica separado no arquivo de preparo. **Nenhuma geração é iniciada**. Respostas previamente obtidas dentro dos controles/orçamento existentes podem ser fornecidas em `ARCADIUM_NARRATIVE_OUTPUTS` (`A`/`B`). O runner verifica formato, IDs e preservação de escopo; revisão humana continua obrigatória, pois citar uma fonte não prova que o texto decorre dela.

Rubrica: sustentação factual por bloco, escopo preservado, clareza/voz, utilidade após escuta e preferência cega. Consumo/latência reais precisam dos registros de tentativa/tokens, sem somar novamente o pacote lógico. Não há resultado qualitativo Lite/Flash nem vencedor nesta entrega. Sem evidência suficiente, usar as pistas determinísticas e o contexto atribuído já disponíveis.

### Observação pública da edição de Cartola

No PowerShell, execute `$env:ARCADIUM_CURATED_LIVE='1'; pnpm run evaluate:replay` e remova a variável com `Remove-Item Env:ARCADIUM_CURATED_LIVE` depois. A execução normal pula a consulta externa. A opção ao vivo faz um lookup da coleção brasileira via adaptador do app e grava `.local/evaluation/curation-cartola.json`. Na consulta de 05/11/2026 (horário de Brasília), o adaptador confirmou a ordem das 12 faixas, 12 links de prévia e quatro casos com crédito de gravação. O tempo registrado é de uma consulta de catálogo. O ensaio não toca áudio nem usa conta, banco ou IA. [Edição consultada](https://music.apple.com/br/album/cartola-1976/1444042772) · [Fonte dos créditos](https://www.universalmusic.com.br/2026/03/04/a-janela-de-cartola/)

Cada entrada em `cases` contém um `input` reproduzível e o `prepared` com o prompt e o mapa cego. Para reproduzir um caso sem rede, salve seu `input` em um JSON local e passe o caminho em `ARCADIUM_NARRATIVE_INPUT`. Use `ARCADIUM_NARRATIVE_OUTPUTS` somente se já houver respostas A/B. A observação pública mede cobertura e latência do catálogo dessa edição. O parecer do proprietário sobre a porta é um registro editorial, separado de comparações pareadas, julgamentos por faixa, desempenho dos modelos e medições longitudinais.

## PostgreSQL isolado

`node scripts/evaluation/postgres-isolated.mjs` exige `ARCADIUM_TEST_DATABASE_URL`, `ARCADIUM_TEST_DATABASE_FINGERPRINT` e `ARCADIUM_TEST_DATABASE_CONFIRMED=preview`. O fingerprint é calculado **a partir do endpoint conferido independentemente** usando `databaseFingerprint`, sem credenciais no hash; uma URL diferente, colisão com `DATABASE_URL` ambiente ou produção conhecida é recusada. Não calcular a allowlist cegamente da própria URL que será testada. Na rodada atual, o proprietário confirmou o endpoint e a captura mostrou a branch preview correspondente.

O runner usa conexão direta da mesma identidade Neon para preservar `search_path`, cria somente um schema aleatório com prefixo/forma estritos, aplica migrations versionadas nele e executa serviços reais com Prisma/PostgreSQL. Não usa o schema público da cópia. Remoção recursiva no banco é limitada a esse schema criado pelo runner; o guard recusa `public` e nomes fora do formato. Falha de limpeza deve ser tratada como falha de execução, nunca como autorização de remover outro alvo.

`postgres-report.json` contém tempos e contagem de consultas por cenário. `postgres-explain.json` contém planos com IDs sintéticos. Na rodada de Cartola passaram sete cenários em PostgreSQL real com dados sintéticos, incluindo plano com 5.000 sessões, replay idempotente da jornada e procedência no diário da conta correta. As migrations existentes aplicaram sem drift em um schema descartável. O ensaio mede esse ambiente e essa carga. O deploy da preview mantém a execução das migrations após o build.
