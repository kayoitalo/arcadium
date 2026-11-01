import { describe, expect, it, vi } from 'vitest';
import { databaseFingerprint } from './deployment-policy.mjs';
import { deploymentBuildPlan, executeDeploymentBuild } from '../../../scripts/deployment/vercel-build.mjs';

const production = 'postgresql://owner:secret@production.example/db';
const preview = 'postgresql://owner:secret@preview.example/db';

describe('hosted build and migrations', () => {
  it('refuses an unidentified environment or conflicting production configuration', () => {
    expect(() => deploymentBuildPlan({ DATABASE_URL: production })).toThrow();
    expect(() => deploymentBuildPlan({ VERCEL_ENV: 'production', APP_ENV: 'preview', DATABASE_URL: production })).toThrow();
    expect(() => deploymentBuildPlan({ VERCEL_ENV: 'production', DATABASE_URL: 'https://example.com' })).toThrow();
  });

  it('never lets a preview fall back to production or use its endpoint', () => {
    const env = { VERCEL_ENV: 'preview', DATABASE_URL: production, PRODUCTION_DATABASE_FINGERPRINT: databaseFingerprint(production) };
    expect(() => deploymentBuildPlan(env)).toThrow();
    expect(() => deploymentBuildPlan({ ...env, PREVIEW_DATABASE_URL: production })).toThrow();
    expect(deploymentBuildPlan({ ...env, PREVIEW_DATABASE_URL: preview })).toHaveLength(3);
  });

  it('starts migration only after the application builds successfully', () => {
    const plan = deploymentBuildPlan({ VERCEL_ENV: 'production', DATABASE_URL: production });
    const failedBuild = vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(1);
    expect(executeDeploymentBuild(plan, failedBuild)).toBe(1);
    expect(failedBuild.mock.calls.map(([command]) => command.args)).toEqual([['generate'], ['build']]);
    const successfulBuild = vi.fn().mockReturnValue(0);
    expect(executeDeploymentBuild(plan, successfulBuild)).toBe(0);
    expect(successfulBuild.mock.calls.at(-1)?.[0].args).toEqual(['migrate', 'deploy']);
  });

  it('fails deployment if migration or client generation fails', () => {
    const plan = deploymentBuildPlan({ VERCEL_ENV: 'production', DATABASE_URL: production });
    const migrationFailure = vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(0).mockReturnValueOnce(1);
    expect(executeDeploymentBuild(plan, migrationFailure)).toBe(1);
    const generateFailure = vi.fn().mockReturnValue(1);
    expect(executeDeploymentBuild(plan, generateFailure)).toBe(1);
    expect(generateFailure).toHaveBeenCalledOnce();
  });
});
