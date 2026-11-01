# Etapa 5 — avaliar antes de incorporar

Base: master `c501f22`, com o PR 14 mergeado. A validação manual relatada pelo proprietário cobriu mídia, continuidade e visual/mobile; não cobriu ListenBrainz. A fonte permanece opt-in, sem inclusão no ranking e sem publicar histórico.

## O que é a amostra

A [amostra pública](../scripts/evaluation/listenbrainz-sample.json) propõe doze referências para observar a fonte em situações diferentes: referências internacionais, música brasileira, sondas de cobertura e versões. Reaproveita os casos da base de avaliação; não é histórico pessoal nem curadoria aprovada para o produto. As categorias não medem popularidade. Antes de concluir sobre gravações populares/pouco populares, é necessário documentar uma medida de alcance e ampliar os grupos se preciso.

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

Uma única consulta pública Roads / Portishead nesta sessão retornou HTTP 200: 100 linhas válidas e únicas, vinte selecionadas, 1.558 ms observados. Foram iniciadas uma consulta ListenBrainz e uma consulta de identificação MusicBrainz; não houve consultas Last.fm, Apple ou IA nesta avaliação. As consultas documentais no navegador não estão incluídas nesses contadores de runners. [Métricas derivadas](../scripts/evaluation/listenbrainz.public-probe.json). Esse controle positivo confirma contrato e disponibilidade nessa execução; não conclui cobertura brasileira, adequação, interesse ou ganho personalizado.

O cache do adaptador mantém TTL de uma hora, agora remove expirados e limita a cem referências por processo, com descarte da mais antiga quando cheio. Requisições repetidas continuam coalescidas. Não há reserva de cota distribuída entre instâncias/ambientes; o limite de três é por execução manual, não uma licença para paralelizar lotes.

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

Após esses dados, registrar adoção limitada, nova avaliação ou descarte; não somar escalas dos provedores. Para intenções/jornadas, o próximo recorte é explicitar o contrato das três intenções e preservar pedido/continuidade entre passos. Exploração de outro universo precisa de portas de entrada fundamentadas e curadoria versionada aprovada; seleção de repertório não pode prometer mood estrito sem cobertura. Essa etapa continua pendente e não foi substituída por mais presets de proximidade.

## Condições e referências

A [documentação da API](https://listenbrainz.readthedocs.io/en/latest/users/api/index.html) informa espaçamento e cabeçalhos de cota e exige User-Agent com contato. O endpoint Labs é uma fonte distinta da API principal: as regras gerais não garantem SLA ou cota específica para ele. O [formulário do dataset](https://labs.api.listenbrainz.org/similar-recordings) confirma a consulta por gravação/algoritmo. Os [termos ListenBrainz](https://listenbrainz.org/terms-of-service/) descrevem a publicação de escutas/texto sob CC0, e a [página MetaBrainz](https://metabrainz.org/datasets) distingue dados principais e derivados. Isso não identifica sozinho condições específicas de toda derivação do Labs; a revisão continua necessária antes de adoção permanente. Não foram copiados áudio/capas, adotados descritores acústicos ou enviados dados de escuta.
