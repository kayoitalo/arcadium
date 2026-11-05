# Deploy e migrations

Atualização de 04/11/2026: PR 17 confirmado como mergeado. O incremento seguinte acrescenta somente três índices em `20261105000000_discovery_operations_indexes`, validados com todas as migrations em schema descartável no PostgreSQL de preview confirmado pelo proprietário. O schema da aplicação da preview e produção não foram migrados manualmente nesta rodada. O fluxo de deploy abaixo permanece inalterado. Ver [ensaio isolado e limites](evaluation-replay.md) e [operação/revisão](territories-evidence-operations.md).

Em 01/11/2026 o proprietário relatou `DISCOVERY_MIGRATION_REQUIRED` em produção e confirmou que a conexão local apontava para o banco de produção correto. A consulta somente de leitura mostrou exatamente uma migration pendente: `20261030040000_discovery_sessions_feedback`. Ela foi aplicada com `prisma migrate deploy`; a conferência posterior confirmou as dez migrations em dia. Não houve reset, alteração de histórico ou migration nova. A validação anterior relatada pelo proprietário foi funcional/visual; não equivale a um ensaio medido de concorrência PostgreSQL.

## Novo fluxo versionado

A solicitação do proprietário para configurar esse fluxo atualiza a decisão anterior de aplicar migrations apenas manualmente. `vercel.json` passa a selecionar `pnpm run build:deploy`. O comando local comum `pnpm build` continua disponível para compilar sem modificar banco.

O script de deploy:

1. Exige `VERCEL_ENV=preview` ou `production`, recusa produção com `APP_ENV=preview` e valida a conexão antes de iniciar comandos.
2. Na preview, mantém a exigência de `PREVIEW_DATABASE_URL` isolada e `PRODUCTION_DATABASE_FINGERPRINT`; não usa `DATABASE_URL` como fallback e rejeita o endpoint de produção.
3. Gera o cliente Prisma e compila o Next.js. Se qualquer um falhar, não inicia migration.
4. Executa `prisma migrate deploy`. Uma falha faz o build de deploy falhar e impede a publicação desse deploy. Só são executadas as migrations versionadas que ainda estiverem pendentes.

O script não depende de credenciais Vercel adicionais, Actions novas, cron, worker ou infraestrutura nova. As variáveis do ambiente de build precisam continuar configuradas na Vercel. O painel remoto não foi alterado nesta sessão. A configuração versionada passa a valer nos deploys que incluírem esta alteração; um override manual de Build Command no painel deve ser conferido caso os logs não mostrem `build:deploy`.

Migrations futuras continuam aditivas e revisadas. Validar primeiro na preview isolada e só depois mergear na `master`, que publica produção. Alterações de schema precisam ser compatíveis com a versão anterior, que continua atendendo enquanto o novo deploy termina. Uma migration bem-sucedida não é revertida por rollback de aplicação, nem o script promete uma transação conjunta entre banco e Vercel. O Next.js deve continuar compilando sem exigir as novas colunas em consultas de geração estática, pois a migration ocorre após a compilação.

## Verificações e operação manual

Os testes verificam bloqueio de destino de preview inválido, ausência de ambiente identificado, interrupção após falha de geração/build e propagação de falha da migration. Nenhum teste automatizado aplica mudanças em banco real. O fluxo completo na Vercel continua dependendo de um deploy dessa configuração.

Para verificar um ambiente identificado, usar as variáveis próprias dele e `pnpm exec prisma migrate status`. Para a correção manual, `pnpm db:deploy`. Não usar `migrate dev`, `db push`, reset ou `migrate resolve` para contornar histórico divergente em produção. Uma conexão local não deve ser chamada de produção sem conferência do proprietário ou da configuração remota.

Referência: [Prisma ORM 7 na Vercel](https://www.prisma.io/docs/orm/v7/prisma-client/deployment/serverless/deploy-to-vercel), que distingue geração de cliente e aplicação de migrations e orienta separar o banco de preview. O projeto permanece em Prisma 7; não adota comandos de migração de versões posteriores.
