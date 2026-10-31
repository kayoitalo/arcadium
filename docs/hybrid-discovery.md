# Etapas 3 e 4 — primeira evolução musical completa

O proprietário escolheu reunir continuidade, feedback e motor musical no PR 13. O objetivo é avaliar uma experiência utilizável: sugestões influenciadas por histórico e avaliações, com retomada e justificativas rastreáveis na interface existente. Fontes novas, jornadas e reformulação visual ampla continuam fora desta entrega.

## Limitações confirmadas do motor anterior

- Perfil concentrado em um período, sem distinguir a base duradoura da fase recente; gêneros contavam artistas em vez das reproduções atribuídas a eles.
- Busca externa por artista; para cada um, somente a primeira faixa do topo era considerada.
- Limite por artista aplicado antes das exclusões. Se a primeira faixa já fosse conhecida, a alternativa desse artista já tinha sido descartada.
- Pontuação e narrativa podiam sugerir obscuridade sem dados de público e segurança de aceitação sem calibração.
- O feedback antigo podia afetar o artista inteiro. A etapa 3 corrige o escopo; a etapa 4 acrescenta uso explícito da faixa curtida como referência para novas candidatas.

## Perfil e referências

O perfil mantém duas distribuições separadas: todo o histórico importado e o período recente escolhido. O padrão recente é 30 dias; `7d` usa sete dias, `1y` usa um ano, e `all` mantém a base completa com uma janela recente de 30 dias. A mistura inicial usa 70% da base duradoura e 30% da fase recente, versionada como heurística, sem atribuir personalidade permanente.

Gêneros recebem contribuição proporcional às reproduções de cada artista; essa contribuição é dividida entre suas tags para não premiar quem tem mais classificações. A cobertura conhecida fica registrada e reduz o efeito da compatibilidade por gênero quando pouca escuta tem metadados: ausência de gênero não vira um perfil ou preferência fictícios. Metadados com homônimos presentes na consulta não são escolhidos arbitrariamente.

As referências alternam regiões do histórico e artistas distintos, procurando também regiões de gênero já documentadas. Até quatro faixas representam a fase recente, a base duradoura e curtidas explícitas. Uma rejeição não é usada como referência positiva. Curtir uma faixa pode alimentar `track.getSimilar`; não atribui automaticamente gosto por todo o artista nem altera os pesos de gênero como se fosse reprodução.

## Geração e composição

1. Reunir opções do catálogo local sem reduzir previamente a uma faixa por artista.
2. Buscar vizinhos de até três artistas de regiões do histórico e faixas semelhantes a até quatro referências.
3. Consultar até seis listas de três faixas: uma pode trazer outras músicas de um artista conhecido; as demais ampliam os vizinhos. Conferir o artista efetivamente retornado.
4. Acrescentar dados de público para até seis artistas. Os demais permanecem desconhecidos nessa dimensão.
5. Unir evidências da mesma faixa sem remover qualificadores de versão ou somar scores brutos dos provedores.
6. Aplicar conhecimento, rejeição específica, repetição recente e identidade antes do ranking e do limite por artista.
7. Ordenar pela compatibilidade documentada; somente depois compor uma indicação por artista e até oito faixas. Não ampliar o pedido silenciosamente para completar quantidade.

Similaridade por faixa é sinal específico daquela gravação textual; similaridade por artista continua sendo aproximação. Três faixas sem evidência individual distinta podem empatar: nesse caso a ordem do catálogo externo serve como desempate. Não se inventam diferenças de vocal, timbre, instrumentação, emoção, letra ou energia para explicar o desempate.

Uma revisita só entra com pelo menos três reproduções registradas e última reprodução há mais de 90 dias. É identificada como revisita, continua sujeita à rejeição/repetição e ocupa no máximo uma vaga que ficaria sem novidade elegível. Não substitui uma faixa inédita elegível para elevar score.

## Ranking, explicação e aprendizado

`v3-hybrid-1` usa pesos `hybrid-weights-1`; `scoring.ts` mantém pesos explícitos e componentes separados. A posição de cada relação na resposta é uma heurística de proximidade, não medição acústica nem probabilidade de gostar. O `match` bruto continua nas evidências com sua origem; não se presume uma escala comum para `artist.getSimilar` e `track.getSimilar`.

O ranking considera relações registradas, distribuição de gêneros, região do perfil, novidade, preferência explícita, metadados e controles existentes. Um dado de público ausente recebe tratamento neutro e não gera ponto de fama no mapa. O texto não o descreve como obscuro. Os modos continuam presets dos controles; exploração entre universos e filtros estritos de mood/gênero ficam para a etapa 6.

Cada item guarda sua candidata, evidências, componentes, versão, contexto resumido do perfil e diagnósticos do provedor no JSON existente. A API também entrega `evidence`, `isRevisit` e `sourceUrl` sem exigir que a interface interprete scores internos. A justificativa é determinística e aponta a relação real, com link para o Last.fm quando utilizado. Não há chamada nova de IA ou narrativa cultural sem fonte.

Uma curtida pode mudar candidatas de uma nova busca e a afinidade de relações que usam aquela faixa como referência. Descurtir ou retirar a preferência atualiza os efeitos futuros; reação a uma faixa não vira rejeição do artista, gênero, humor ou aspecto sonoro. Motivos opcionais continuam vinculados aos exemplos declarados.

A fila pode ser recalculada **sem chamadas externas** quando há relação explícita entre a faixa avaliada e candidatas ainda não apresentadas. Itens vistos, avaliados ou sem evidência suficiente não são reescritos. Identificadores e procedência da prévia permanecem; somente slots livres, scores e motivos ainda não apresentados podem mudar. Feedback, exposição e recomposição usam o mesmo bloqueio de sessão. Falha na recomposição não transforma uma avaliação já salva em erro de gravação. Nem toda avaliação precisa produzir alteração imediata na fila; buscar mais utiliza o estado vigente.

## Chamadas, falhas e configuração

| Fluxo frio | Teto próprio por geração |
| --- | --- |
| Last.fm: vizinhos de artista | 3 |
| Last.fm: faixas semelhantes | 4 |
| Last.fm: três opções por artista | 6 chamadas |
| Last.fm: dados de público | 6 |
| **Last.fm no híbrido** | **19 tentativas, antes de cache/coalescência** |
| Apple: prévias das finalistas | Até 8, na fila de catálogo existente |
| IA adicional | 0 |

Capas reutilizam a prévia Apple ou o catálogo local, sem mais chamadas Last.fm. O caminho anterior podia realizar 49 chamadas Last.fm no modo balanceado: cinco referências de artista, dezoito listas, dezoito consultas de público e oito capas. Esses são tetos do código, não consumo observado em produção nem cotas garantidas do provedor.

As consultas de descoberta Last.fm compartilham fila por processo, com intervalo próprio de 300 ms e uma requisição em execução; não há retry automático. O híbrido para de iniciar consultas após uma janela de 20 segundos; a requisição já em andamento tem timeout de seis segundos. Isso deixa espaço para a fila Apple dentro do limite da rota. Cache de seis horas e coalescência reduzem chamadas repetidas. Falha temporária não é cacheada como catálogo vazio; HTTP 429/5xx e erros 11/16/29 pausam a fila, respeitando `Retry-After` quando informado.

Diagnósticos contam tentativas efetivamente iniciadas pela instância, hits, coalescência, falhas e interrupções por prazo. Não incluem consultas de sincronização/enriquecimento feitas por outros adaptadores. A fila não é distribuída entre instâncias ou ambientes; não garante limite global por projeto/IP. Em caso de fonte indisponível, as candidatas locais suficientes continuam; o resultado pode ter menos faixas.

O padrão é `ARCADIUM_RECOMMENDATION_STRATEGY=hybrid` mesmo sem variável. `legacy` seleciona o controle da etapa 3, preservando a correção de escopo do feedback. Não roda os dois motores simultaneamente na preview. A comparação offline usa uma mesma entrada sintética; o controle original de pesos continua em `baseline.test.ts`. Sessões antigas permanecem legíveis, mas uma nova versão pede outra entrada para gerar novas sugestões.

## Avaliação reproduzível

Testes cobrem pesos por reprodução, separação temporal, curtidas como referências específicas, exclusão antes de diversidade, três alternativas por artista, orçamento de chamadas, popularidade desconhecida, versões distintas, revisitas justificadas e recomposição restrita aos itens não apresentados.

Para gerar o relatório sintético local no PowerShell:

```powershell
$env:ARCADIUM_DISCOVERY_REPORT = "true"
pnpm exec vitest run src/modules/recommendations/domain/discovery-comparison.test.ts
```

O resultado fica em `.next/discovery-comparison.json` e é exibido no terminal. Não contém histórico pessoal ou payloads de provedores. Usa os mesmos controles e candidatas para comparar o limite antecipado/ranking de controle com exclusão, ranking e composição híbridos.

Uma execução derivada está em [comparação sintética](../scripts/evaluation/discovery-comparison.synthetic.json). Também foi feita **uma única consulta pública** `track.getSimilar`, com limite de cinco resultados e referência fixa “Radiohead — Paranoid Android”: HTTP 200, cinco nomes de artista/faixa completos, sem erro da API; latência observada de 784 ms. Só [essas métricas derivadas](../scripts/evaluation/lastfm-track-similarity.public-probe.json) foram guardadas, sem chave, histórico pessoal ou payload musical completo. Isso confirma a disponibilidade do endpoint nessa execução, não cobertura geral, qualidade de recomendação ou latência na Vercel.

Na fixture, a alternativa inédita do mesmo artista volta a ser elegível; uma curtida numa referência muda a próxima escolha de `Control` para `Linked`, e sua retirada devolve `Control`. As escolhas respeitam exclusões e diversidade. **Isso demonstra mecanismo e invariantes; não mede aprovação, surpresa útil ou qualidade real de recomendação.** Não usar score interno como substituto dessas medidas.

Na preview, observar adequação, interesse explícito, repetição, origem das sugestões, variedade e tempo/custo para obter uma descoberta aprovada. Separar resultado imediato de retorno depois de dias. Ao comparar estratégias, manter o mesmo histórico, candidatas e controles; considerar também as exposições e avaliações anteriores para não confundir seus efeitos. Reavaliar pesos ou retirar fontes/mecanismos se não trouxerem contribuição identificável.

## Banco e próximos testes

A ampliação musical não acrescenta migration. Continua necessária a migration aditiva de sessões/feedback que já estava no PR 13; ela não foi executada pelo agente. Se já foi aplicada à cópia correta, não há uma segunda migration musical para aplicar. Seguir [preparação isolada](sessions-feedback.md) antes de avaliar o fluxo funcional, e coordenar produção separadamente.

Além dos cenários de continuidade: conferir recomendações de artistas conhecidos com faixas novas, novidades associadas a faixas curtidas, justificativas coerentes, ausência de alegações sonoras sem dados, comportamento sem fonte disponível, quantidade reduzida sem alargar escopo e tempo da primeira busca fria. Banco/índices/transações e música real continuam pendentes da preview, com cotas compartilhadas entre ambientes.

Referências técnicas consultadas: [Last.fm — track.getSimilar](https://www.last.fm/api/show/track.getSimilar), que documenta o sinal por escuta, parâmetro de autocorreção e resposta de match; [termos de uso da API](https://www.last.fm/api/tos), incluindo atribuição e links. A integração não fornece direito de áudio para análise; não foi adicionada extração de descritores.
