# Etapa 5 — avaliar antes de incorporar

Base: master `c501f22`, com o PR 14 mergeado. A validação manual relatada pelo proprietário cobriu mídia, continuidade e visual/mobile; não cobriu ListenBrainz. A fonte permanece opt-in, sem inclusão no ranking e sem publicar histórico.

## O que é a amostra

A [amostra pública](../scripts/evaluation/listenbrainz-sample.json) propõe doze referências e um controle canônico adicional para observar a fonte em situações diferentes: referências internacionais, música brasileira, sondas de cobertura e versões. Reaproveita os casos da base de avaliação; não é histórico pessoal nem curadoria aprovada para o produto. As categorias não medem popularidade. Antes de concluir sobre gravações populares/pouco populares, é necessário documentar uma medida de alcance e ampliar os grupos se preciso.

Cada referência precisa de um **MBID de gravação conferido**, com fonte e edição/performance documentadas. UUID válido não prova o tipo da entidade. Valores nulos permanecem pendentes; não consultar com identificadores de artista/lançamento ou escolher o primeiro resultado nominal. Um remaster pode reutilizar o MBID de gravação: registrar a edição separadamente, sem contabilizar duas consultas à mesma gravação como cobertura independente.

Em 01/11/2026 a primeira consulta pública de identificação ao MusicBrainz retornou HTTP 503. As páginas de catálogo também responderam 429; as consultas foram interrompidas. Os identificadores brasileiros e de versões não foram preenchidos por inferência. Isso é indisponibilidade na preparação da amostra, não evidência de catálogo vazio no ListenBrainz.

## Sondagem operacional

O runner e o adaptador agora compartilham algoritmo, validação de referência, deduplicação e teto de vinte candidatas. A sondagem anterior usava outro algoritmo; suas contagens não eram uma avaliação reproduzível do adaptador. O score bruto permanece separado e não é probabilidade de gostar.

Sem rede, a invocação padrão apenas mostra o plano:

```powershell
node scripts/evaluation/listenbrainz-probe.mjs 8a49dba0-253a-4535-b87f-78bb035336ce
```

Consulta explícita, no máximo três MBIDs distintos por execução:

```powershell
node scripts/evaluation/listenbrainz-probe.mjs --live 8a49dba0-253a-4535-b87f-78bb035336ce
```

Não executar lotes em paralelo ou repetir um lote após limitação. O runner é sequencial, aguarda 1,1 s entre consultas, usa timeout de dez segundos e interrompe em erro HTTP/rede/contrato ou cabeçalho de cota esgotada, sem retry. Não carrega `.env`, credenciais ou banco. A saída padrão contém contagens de linhas recebidas, inválidas, referência errada, autorreferência, duplicações e seleção efetiva. `--show-candidates` revela explicitamente até vinte metadados para inspeção; guardar essa saída apenas localmente, por exemplo em `.next/evaluation/`, sem versionar payloads musicais ou resultados pessoais.

Uma única consulta pública Roads / Portishead na primeira sondagem registrada retornou HTTP 200: 100 linhas válidas e únicas, vinte selecionadas, 1.558 ms observados. Nessa sondagem foram iniciadas uma consulta ListenBrainz e uma consulta de identificação MusicBrainz; não houve consultas Last.fm, Apple ou IA. As consultas documentais no navegador não estão incluídas nesses contadores de runners. [Métricas derivadas](../scripts/evaluation/listenbrainz.public-probe.json). Esse controle positivo confirma contrato e disponibilidade nessa execução; não conclui cobertura brasileira, adequação, interesse ou ganho personalizado.

O cache do adaptador mantém TTL de uma hora, agora remove expirados e limita a cem referências por processo, com descarte da mais antiga quando cheio. Requisições repetidas continuam coalescidas. Não há reserva de cota distribuída entre instâncias/ambientes; o limite de três é por execução manual, não uma licença para paralelizar lotes.

## Rodada pública de cobertura e versões — 01/11/2026

A indisponibilidade anterior do MusicBrainz não foi contornada com nomes inventados. Uma nova rodada utilizou o `recording-search` público do Labs, que retorna metadados MusicBrainz por busca potencialmente aproximada. Artista/título/lançamento foram conferidos nas duas sondas brasileiras. A consulta nominal do Nirvana trouxe estúdio, medley, covers e outras apresentações; seu primeiro resultado não foi tratado como a performance ao vivo pedida.

| Referência/controle | ListenBrainz | Last.fm por faixa | Interpretação limitada |
| --- | --- | --- | --- |
| Kaatayra — Inpariquipê | HTTP 200, zero linhas | Consulta bem-sucedida, zero candidatas | Sem relações nessas consultas por referência; não mede alcance do artista ou qualidade. |
| Sessa — Grandeza | HTTP 200, zero linhas | Consulta bem-sucedida, zero candidatas | Mesmo limite; não generalizar para o catálogo brasileiro. |
| About a Girl, identificador histórico do MTV Unplugged | HTTP 200, zero linhas | Não consultada como controle de versão | **Inconclusivo para cobertura da apresentação ao vivo:** exige considerar o mapeamento abaixo. |
| About a Girl, representante canônico com lançamento Bleach | HTTP 200, cem linhas, vinte selecionadas | Não consultada nesta rodada | Controle do agrupamento do provedor; não medição independente da versão de estúdio. |

O lookup por MBID recebeu `5a3c6008-0aad-4b44-97d2-800f49647dd2`, devolveu `d550b70a-31cd-4c23-a7c3-0f1488b84417` como identificador resolvido e `b2e623ea-378b-4479-bb75-fa202aacbfc9` como canônico, com metadados representativos de Bleach. A documentação oficial de [Canonical MusicBrainz data](https://musicbrainz.org/doc/Canonical_MusicBrainz_data) explica que a canonização pode agrupar variantes ao vivo, de estúdio e remasters. Identificadores canônicos também podem mudar entre dumps. Assim, esse caso não demonstra que a performance ao vivo tenha menos público ou que o serviço não possua escutas dela.

Não houve troca automática para o identificador canônico. A comparação de versões ficou explicitamente inconclusiva, e `case-11` continua sem uma referência liberada para o teste de identidade da performance. O controle canônico está separado. O contrato agora sinaliza `versionIdentityVerified: false`; a rota e os relatórios explicam que um MBID da fonte não autoriza presumir equivalência entre versões, escolher mídia ou transferir feedback.

Esta rodada iniciou dez consultas externas, sequenciais e sem retry: três buscas de identificação e um lookup por MBID no Labs, quatro de similaridade ListenBrainz e duas de similaridade Last.fm. Nenhuma falhou por HTTP/rede. As buscas de similaridade duraram entre 261 e 915 ms nessa execução, além do espaçamento; isso não estima latência de produção nem custo por descoberta aprovada. Não houve Apple, IA, acesso ao banco ou upload de escutas. [Relatório público derivado](../scripts/evaluation/listenbrainz-coverage.public-probe.json), sem candidatas completas nem avaliações pessoais.

**Decisão deste incremento:** adiar incorporação ao ranking padrão, mantendo o experimento opt-in. Há lacunas nas sondas consultadas e uma diferença de semântica de identidade a resolver. Isso não determina retirar a fonte nem impede trabalhar nas intenções/jornadas com as fontes atuais; uma adoção futura continua exigindo avaliação representativa e comparação com o motor completo.

## Comparação e escuta na preview

Usar a preview isolada existente, sem rodar simultaneamente os dois motores. Habilitar temporariamente `ARCADIUM_LISTENBRAINZ_EXPERIMENT=true` apenas na preview. Para uma sessão da própria conta, fazer o POST autenticado já existente em `/api/recommendations/experiment`, com `recordingMbid` conferido e `baselineSessionId`. Autenticação, origem e propriedade precedem a consulta externa; a rota não altera a sessão.

Salvar o JSON da resposta localmente em `.next/evaluation/`, junto das anotações da referência, intenção/controles e momento da comparação. A sessão precisa representar a mesma intenção e o repertório relevante; a mera existência de uma sessão não prova equivalência entre os experimentos. O relatório compara as candidatas com as finalistas dessa sessão, não com todo o conjunto de candidatas que o motor descartou.

Para cada candidata efetivamente experimentada, pode-se acrescentar ao objeto um campo `review`:

```json
{
  "review": {
    "adequacy": "fits",
    "interest": "interested",
    "usefulSurprise": "unreviewed"
  }
}
```

Valores: `adequacy` = `fits`, `misses` ou `unreviewed`; `interest` = `interested`, `not_interested` ou `not_heard`; `usefulSurprise` = `yes`, `no` ou `unreviewed`. Interesse pode representar curiosidade; não é automaticamente aprovação musical ou adequação. Não preencher avaliações pelo score nem pela ausência de resposta.

Resumo offline, sem banco/rede:

```powershell
node scripts/evaluation/listenbrainz-assess.mjs .next/evaluation/experiment.json
```

O resumo mantém denominadores separados para cada julgamento, recusa snapshots inconsistentes/duplicados ou de outro algoritmo e omite o ID da sessão. Não encontrar o mesmo texto na sessão significa **sem sobreposição textual observada**, não gravação inédita, identidade confirmada ou contribuição exclusiva. Aliases e versões exigem inspeção; medir ganho exclusivo requer comparar também as candidatas do controle, além das oito finalistas.

## Decisão e próximo trabalho

**Decisão atual: continuar experimental e desligado por padrão.** Ainda faltam MBIDs verificados dos demais estratos, cobertura por grupo, baseline comparável, revisão de versões, julgamentos musicais explícitos e custo por descoberta considerada útil. O conjunto proposto não deve ser descrito como avaliação representativa concluída. Ausência de mídia não é desagrado.

A decisão de adiar adoção permite seguir intenções/jornadas com as fontes atuais, sem somar escalas dos provedores ou alegar conclusão de qualidade representativa. O próximo recorte é explicitar o contrato das três intenções e preservar pedido/continuidade entre passos. Exploração de outro universo precisa de portas de entrada fundamentadas e curadoria versionada aprovada; seleção de repertório não pode prometer mood estrito sem cobertura. Essa etapa continua pendente e não foi substituída por mais presets de proximidade.

## Condições e referências

A [documentação da API](https://listenbrainz.readthedocs.io/en/latest/users/api/index.html) informa espaçamento e cabeçalhos de cota e exige User-Agent com contato. O endpoint Labs é uma fonte distinta da API principal: as regras gerais não garantem SLA ou cota específica para ele. O [formulário do dataset](https://labs.api.listenbrainz.org/similar-recordings) confirma a consulta por gravação/algoritmo. Os [termos ListenBrainz](https://listenbrainz.org/terms-of-service/) descrevem a publicação de escutas/texto sob CC0, e a [página MetaBrainz](https://metabrainz.org/datasets) distingue dados principais e derivados. Isso não identifica sozinho condições específicas de toda derivação do Labs; a revisão continua necessária antes de adoção permanente. Não foram copiados áudio/capas, adotados descritores acústicos ou enviados dados de escuta.
