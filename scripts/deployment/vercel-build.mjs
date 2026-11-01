import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { databaseConnectionString, databaseFingerprint } from '../../src/lib/runtime/deployment-policy.mjs';

/** Validate the destination before any build or migration command.
 * @param {Record<string, string | undefined>} env
 */
export function deploymentBuildPlan(env) {
  if (!['production', 'preview'].includes(env.VERCEL_ENV ?? '')) throw new Error('Hosted deployment environment is required');
  if (env.VERCEL_ENV === 'production' && env.APP_ENV === 'preview') throw new Error('Conflicting deployment environments');
  // Preview still requires its isolated URL and rejects the production fingerprint.
  databaseFingerprint(databaseConnectionString(env));
  return [
    { tool: 'prisma', args: ['generate'] },
    { tool: 'next', args: ['build'] },
    { tool: 'prisma', args: ['migrate', 'deploy'] },
  ];
}

/** A failed build never starts a migration; a failed migration fails the deployment.
 * @param {ReturnType<typeof deploymentBuildPlan>} plan
 * @param {(command: ReturnType<typeof deploymentBuildPlan>[number]) => number} run
 */
export function executeDeploymentBuild(plan, run) {
  for (const command of plan) {
    const status = run(command);
    if (status !== 0) return status;
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const plan = deploymentBuildPlan(process.env);
    const require = createRequire(import.meta.url);
    const binaries = { prisma: require.resolve('prisma/build/index.js'), next: require.resolve('next/dist/bin/next') };
    process.exitCode = executeDeploymentBuild(plan, ({ tool, args }) => {
      const result = spawnSync(process.execPath, [binaries[tool], ...args], { stdio: 'inherit', env: process.env });
      return result.status ?? 1;
    });
  } catch {
    console.error('Deployment stopped: check VERCEL_ENV and the database isolation configuration. No database URL is logged.');
    process.exitCode = 1;
  }
}
