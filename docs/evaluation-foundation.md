# PR 1 — base de avaliação da descoberta

Estado: proteção e ferramentas implementadas; provisionamento e avaliação musical real pendentes. O proprietário decidiu configurar a cópia e as variáveis manualmente depois. Nenhuma migration foi executada.

## Preview isolada

O projeto local está vinculado na Vercel ao nome legado `grooveyard`. Isso não confirma nome atual, plano, ambiente ou configuração remota. A CLI disponível não encontrou login no diretório de configuração usado para auditoria; não há conector administrativo do banco nesta sessão.

Antes de usar a preview:

1. Confirmar projeto, conta e disponibilidade de branch/cópia no plano Neon atual. Se exigir pagamento, obter decisão do proprietário antes de contratar.
2. Criar uma cópia isolada com histórico representativo. Não versionar dump, credenciais ou resultados pessoais. A cópia não deve compartilhar escritas, OAuth ou sessões de autenticação com produção.
3. Executar `node --env-file=.env scripts/evaluation/deployment-audit.mjs` contra a configuração correta de produção e copiar apenas o `databaseFingerprint` para `PRODUCTION_DATABASE_FINGERPRINT` na preview.
4. Definir `PREVIEW_DATABASE_URL` com a conexão da cópia; `APP_ORIGIN` deve ser a origem HTTPS exata da preview e `AUTH_USER_ID` deve corresponder ao proprietário copiado. Configurar autenticação própria para o ambiente. Não usar a senha ou sessões copiadas como método implícito de isolamento.
5. Confirmar aliases e identidade no painel do banco. A impressão digital compara host, porta e banco; remove o sufixo Neon `-pooler`. Ela não prova isolamento quando um banco é acessado por aliases arbitrários. Não editar o fingerprint para contornar uma rejeição.
6. Remover da cópia tokens de provedores e sessões de login antes de disponibilizá-la, por procedimento administrativo revisado. Não executar reset automático no banco pelo app. OAuth de exportação permanece sem conexão até autorização de teste específica.
7. Verificar a política no ambiente preview com o mesmo script. Configuração ausente ou endpoint igual a produção bloqueia uso do Prisma, inclusive na CLI de migrations. Nenhuma migration roda automaticamente no build.

No ambiente `VERCEL_ENV=preview` (ou `APP_ENV=preview` local), o app nunca usa `DATABASE_URL` como fallback. Agendamentos autenticados com CRON_SECRET são recusados; geração automática de IA pela conversa fica desativada. Sync manual exige sessão e origem válida. A geração manual de IA permanece bloqueada até definir `PREVIEW_MANUAL_AI_ENABLED=true`, apenas após confirmar orçamento compartilhado no projeto do Gemini. Não existe cota adicional por possuir outra chave ou outro ambiente.

Geração e sync não foram acionados nesta entrega. Habilitar geração manual não implementa, por si, reserva atômica ou contagem por tentativa: isso pertence ao próximo trabalho de orçamento e permanece uma limitação explícita.

## Instalação sem conexão e branches Neon

O postinstall `prisma generate` gera o cliente sem consultar o banco. A configuração omite o datasource apenas para esse comando offline; `generate --sql`, migrations e operações de banco continuam exigindo isolamento. Assim, instalação e build podem terminar antes do provisionamento, mas páginas que acessam dados continuam bloqueadas até configurar a cópia.

Para configuração manual: Neon → projeto → Branches → New branch → selecionar a branch que contém os dados reais como parent → Current data → nome específico da feature. Obter a conexão dessa branch e defini-la como `PREVIEW_DATABASE_URL` na Vercel, apenas em Preview e preferencialmente limitada à branch Git do PR. Definir `PRODUCTION_DATABASE_FINGERPRINT` a partir do endpoint real de produção; não usar o endpoint da cópia para gerar esse valor. Configurar APP_ORIGIN com a origem exata da preview, então redeploy. Não compartilhar uma mesma cópia entre PRs com migrations incompatíveis.

Existe integração Neon-Managed para criar branches automaticamente por preview. Ela injeta `DATABASE_URL`, não a variável específica `PREVIEW_DATABASE_URL` exigida nesta primeira implementação. Portanto, instalar a integração sozinha não conclui a configuração deste PR. Uma adaptação futura deverá verificar a origem/identidade do endpoint injetado antes de permitir seu uso, sem voltar ao banco de produção por fallback. Não adicionar migrations ao build como parte desta correção.

Segundo a documentação consultada, o Free inclui 10 branches por projeto, com compute e armazenamento limitados por projeto. Confirmar no painel da conta antes de criar e remover cópias antigas ao encerrar os testes. Fontes: [planos Neon](https://neon.com/docs/introduction/plans), [criação manual](https://neon.com/docs/manage/branches) e [integração Vercel](https://neon.com/docs/guides/neon-managed-vercel-integration).

## Amostra pública e consultas limitadas

`scripts/evaluation/cases.json` contém 30 entradas públicas sintéticas. Não são histórico pessoal nem curadoria aprovada para o produto. Inclui referências conhecidas, música brasileira, versões, participações, homônimos e sondas de cobertura. A popularidade das sondas não foi medida. Qualificadores de versão são casos de consulta, não identificadores canônicos já confirmados.

Sem rede e sem consumo de API:

```powershell
node scripts/evaluation/audit.mjs
```

Execução externa explícita, sem Gemini nem mutações:

```powershell
node --env-file=.env scripts/evaluation/audit.mjs --live --provider lastfm --max-requests 5 --offset 0
node scripts/evaluation/audit.mjs --live --provider itunes --max-requests 5 --offset 0
```

Cada execução é sequencial, tem teto explícito de 1 a 60 requests e para em 429, 503, erro do provedor ou rede. Não há retries automáticos. Chamadas aguardam 1,2s no Last.fm e 3,2s no iTunes; não executar simultaneamente com outras consultas do projeto sem verificar a cota. `offset` permite percorrer a amostra aos poucos.

O relatório contém IDs da amostra, categoria, status, latência e contagem de resultados. Não imprime chave, URL da requisição, mensagem de erro remoto ou payload bruto. Contagem de busca não comprova identidade, adequação ou qualidade. Não interpretar `returned` como taxa de acerto. Relatórios pessoais e payloads não devem ser commitados.

## Referência do motor

Base de código: `55e1833` incorporada na master `fbebb9396a642d2c3a6f21f2ba72ec7fc959f992`. O controle sintético versionado em `baseline.test.ts` usa três candidatos públicos e perfil inventado, com algoritmo `v2-dials`:

| Modo | Ordenação e pontuação capturadas |
| --- | --- |
| SAFE | Hum 81; Portishead 79; Radiohead 78 |
| BALANCED | Hum 89; Portishead 72; Radiohead 71 |
| EXPERIMENTAL | Hum 80; Portishead 64; Radiohead 60 |

Para reproduzir o relatório, executar Vitest nesse arquivo com `ARCADIUM_BASELINE_REPORT=true`. O teste fixa a ordenação atual; mudanças futuras devem preservar este resultado documental e versionar o novo comportamento, não tratá-lo como verdade musical. A referência não inclui consultas reais, exclusões, composição completa ou preferências do proprietário. A linha de base musical real depende da cópia isolada e ainda está pendente.

## Matriz de capacidades e limites

| Fonte | Evidência atual | Situação e próximo teste |
| --- | --- | --- |
| Last.fm | Uso estático confirmado de histórico, similaridade de artistas e top tracks. Similaridade/tags por faixa documentadas. | Cobertura e ganho por faixa ainda não medidos. Runner sonda similaridade; tags e identidade precisam de revisão complementar. |
| MusicBrainz | Código usa busca de artista e release; campo de MBID de entrada pode misturar entidades. | Auditar IDs no banco isolado antes de corrigir dados. Não executar limpeza por nome. |
| iTunes | Código busca BR, prévias desativam espaçamento usado no enriquecimento; normalização pode colapsar versões. | Sonda pública de 1 request funcionou fora do sandbox: case-01 retornou 10 linhas, 10 com prévia, em 487ms. Isso não comprova identidade nem qualidade musical; inspecionar a gravação antes de usar. |
| Spotify | Endpoints locais divergem dos substitutos no guia de migração de 2026. | Testar aplicabilidade e exportação apenas com conexão de preview autorizada. |
| ListenBrainz | Documentação descreve similaridade por gravação e recomendações pessoais experimentais. | Sem chamadas nesta entrega. Requer IDs de gravação corretos; não publicar histórico. |
| Gemini | Configuração local e capturas históricas foram examinadas no brainstorm. | Consumo corrente e configuração remota não medidos; contagem interna não representa cada tentativa. |

Não há evidência para oferecer filtros estritos de mood, voz ou instrumentação. Nenhum provedor novo é habilitado por este PR. Referências: [Last.fm](https://www.last.fm/api/show/track.getSimilar), [iTunes](https://performance-partners.apple.com/search-api), [Spotify](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide), [ListenBrainz](https://listenbrainz.readthedocs.io/en/latest/users/api/recommendation.html).

## Aceitação e pendências

- Implementado: política de conexão isolada no app e Prisma CLI, bloqueio de cron e auto-IA em preview, opt-in manual conservador, testes, amostra e runners sem mutações.
- Verificado: checagem de tipos, build de produção, suíte automatizada e execução dry-run. Testes e build precisaram rodar fora do sandbox devido a bloqueio de arquivos temporários e acesso à fonte Google; não exigiram alterações nos testes existentes.
- Pendente: acesso autenticado Vercel/Neon, confirmação de plano gratuito, provisionamento da cópia, revisão de tokens/sessões copiados, configuração da preview e OAuth, avaliação real de provedores e baseline pessoal.
- Migrations e PRs dependentes da avaliação isolada não devem ser ativados em produção para contornar essas pendências.
