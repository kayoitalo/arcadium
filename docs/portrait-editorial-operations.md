# Ampliação do PR 17: retrato, conversa, memória e operação

Em 02/11/2026, o proprietário autorizou ampliar bastante o mesmo PR, incluindo a etapa 8 e outras entregas possíveis, sem restringir seu tamanho. Esta entrega implementa o retrato observado, a memória editorial na conta e a gestão completa da memória de descobertas; acrescenta contagem/reserva de tentativas de IA e diagnóstico local. Não declara o plano inteiro concluído.

O mesmo PR recebeu depois [álbuns em ordem e contexto com fonte](albums-sourced-context.md), sem migration adicional. O documento contém contrato, limites e roteiro específico.

A revisão visual posterior está no [caderno de escuta](interface-caderno.md): quatro áreas, coleção/exportação separadas, presença desenhada do amigo, retrato interativo e resultados de versão junto ao álbum escolhido. O roteiro headless passou a incluir também 1920 px.

## Conversa e retrato — etapa 8

- **Teu retrato** (`/portrait`) separa a visão acumulada da fase recente. Consulta somente o PostgreSQL, com leitura consistente `RepeatableRead`: total de reproduções importadas, até vinte artistas com contagem e dias distintos observados, e doze destaques recentes comparando dois períodos contíguos de trinta dias. Datas futuras são excluídas. Dias usam a conversão explícita de timestamp UTC do banco para o fuso da conta; fuso inválido usa São Paulo. Não é uma medida da vida musical inteira nem inferência de emoção, desinteresse ou primeira descoberta.
- Cada artista leva ao histórico já filtrado; o retrato também dá acesso à memória das descobertas. A nova entrada aparece na navegação principal. Não há IA nova para o retrato, comparação acústica ou expansão de cota.
- A **Conversa** fica nas janelas de 7 dias, 30 dias e ano. A perspectiva acumulada tem área própria. A narrativa continua sujeita à prova existente; sem prova, não aparece.
- Temas possuem identidade semântica independente da frase ou período. O mesmo assunto não se repete só porque o texto mudou. A primeira versão recente prevalece quando o conjunto contém o mesmo tema em várias janelas.
- Registrar um tema disponível não o marca como visto. O cliente envia SEEN apenas quando a manchete da vez está pelo menos 50% visível e a aba está visível. Após revisão do proprietário em 04/11, assuntos vistos **continuam visíveis na abertura**; o intervalo de 72 horas apenas prioriza novidades. Só o silêncio explícito oculta um tema. Ver [correção da Conversa](conversation-visible-artist-sources.md).
- **Nada a ver/volta atrás** silenciam/restauram um tema na conta, sem escrever feedback de música. Falha ao salvar não finge que o tema foi silenciado. O retrato reúne os temas silenciados para restaurá-los em outro dispositivo. A versão editorial impede que uma confirmação de leitura antiga anule uma restauração mais recente.
- A chave antiga de esquecimentos no navegador não tinha vínculo de conta: permanece intocada e não é importada implicitamente. Novas escolhas são privadas e vinculadas ao usuário. O cache factual continua por processo, com expiração e limite de 64 entradas; preferências editoriais são aplicadas após o cache, sem depender da instância.

## Memória — complemento da etapa 7

- **Exportar toda a memória** percorre sessões, indicações, todas as respostas/revisões, coleção, exportações, escolhas editoriais e eventos de início de prévia. Cada requisição lê até cem registros de uma seção; há cursor e corte por data de criação. O cliente baixa partes de até aproximadamente 5.000 registros, com `startsAt`, `reachedEnd` e próximo checkpoint no arquivo. A continuação mantém-se enquanto a página estiver aberta. Todos os arquivos são necessários quando há várias partes.
- É uma cópia iterada dos valores lidos, não um snapshot transacional de toda a conta. A interface orienta evitar edições simultâneas; reproduções importadas e textos internos da IA ficam fora desse escopo. A cópia por recorte da tela continua disponível separadamente.
- Exclusão exige escopo explícito e digitar **APAGAR**. Permite remover coleção, respostas, memória editorial ou toda a memória de descobertas/editorial. Não apaga reproduções nem leituras salvas. Excluir respostas preserva coleção/cursor e limpa o status derivado; a nova geração passa a ler os sinais restantes.
- Escritas de exclusão bloqueiam as sessões em ordem e depois a conta, seguindo a ordem do feedback. Geração recente em andamento recusa a operação; uma reserva abandonada há mais de cinco minutos não bloqueia para sempre. Novas ações de outra aba podem criar dados depois da exclusão. Nenhuma exclusão real foi executada pelo agente.
- O player registra **prévia iniciada** depois de a promessa de play ser confirmada, nunca só por montar a indicação. Esse evento não prova audição completa, apreciação ou causalidade. Falha no log não interrompe a música. Chave de operação impede duplicação; sessão/item são verificados como pertencentes à conta. Eventos anteriores à implantação não são reconstruídos.
- A timeline mostra até dez inícios por indicação e cinco exportações por sessão; a cópia completa percorre todos os registros disponíveis. Exportação preparada não significa escuta nem importação posterior em outro player.

## Cota e observação — recortes das etapas 9–10

- A cota local continua configurada pelos mesmos limites. Cada chamada explícita ao SDK — principal, retry ou fallback — reserva uma linha `ATTEMPT` **antes** de sair, sob bloqueio da conta no PostgreSQL. Falhas e reservas sem medição permanecem contadas. Negação de reserva impede invocar o SDK. Não é uma leitura da cota global do provedor nem uma cotação de preço.
- O pacote lógico usa `provider=gemini-pack` e não duplica a contagem das tentativas. Reservar o pacote do período também é serializado; a verificação anterior de PENDING sozinha não era suficiente para concorrência. Pacotes antigos continuam legíveis. Registros legados ainda entram conservadoramente na janela, sem inventar suas tentativas históricas.
- Tokens vêm de `usageMetadata.totalTokenCount` quando informados. Ausência é `null`, não estimativa ou zero. Resposta do provedor e aprovação do conteúdo são resultados diferentes: uma tentativa pode responder e o pacote ser recusado pela validação.
- Timeout aborta a requisição do SDK e limpa seu timer, em vez de deixar uma chamada antiga correndo em paralelo com o fallback. O fallback precisa de nova reserva; não recebe uma cota artificial separada.
- Ajustes oferece um diagnóstico sob demanda: buscas/falhas, registros de respostas/revisões, tentativas por modelo/status e medição de tokens disponível, além da janela local de cota. São contagens operacionais, não taxa de aprovação musical. Não há polling, chamadas de IA, consulta musical ou infraestrutura adicional para isso.

## Migration e validação

O PR passa a conter três migrations aditivas: `CollectionEntry`, `EditorialMemory` e `DiscoveryEvent`, com índices/chaves estrangeiras. A diferença offline dos schemas confirmou somente essas criações. Cliente gerado e schema validados. Nenhuma migration nova foi aplicada manualmente em banco real; o deploy existente deve aplicar primeiro na preview isolada. Não foram alterados limites/modelos configurados, criado serviço externo ou ativado ListenBrainz no ranking.

501 testes/94 arquivos, tipos e build passaram. Incluem propriedade/escopo de exclusão, paginação completa, confirmação obrigatória, geração concorrente recusada, identidade editorial/cooldown/revisita, registro de tema sem exposição, versão de restauração, reserva antes do SDK, retry/fallback bloqueado pela cota, tokens presentes/ausentes e abort de timeout. Banco/SDK são simulados; isso não certifica contenção, rollback ou latência no PostgreSQL/provedor reais.

Chrome headless com componentes/CSS/fontes locais e respostas fictícias: sete grupos de escuta/coleção (`discovery-motion.browser.mjs`), cinco de memória/exportação/guarda de exclusão (`--memory`), quatro de álbuns/contexto (`--albums`) e dois de retrato/editorial (`--portrait`), em desktop, mobile 390 px e movimento reduzido. Downloads de teste ficam no diretório local ignorado; nenhuma exclusão, áudio real ou chamada de IA real é necessária.

## Revisão ampliada na preview

1. Conferir as três migrations no banco isolado. Validar o retrato contra reproduções conhecidas, incluindo horários perto da virada do dia no fuso da conta. Confirmar comparação 30/30 dias e histórico filtrado.
2. Ver uma manchete, sair e voltar: assunto visto não deve insistir. Rever explicitamente continua possível. Silenciar/restaurar em dois dispositivos não altera coleção ou preferência musical. Falha de rede mantém a escolha anterior.
3. Exportar a memória completa, inclusive revisões mais antigas que o recorte da tela; conferir todas as partes/checkpoints. Usar somente dados de teste/cópia isolada para validar exclusão por escopo, geração em andamento e duas abas.
4. Dar play explicitamente, falhar/parar/trocar faixa e conferir eventos: início não é conclusão, não há autoplay ou curtida implícita. Ver exportações sem tratá-las como reproduções.
5. Consultar funcionamento sem gerar IA. Se validar a integração real da IA, usar o orçamento aprovado e conferir tentativas/reserva/modelo/tokens reais; os testes locais não gastaram chamadas.
6. Repetir escuta, títulos longos, teclado, foco, mobile e redução de movimento. Produção continua dependente da revisão e do merge pelo proprietário.

## O que falta no plano

As funcionalidades principais da etapa 8 e a gestão de memória da 7 estão implementadas para revisão neste PR. Não substituem aceitação manual. Continuam pendentes: portas curadas com aprovação e restrições musicais sustentadas por cobertura (6); adoção opcional do ListenBrainz após resolver versão/contribuição exclusiva (5); pistas de escuta sustentadas por gravação e comparação qualitativa de modelos (9); contexto pelo nome com fonte/data foi acrescentado, sem certificação da gravação; medição real de qualidade musical, latência, concorrência e política de retenção automática (10). Mais código ou um PR maior não substituem essas evidências.
