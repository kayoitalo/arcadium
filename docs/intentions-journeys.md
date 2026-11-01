# Intenções, aprofundamento e caminhos anteriores

Base: master `4c1aa4f`, após merge do PR 15 e aprovação manual relatada pelo proprietário. Por solicitação do proprietário, este PR combina um recorte funcional da etapa 6 com sua interface e navegação da etapa 7. Não conclui integralmente essas etapas.

Hipótese: separar descoberta de repertório conhecido e permitir aprofundar uma faixa explicitamente escolhida torna a exploração mais útil do que depender apenas dos presets do mapa. Cada busca preserva sua intenção e pode continuar como um passo de um caminho, sem apagar os anteriores.

## O que chega à interface

- **Perto do que eu gosto** e **Outras conexões** continuam procurando novidades no motor híbrido, com os presets de proximidade existentes. Outras conexões não promete outro gênero ou exploração radical.
- **Do meu repertório** seleciona faixas com reproduções registradas no histórico da conta. Faixa conhecida passa a ser elegível nesse objetivo; rejeição específica e exposição recente continuam sendo respeitadas. A explicação informa a contagem observada, sem inventar aprovação, emoção ou contexto sonoro. Não é filtro de mood nem seleção por instrumentação.
- **Buscar novidades a partir desta faixa** abre uma sessão nova vinculada ao passo atual. A referência é o item da sessão do proprietário, com artista/título/versão textual preservados. Consultam-se apenas relações daquela faixa; fonte vazia resulta em menos indicações ou lista vazia, sem completar a busca com referências alheias. O pedido explícito mantém a relação explicável mesmo se uma preferência anterior pela referência tiver sido negativa, sem reescrever essa preferência.
- **Voltar ao passo anterior** retoma a sessão anterior com sua posição e respostas. Aprofundar não curte, marca curiosidade, guarda ou avança a sessão original automaticamente.
- **Caminhos anteriores** carrega, ao ser aberto, até vinte buscas ativas recentes da própria conta, agrupadas pela raiz do caminho e ordenadas cronologicamente dentro do grupo. Quando a raiz ficou fora da janela, apresenta apenas o trecho recente, sem inventar a origem. Cada passo pode ser retomado sem geração musical. Não é uma timeline completa de reproduções, exportações ou ações.

Uma seleção de repertório pode iniciar uma descoberta a partir de uma de suas faixas; o botão declara essa troca de objetivo. Ajustes de proximidade/público ficam nos caminhos de descoberta. A interface mantém narrador/caneta, apresentação de uma faixa por vez, aprofundamentos opcionais e ausência de autoplay.

O proprietário autorizou acrescentar neste mesmo PR o acabamento de movimento e navegação: transição curta entre faixas, expansão suave dos quatro painéis, foco/caneta/exposição sincronizados, posição atual no histórico e lista preservada em erro de atualização. Ver [fluidez e cenários de revisão](discovery-motion.md).

## Contrato e continuidade

`intent` aceita `DISCOVER`, `CONNECTIONS` e `REPERTOIRE`. Os dois primeiros preservam a base musical existente; `REPERTOIRE` usa somente dados locais de reprodução. A intenção fica separada de modo/contexto, controles e preferência musical.

`POST /api/recommendations` acrescenta `DEEPEN`, com `sessionId`, `sourceItemId` e `requestKey` obrigatórios. Conta, estado da sessão e pertencimento do item são verificados antes de qualquer chamada de provedor. O cliente não escolhe livremente os nomes da referência nem os IDs da linhagem. O perfil e os controles/período da sessão de origem são preservados no aprofundamento.

Uma coluna JSON anulável, `RecommendationSession.discoveryContext`, guarda versão do contrato, intenção e metadados da jornada. `NEW_ENTRY` inicia uma raiz; `MORE` preserva intenção e referência, acrescentando um passo; `DEEPEN` registra a indicação escolhida como referência do novo passo. Retomar não modifica esses metadados. Uma segunda coluna anulável, `lastOpenedAt`, guarda a última escolha explícita de navegação, para recarregar manter também um caminho antigo que a pessoa retomou. Atualizações desse marcador são monotônicas e não mudam cursor ou avaliações; geração usa o horário de entrada da operação, sem promover uma resposta antiga só porque terminou mais tarde. Identificadores de operação/fingerprints incluem o novo contexto, impedindo reutilizar a mesma chave para outro pedido. Repetir uma requisição concluída reutiliza o resultado; uma geração concorrente conserva o conflito e a reserva já existentes.

Sessões antigas mantêm intenção/linhagem desconhecidas, sem inferi-las do mapa. Continuam legíveis e retomáveis. O híbrido passa a `v3-hybrid-3`, mantendo `hybrid-weights-1`; `MORE` em uma versão anterior pede outra entrada, conforme o contrato existente. Uma indicação antiga da própria conta pode iniciar um novo aprofundamento. O controle `legacy` continua disponível para busca/retomada anterior e recusa repertório/aprofundamento explicitamente, em vez de simular suporte.

`GET /api/recommendations?history=1` retorna o histórico resumido, autenticado, com `private, no-store`. A listagem não conta exposição nem consulta provedores musicais. O GET de sessão usado pela retomada preserva os estados vigentes de feedback. Os registros seguem vinculados à conta; gestão/exportação completa da memória e coleção entre dispositivos continuam para a etapa correspondente.

## Chamadas e infraestrutura

Não há IA nova, ListenBrainz no ranking, worker, fila externa, banco adicional ou nova dependência. A geração híbrida normal mantém o orçamento anterior. Um aprofundamento substitui as famílias de referências por uma única consulta de similaridade por faixa e até seis consultas de público: no máximo sete tentativas lógicas, com cache/fila/janela existentes. Ausência de relações não aciona busca de artista, catálogo ou preenchimento genérico.

Gerar repertório não consulta fontes musicais; usa o perfil/histórico que o serviço já lê. Capa/prévia continuam resolvidas pelo fluxo autenticado por item quando a indicação fica em uso, com as mesmas regras de identidade e limites. Portanto, geração local não significa custo externo zero para toda a escuta.

Como a referência única foi escolhida explicitamente no aprofundamento, ela pode sustentar a sessão inteira; o limite de um artista por sessão é mantido. O limite de referências do fluxo geral permanece inalterado. Exclusões continuam antes da composição. Resultados curtos não ampliam o pedido.

## Migration e validação

Migration `20261101000000_discovery_journeys`: apenas `ADD COLUMN discoveryContext JSONB` e `ADD COLUMN lastOpenedAt TIMESTAMP(3)`, ambas anuláveis, sem backfill, alteração de pesos ou transferência de avaliações antigas. Cliente gerado, schema validado e diferença offline conferida: somente essas duas colunas. Nenhuma migration foi aplicada pelo agente em banco real deste incremento. No deploy, o fluxo aprovado do PR 15 compila primeiro e aplica migrations antes de publicar; a preview continua exigindo o banco isolado. Validar a migration e o fluxo na preview antes do merge de produção.

Testes cobrem repertório conhecido sem geração externa, rejeição/exposição ainda respeitadas, referência exata, orçamento de sete chamadas, fonte vazia, autorização/membro da sessão, preservação da posição original, idempotência, linhagem de MORE/DEEPEN/NEW_ENTRY, legado sem intenção inventada e histórico por proprietário. Banco/provedores são simulados nesses testes; não certificam concorrência PostgreSQL real.

Validação local após o acabamento de movimento: 404 testes em 74 arquivos, tipos e build passaram. O runner de navegador passou seis grupos de cenários em cada configuração (desktop, mobile e movimento reduzido), além de Enter/Espaço nativos no mapa. Respostas e áudio são simulados; o fluxo autenticado, a migration no PostgreSQL isolado e a escuta real continuam para revisão na preview.

As fixtures usam os componentes/CSS/fontes reais, dados fictícios e nenhum banco/áudio/API. Foram inspecionadas capturas desktop e dentro de iframe de 390 px no Chrome headless, incluindo três entradas e histórico de caminho. É QA de layout estático; caneta animada, teclado, reprodução e navegação real continuam para a preview.

## Roteiro de revisão na preview

1. Conferir nos logs o build e a aplicação da migration no banco isolado. Abrir Descoberta deve recuperar estado sem iniciar geração ou áudio.
2. Escolher **Do meu repertório**: conferir faixas do histórico e motivos baseados em reproduções; nada é apresentado como descoberta inédita. Ausência de cobertura local oferece outro caminho.
3. Na indicação de uma busca, usar **buscar novidades a partir desta faixa**. Conferir o nome/versão da referência no topo, nova sessão e motivos relativos à referência. Pode haver lista curta/vazia.
4. Usar **voltar ao passo anterior** e conferir posição e respostas originais. Uma nova busca não deve inventar curtida/curiosidade pela referência.
5. Abrir **Caminhos anteriores**, retomar outro passo e recarregar/navegar para outra página. Conferir persistência, isolamento da conta, mobile, foco/teclado, títulos longos e ausência de autoplay.
6. Testar repetição da requisição e duas abas: sem sessão duplicada para a mesma chave, avanço indevido ou sobrescrita da sessão original. Registrar qualquer diferença observada no PostgreSQL da cópia.
7. Seguir o [roteiro de movimento e acessibilidade](discovery-motion.md): troca curta de faixa, caneta/foco corretos, painéis e histórico, retomada do mesmo item, falha de rede sem avanço, cliques rápidos, ausência de autoplay e movimento reduzido.

Portas de entrada por território com curadoria aprovada, seleção estrita por mood/gênero, jornadas de álbum em ordem, coleção na conta e timeline completa permanecem pendentes. Não foram substituídas por promessas nos textos desta interface.
