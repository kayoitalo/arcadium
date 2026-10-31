# Etapa 3 — continuidade e feedback

Hipótese: retomar sem reiniciar, distinguir operações e interpretar corretamente o feedback evita repetição e ensina algo específico sobre cada faixa. Não se afirma melhora de descoberta por gênero nesta etapa; perfil e geração musical serão aprofundados na etapa 4.

## Comportamento

- Abrir Descoberta recupera a última sessão ativa, posição, controles e avaliações. Não inicia áudio. Na ausência de sessão, inicia outra entrada explicitamente identificada no pedido.
- **Retomar** recupera a mesma sessão, mesmo após seis horas, sem chamar geradores ou preencher capas novamente. Sessões antigas continuam legíveis. Sem cursor legado, usa a primeira indicação `PENDING`; não inventa observações de exposição ou reproduções anteriores.
- **Buscar mais nesse canto** cria uma sessão nova com os parâmetros da original, evitando itens já apresentados/avaliados. Não amplia controles se faltar cobertura. Uma sessão de versão anterior precisa de **outra entrada** para gerar, sem ser apresentada como resultado do motor novo.
- **Outra entrada** usa os controles escolhidos e preserva a sessão anterior. O mapa atual continua; a comparação visual ampla permanece para a etapa 7.
- Pedidos novos possuem chave de operação por proprietário e parâmetros. Repetir uma tentativa não cria outra sessão nem repete chamadas externas quando o resultado já existe. Uma tentativa concorrente recebe conflito enquanto a geração está em andamento. Falhas ficam separadas; gerações interrompidas podem ser substituídas após cinco minutos, sem alteração de uma sessão anterior.
- A posição é persistida na conta. “Rever a anterior” e “próxima sem avaliar” movem a posição sem inventar preferência; movimento com posição desatualizada é recusado, para uma aba não sobrescrever outra silenciosamente.
- Exposição é registrada separadamente quando a interface reporta pelo menos metade da indicação visível, com a aba visível e sem o modal de exportação sobreposto. Gerar a sessão não marca exposição. Isso é observação reportada pelo cliente, não prova de atenção ou audição. Falha ao registrar não penaliza gosto.

## Avaliações e revisões

| Canal | Registro | Interpretação |
| --- | --- | --- |
| Gosto | Curti / não curti | Preferência por essa faixa e versão textual; não bloqueia artista, gênero ou semente. |
| Familiaridade | Já conheço | Essa faixa é conhecida; não declara aprovação ou rejeição. |
| Coleção | Guardo para depois | Intenção de voltar; não vira aprovação automática. |
| Pedido | Não era o que pedi | Problema de adequação; não reduz afinidade musical. |
| Curiosidade | Fiquei curioso | Interesse a explorar; não equivale a gostar ou terminar de ouvir. |
| Escuta | Pula / ainda não ouvi | Não declara rejeição. |
| Legado | `NOT_INTERESTED` | Permanece genérico; não é convertido em um motivo mais específico. |

Os canais coexistem: gostar e guardar são registros distintos. Os motivos opcionais (vocal, instrumental, letra, ritmo, atmosfera e outro) ficam associados à avaliação e ao exemplo declarado, sem inferir descritores de outras músicas. Só aparecem ao abrir “outras respostas ou revisar”.

Revisar acrescenta um registro com revisão crescente e referência à avaliação substituída. Retirar cria um registro de retirada no canal escolhido; não apaga os anteriores nem os outros canais. Uma referência já superada é recusada. Chaves de operação impedem que uma resposta antiga reenviada por falha de rede desfaça uma decisão posterior.

O registro novo guarda o item efetivamente avaliado, nomes, referência local de faixa e evidência da prévia quando existente. Feedback legado não recebe procedência ou motivos retroativos. No ranking, apenas o estado vigente de gosto da faixa influencia afinidade; retirada elimina esse efeito futuro. Familiaridade afeta novidade. Exposição recente continua podendo impedir repetição mesmo após retirar uma preferência: esse intervalo não é uma rejeição de gosto.

A lista de exportação continua usando o armazenamento local existente nesta etapa. Os registros de guardar/curtir estão na conta, mas a coleção entre dispositivos e sua reconciliação continuam previstas para a etapa 7. Remover uma faixa da lista local não é reinterpretado como desagrado.

## API e dados

- `POST /api/recommendations`: `AUTO` mantém compatibilidade legada; `RESUME`, `MORE` e `NEW_ENTRY` são operações explícitas. As duas últimas requerem `requestKey`; `MORE` requer `sessionId` do proprietário. Repetir a chave com parâmetros diferentes é recusado.
- `GET /api/recommendations/[sessionId]` recupera a sessão do proprietário. `PATCH` registra `EXPOSE` ou `MOVE` com posição esperada. Respostas de sessão incluem `currentRank`, `settings` e estado vigente de feedback por item.
- Feedback aceita os tipos anteriores e os novos; `requestKey`, `revisesId`, `details` e `advance` são aditivos. Uma chamada antiga sem chave só repete sem escrever se ainda for o mesmo estado vigente; curtir, descurtir e curtir de novo gera revisões distintas.
- Gravações e avanço ocorrem em transação com bloqueio da sessão. As chaves de busca e feedback e a revisão têm índices únicos. Campos legados ficam nulos, sem transformar avaliações antigas em um estado específico novo.
- Versão do motor: `v2-session-memory`. Os pesos e as fontes não mudaram; foi retirado o efeito indevido do voto de faixa sobre o artista inteiro.

## Migration: aplicar primeiro na preview

Esta etapa **precisa da migration** `20261030040000_discovery_sessions_feedback`. Ela apenas acrescenta campos anuláveis e índices; não transfere eventos, corrige identidades ou apaga dados. O SQL foi comparado offline com a diferença dos schemas Prisma. A migration **não foi executada** durante o desenvolvimento; testes de concorrência/rollback usam banco simulado, não certificam o PostgreSQL real.

Usar a cópia isolada correta do Neon, confirmando a branch no painel, sem confiar só no nome `neondb`. Em um checkout deste PR, configurar localmente `APP_ENV=preview`, `PREVIEW_DATABASE_URL` da cópia e `PRODUCTION_DATABASE_FINGERPRINT` já adotado. Não publicar valores ou connection strings.

1. Executar `node scripts/evaluation/deployment-audit.mjs` para conferir a política de isolamento sem expor segredos.
2. Executar `pnpm exec prisma migrate status`. Conferir o destino e as migrations pendentes. Se houver pendências anteriores ou divergência de histórico, interromper e investigar antes de aplicar; não usar reset nem marcar migrations como aplicadas sem conferir.
3. Com o destino isolado e o histórico conferidos, executar manualmente `pnpm exec prisma migrate deploy`.
4. Conferir `migrate status` novamente e testar a preview. Não há `migrate deploy` adicionado ao build, postinstall ou cron.

Enquanto faltar a migration, as APIs de descoberta respondem `503 / DISCOVERY_MIGRATION_REQUIRED`; o frontend mostra que a atualização do banco está pendente. O deploy da Vercel sozinho não aplica essa atualização.

Depois da avaliação isolada, a aplicação dessa mesma migration em produção deve ser coordenada **antes** de publicar o código que usa as colunas. O código anterior tolera as colunas adicionais. Merge e alterações no banco de produção continuam dependendo da revisão do proprietário; não são realizados por este PR automaticamente.

## Aceitação na preview

1. Avaliar duas sugestões, navegar para outra página e voltar: mesma sessão, próxima posição e controles; sem reprodução automática.
2. Buscar mais: novo ID de sessão, mesmos controles, sem repetir imediatamente as indicações vistas. Conferir que uma sugestão gerada mas nunca vista não recebeu `exposedAt`.
3. Mudar o mapa/outra entrada: nova sessão; a anterior continua recuperável pelo ID.
4. Curtir uma faixa, voltar, não curtir e voltar a curtir: três registros preservados, último estado vigente. Gostar de outra faixa do artista não deve ser impedido pela primeira rejeição.
5. Guardar e curtir no mesmo item; retirar apenas a preferência: guardar permanece. “Não era o que pedi”, pular e “ainda não ouvi” não reduzem afinidade.
6. Revisar ou retirar uma avaliação; motivos e identidade originais continuam no registro anterior. Não atribuir novo significado ao `NOT_INTERESTED` legado.
7. Reenviar a mesma operação e testar duas abas: sem sessão ou revisão duplicada, sem avanço duplo e sem movimento silencioso sobre um cursor desatualizado. Validar os índices/transações com o PostgreSQL da cópia.
8. Testar teclado/mobile, detalhes fechados por padrão, retorno sem áudio e falha de rede preservando a indicação/resposta para nova tentativa.

Verificações locais: suíte completa de testes, tipos, build, `prisma validate` e diff offline dos schemas. A reprodução real, o fluxo visual e a migration no banco isolado permanecem para a preview.
