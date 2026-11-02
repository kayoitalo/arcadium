# Coleção na conta, memória e continuidade na Conversa

**Ampliação posterior no mesmo PR:** [retrato, memória editorial, exportação completa/exclusão, eventos e operação](portrait-editorial-operations.md). A autorização do proprietário passou a incluir a etapa 8 e outros blocos viáveis. As limitações descritas abaixo registram a primeira versão; exportação integral das revisões e exclusão por escopo foram acrescentadas na ampliação.

Base: master `def1f77`, com PR 16 confirmado como mergeado remotamente. O proprietário pediu reunir o máximo de ações no próximo PR. Este incremento agrupa coleção persistida, importação da lista local, memória paginada, exportações com escopo explícito, retomada por link, convites observados na Conversa e correção dos textos de dados nos Ajustes. Não há relato de aprovação manual deste novo incremento.

## Coleção e avaliações

`CollectionEntry` pertence à conta e guarda artista, título completo, ação, referência ao item de origem e datas. A chave única usa hash de uma tupla de artista/título com caixa e espaços externos normalizados; mantém acentos e qualificadores de versão. Não equivale a um identificador canônico de gravação.

Curti/guardo gravam a coleção na mesma transação de feedback/cursor. Escritas bloqueiam sessão e depois conta; importação/remoção bloqueiam só a conta. O limite de 200 é conferido no servidor sob o bloqueio. Uma coleção cheia impede uma nova entrada e seu avanço, mas permite atualizar uma existente. Repetir uma operação de feedback já concluída não reinsere uma entrada removida manualmente. Guardar continua separado de preferência; um save explícito pode coexistir com desagrado. Resposta negativa/retração não ressuscita uma entrada removida nem apaga uma escolha mais recente de outra sessão para a mesma faixa.

Remover da coleção não envia feedback negativo nem retira avaliação. Retirar/rever uma avaliação continua pelo fluxo existente na faixa. Não há backfill de curtidas históricas: isso poderia restaurar entradas que a pessoa já removeu.

`GET /api/collection` retorna até 200 entradas da conta; `DELETE` remove por artista/título na própria conta. `POST` importa, explicitamente, até 200 entradas antigas do navegador: verifica vínculo do item com uma sessão do proprietário e nomes/versão exatos. A conta prevalece sobre cópias locais duplicadas. Há uma inserção em lote, sem centenas de consultas por entrada. A confirmação inclui a identidade completa das entradas aceitas; só cópias locais correspondentes e ainda iguais são retiradas. Sobras por vínculo inválido, falta de espaço ou edição concorrente permanecem locais. Retry não duplica.

O navegador exibe o último snapshot válido quando uma atualização falha e oferece retry. A coleção é relida ao retornar à aba, recuperar conexão e receber um aviso `BroadcastChannel` da mesma conta; não há polling nem garantia de tempo real entre dispositivos. Respostas atrasadas não substituem uma requisição mais recente. A falha de atualização depois de um voto não tenta votar de novo: o dado já ficou no banco. Curti/guardo aguardam a carga inicial da coleção; pular e demais respostas continuam disponíveis.

## Memória e retomada

`/discovery/memory` apresenta buscas ativas da conta, nome/versão das indicações, motivos armazenados, exposição observada e registros de resposta com data, comentário, aspectos e referência à revisão. Esses registros são um diário; uma curtida antiga não é apresentada como preferência atual se houve revisão depois. Exposição não significa reprodução. As respostas modernas seguem ordem de revisão, com fallback temporal para o legado.

`GET /api/discovery-memory` usa cursor por criação/id, sem offset. Cada página tem até **cinco buscas**, **vinte indicações por busca** e **dez respostas recentes por indicação**. A consulta lê um registro extra para indicar continuidade. Total de indicações e existência de respostas anteriores são explícitos. Busca por artista/faixa (até 120 caracteres) e filtro de sessões com respostas usam dados locais, após confirmação; não consultam fontes musicais. Os filtros se combinam no nível da sessão.

O botão de retomada leva a `/discovery?session=...`: a página solicita RESUME da sessão indicada, com as verificações de propriedade existentes, sem gerar outra busca. Posição/respostas continuam preservadas e áudio não começa sozinho. A revisão atual pode ser feita no acordeão da faixa. `/discovery?collection=1` abre a coleção.

Na Conversa, um bloco separado das narrativas da IA lê o último caminho escolhido e a coleção. Oferece retomar, abrir a lista e consultar respostas sem atribuir gosto ou escuta inexistentes. A leitura antiga em cache não é reescrita com afirmações novas. Falhas e ausência de caminhos têm estados próprios. A memória conserva narrador/caneta, acordeões, teclado, foco explícito após busca/paginação, layout mobile e movimento reduzido.

## Exportação e limites

- `GET /api/collection?download=1`: cópia JSON da coleção inteira, limitada às 200 entradas permitidas.
- `GET /api/discovery-memory?...&download=1`: JSON **somente do recorte filtrado atual**, com limites e cursor seguinte. Não é exportação integral de todas as revisões. A interface nomeia esse escopo.
- A cópia anterior em `/api/user/data` continua trazendo até 5.000 reproduções recentes; agora distingue total observado no banco de quantidade exportada e indica o escopo. Ajustes dá acesso separado à memória e coleção.
- Ajustes deixa de chamar a limpeza de reproduções/conexões de “apagar tudo”: buscas, feedback, coleção e leituras já permaneciam fora dessa operação. Texto e confirmação passam a dizer isso explicitamente. Nenhuma exclusão real foi executada pelo agente.

Todos os endpoints exigem autenticação, origem confiável nas mutações e respostas privadas sem cache. Downloads com sessão expirada voltam ao login. Não há novos provedores, IA, workers, infraestrutura, dependências ou upload de histórico. Capa/prévia e exportação Spotify conservam os fluxos existentes. As novas operações consultam somente PostgreSQL.

A timeline ainda não reúne reprodução efetiva de prévias, exportações ou todas as revisões antigas numa única descarga. Exportação integral/paginada de revisões e exclusão global da memória permanecem pendentes. Curadoria de territórios, filtros estritos, álbuns em ordem e a evolução completa da Conversa/retrato também não são concluídos aqui.

## Migration e evidência

Migration `20261102000000_discovery_collection`: somente criação da tabela, chave estrangeira por usuário e índices. Sem alterar/remover tabelas anteriores, copiar histórico ou aplicar backfill. Cliente Prisma gerado e schema validado; diferença offline entre arquivos de schema confirmou apenas essa tabela/índices. Nenhuma migration foi aplicada manualmente contra banco real. O deploy existente precisa validá-la na preview isolada antes do merge para produção.

424 testes em 79 arquivos, tipos e build passaram. Casos incluem propriedade, origem de importação, cópias locais ilegíveis preservadas, limite, versão textual, replay, revisão, paginação determinística, limites de leitura, exportação parcial declarada e retorno ao login. Banco e provedores usam mocks: não certificam contenção/rollback no PostgreSQL real.

Runner `node scripts/evaluation/discovery-motion.browser.mjs`: sete grupos de cenários de escuta/coleção em desktop, mobile 390 px e movimento reduzido, incluindo importação parcial, retenção local mesmo com ID repetido e título diferente, falha/retry e remoção sem feedback negativo. `--memory`: quatro grupos nas mesmas configurações, cobrindo diário, retirada/comentários escapados, paginação, filtros/vazio/erro/retry, JSON e convite da Conversa. Os componentes e CSS são reais; respostas e áudio são simulados. Capturas usam as fontes locais do build, quando disponíveis, e ficam em `.local/evaluation/`, ignorada pelo Git. Não substituem revisão autenticada, escuta e concorrência reais.

## O que avaliar na preview

1. Conferir deploy/migration no PostgreSQL isolado. Curtir/guardar uma indicação; recarregar e abrir em outro dispositivo: a coleção deve acompanhar a conta.
2. Importar a lista antiga explicitamente. Duplicadas não devem substituir escolhas da conta; entradas não verificadas ou sem espaço ficam no navegador. Interromper/repetir a importação não perde nem duplica faixas.
3. Remover uma entrada e conferir que a avaliação continua. Repetir o mesmo voto antigo não deve repor a entrada; nova curtida explícita pode repô-la. Testar duas abas, cap de 200 e falha durante voto no PostgreSQL isolado.
4. Abrir caminhos e respostas: títulos/versões, motivo, comentários, aspectos e revisões. Buscar, filtrar, paginar e testar falha/retry sem geração ou exposição por leitura do diário.
5. Retomar pela memória e Conversa, inclusive uma sessão antiga e o mesmo item. Conferir posição, foco, caneta, áudio parado e continuidade após recarga.
6. Baixar coleção e recorte filtrado; conferir limites/cursor e isolamento da conta. Comparar total e quantidade na cópia de reproduções. Testar sessão expirada.
7. Conferir estados vazios, teclado, mobile, títulos longos e movimento reduzido. Ajustes deve informar corretamente o alcance da limpeza, sem executá-la para validar apenas a cópia.
