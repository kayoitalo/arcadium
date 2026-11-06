# Territórios, pistas e operação — incremento após PR 17

04/11/2026. PR 17 confirmado remotamente como mergeado em `6a9799cb4fc1a6706a3e1489f11a7f7438a82ee5`, com head `6ac105b`. O status Vercel desse head era sucesso. Branch `codex/territories-evidence-operations` criada da master atualizada; workspace inicialmente limpo. Não se presume aceitação manual adicional.

## Comportamento implementado

**Explorar outro universo** abre portas por associação de artista no catálogo MusicBrainz já enriquecido. A consulta é sob demanda, autenticada e privada: até 200 artistas, 24 tags exatas, exemplos e limite do recorte explícitos. A porta declara seu escopo: tag de artista não certifica gênero de cada gravação. Não usa IA, outra fonte ou upload de histórico.

Ao escolher, o servidor fixa versão, gênero, data, identidades, data de enriquecimento e títulos locais de até seis artistas sem reprodução no histórico importado. Nomes com colisão no catálogo são recusados. A busca usa somente esses artistas: até três títulos locais por artista e seis consultas lógicas de top tracks Last.fm, com fila/cache/deadline/cooldown existentes. Não consulta similaridade, público ou vizinhos do perfil para completar o destino. Sem fonte externa configurada, o catálogo local continua funcionando. A composição mantém um artista por sessão; a rota pede seis nesse caminho, compatível com o orçamento, e oito nos demais. A cobertura registra o pedido efetivo e qualquer redução; `MORE` preserva também esse tamanho.

`MORE` preserva o snapshot do destino; não escolhe outro gênero ou outra lista de artistas. Outra entrada consulta o catálogo novamente. Aprofundar uma faixa declara a mudança para descoberta por referência. Os controles de proximidade permanecem nos caminhos próximos; ficam fora do território e do repertório. O antigo canto “fora da bolha” agora diz “relações menos diretas”, evitando confundir distância com mudança de universo.

**Repertório com evidência** permite interseção de gênero do álbum no catálogo Apple e duração máxima catalogada. Usa somente reproduções da própria conta. Gênero exige álbum/artista com texto correspondente e consulta Apple registrada. Duração exige faixa/artista/qualificadores correspondentes, ID Apple, enriquecimento e duração positiva conhecida. Ausência de metadados, versão divergente e álbum divergente excluem a linha. Até 500 grupos observados por consulta; não é cobertura integral de uma biblioteca ilimitada. O motivo deixa claro que classificação do álbum não descreve o som de cada gravação. Momento, humor, voz e instrumentação seguem indisponíveis; pedidos de momento/voz no contrato recebem `422 INSUFFICIENT_EVIDENCE`, sem relaxamento silencioso.

As restrições e o destino entram no fingerprint idempotente e no contexto da sessão. A resolução do destino acontece depois da verificação de replay; repetir uma busca concluída não consulta fontes novamente. Cobertura preservada inclui candidatos, elegíveis, selecionados, tamanho pedido, escopo e tempo até antes do commit. Tentativas/falhas/cache/deadline Last.fm são diferenças dos contadores observados, ou `null` sem instrumentação. Falha/tempo esgotado não viram prova de ausência na fonte. Isso não mede latência completa, qualidade ou cota global.

**Pistas desta versão** são convites determinísticos baseados na entrada Apple já resolvida: posição na edição escolhida, duração da faixa completa e qualificadores do título. Cada bloco traz ID da entrada, link da faixa, data, correspondência textual e escopo. O ID no link precisa corresponder ao ID da mídia; versão incompatível ou falta de evidência não produz pista. A prévia não prova a forma inteira da faixa. Nenhuma inferência de timbre, instrumentos, atmosfera, voz ou análise acústica. Contexto Last.fm de álbum/música continua separado e não certifica a gravação. Créditos e pistas sonoras editoriais por gravação ainda dependem de curadoria e identificação suficientes.

Os metadados de duração/data são guardados junto da mídia/edição, sem consulta nova. Reabrir as pistas os reutiliza; exportação/diário derivam a mesma versão de pistas desse snapshot, sem expor os componentes internos de ranking. Sessões antigas continuam legíveis e não ganham metadados fictícios. Fotos permanecem exclusivamente Spotify; retrato e espaço reservado não foram redesenhados.

## Curadoria e avaliação

As [três propostas concretas](curation-proposals.md) têm versão e estado `PROPOSED`, fonte e âncora por álbum. Estão disponíveis para revisão na interface, sem botão de ativação e sem participação no ranking. Portas de catálogo não são apresentadas como seleção editorial aprovada. Aprovar artistas, gravações, edição, ordem e pistas continua sendo decisão editorial.

[Comparação reproduzível](evaluation-replay.md): baseline do motor atual `v3-hybrid-3` congelada a partir da master, manifest/hashes, pools pareados, distinção sintético/observado e julgamentos ausentes. Comparação Lite/Flash prepara o mesmo prompt com fontes/escopos e ordem cega estável; avalia o contrato de respostas salvas. Não executa IA nem declara vencedor. ListenBrainz continua experimental, desligado por padrão e fora do ranking.

## Operação e migration

Reservas de geração comum agora bloqueiam a conta como as jornadas de álbum; uma reserva recente impede outra geração simultânea na mesma conta. Finalização bloqueia e relê a sessão e exige `GENERATING`: trabalho cancelado/encerrado não volta a `ACTIVE` nem recria itens. Falha marca somente uma reserva ainda em geração; replay abandonado mantém o protocolo existente de nova tentativa explícita.

A [política operacional](../scripts/operations/retention-policy.json) vem com todos os prazos `null`. Não há cron novo, ativação automática ou prazo escolhido pelo agente. Somente credenciais de sessão já expiradas, limites de login expirados e transição de reservas abandonadas para `FAILED` são elegíveis. Histórico, respostas, coleção, contexto, retrato, exportações, memória editorial e textos de IA não são alvos de exclusão. `personalMemory: PRESERVE` é obrigatório e escopos desconhecidos são recusados.

`node scripts/operations/retention.mjs --as-of <ISO>` simula a política. Para aplicar, forneça `--apply --plan-hash <hash-da-simulação>` com a mesma política, data, banco e schema. Cada aplicação executa lotes limitados e atômicos com `FOR UPDATE SKIP LOCKED`. A contagem da simulação pode variar até a aplicação. Para habilitar um escopo, defina seu prazo em uma cópia da política e revise a simulação. Em preview, o CLI usa o guard de isolamento existente.

Migration `20261105000000_discovery_operations_indexes`: três índices aditivos para reserva/limpeza, retomada e exposição. Sem backfill, mudança de tabela existente ou exclusão de dados. O índice de retomada inclui `DESC NULLS LAST`, correspondente à consulta real. Cache compartilhado Last.fm também passa a limitar entradas a 256, sem alterar TTL ou orçamento de chamadas.

O fluxo Vercel permanece **build seguido de migrate deploy**. Validação de banco desta rodada usa o endpoint de preview confirmado pelo proprietário e pela captura do painel, com fingerprint independente e allowlist de destino. O runner cria um schema `arcadium_eval_<aleatório>`, aplica migrations somente nele, usa contas e catálogo sintéticos e remove somente esse schema no `finally`. Não acessa produção nem o histórico copiado na preview. Fingerprints e conexão não são versionados; o guard do deploy não é alterado.

## Validação e limites

Na revisão de 05/11/2026, o filtro de duração passou a exigir vínculo da faixa com a edição do álbum ouvido. O enriquecimento grava duração, ID e data juntos e volta a conferir álbuns antigos dentro do intervalo de tentativas já usado pelo catálogo. A prévia de um resultado filtrado vem do mesmo registro que sustentou o recorte. A interface mostra os filtros ativos na retomada, inclusive em sessões vazias. O replay de revisitas usa a data da captura e preserva a evidência de escutas. Essa revisão passou em 571 testes, dois testes de replay, seis cenários PostgreSQL isolados, build e quatro configurações de navegador para territórios e repertório.

- 566 testes em 109 arquivos, dois testes de replay/preparo offline, tipos/build e schema válidos; diff do PostgreSQL migrado sem drift. Cinco runners de navegador passaram nas quatro configurações. Respostas, áudio e imagens do navegador são sintéticos; componentes/CSS/fontes são reais.
- PostgreSQL real: migrations em schema descartável; geração, concorrência/idempotência de feedback/coleção, rollback, reserva abandonada, finalização cancelada e retenção operacional. Sem SDK, áudio ou provedor musical nesses testes.
- Medição do índice com 5.000 sessões sintéticas: plano anterior sem o novo índice, em transação revertida, versus índice presente. Observação da rodada: 1,222 ms/86 blocos em cache versus 0,039 ms/4 blocos em cache, com `Index Only Scan`. Uma execução pequena não prova ganho representativo em produção; tempos de transporte e geração são separados.
- A migration foi aplicada apenas aos schemas descartáveis, não ao schema da aplicação na preview nem a produção. Aplicação ao schema da preview ocorre pelo deploy do PR; conferir seus logs antes do merge.

## Roteiro de revisão

1. Abrir Descobrir, expandir outro universo, conferir fonte/escopo/limite, escolher uma tag. Conferir destino, menos resultados sem preenchimento e inexistência do mapa de proximidade nesse caminho.
2. Buscar mais e retomar em outro dispositivo: mesmo destino e versão, respostas/posição preservadas. Aprofundar declara a troca para referência. Retomar sessões anteriores continua sem geração/autoplay.
3. Selecionar repertório por gênero do álbum e duração. Conferir lacuna, interseção, versões e pedido sem cobertura. Momento/voz/instrumentação não podem aparecer como filtros garantidos.
4. Abrir pistas após resolver a mídia: ID/link/data e duração da faixa completa; comparar título/versão. Falha oferece retry; falta de fonte deixa a lacuna. Abrir contexto de álbum/música não deve inventar pista sonora.
5. Revisar as propostas separadamente. Nenhuma está aprovada ou ativa. Repetir teclado, 390 px, 1280/1920 px e movimento reduzido.
6. Conferir migration na preview e os resultados dos ensaios isolados. Se decidir habilitar retenção operacional, escolher prazos, simular e revisar o hash antes da aplicação. Não ativar exclusão automática de memória pessoal.
7. Avaliar música e editorial com amostra real e julgamentos explícitos. Compilação, mecanismos sintéticos e plano SQL não concluem o planejamento inteiro.
