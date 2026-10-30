import { describe, expect, it } from "vitest";
import { DeploymentPolicyError } from "@/lib/runtime/deployment-policy.mjs";
import { loginFailureCode } from "./login-diagnostics";

describe("safe login diagnostics", () => {
  it("distinguishes known preview policy failures", () => {
    expect(loginFailureCode(new DeploymentPolicyError("PREVIEW_POINTS_TO_PRODUCTION", "sensitive details"))).toBe("PREVIEW_POINTS_TO_PRODUCTION");
  });
  it("maps table and connectivity failures to fixed labels", () => {
    expect(loginFailureCode({ code: "P2021", message: "sensitive SQL" })).toBe("DATABASE_TABLE_MISSING");
    expect(loginFailureCode({ code: "ENOTFOUND", message: "private host" })).toBe("DATABASE_UNREACHABLE");
  });
  it("never returns arbitrary exception messages, codes or nested metadata", () => {
    for (const error of [new Error("postgres://owner:secret@host/db"), { code: "secret", meta: { password: "secret" } }, null, new DeploymentPolicyError("secret", "secret")]) {
      expect(loginFailureCode(error)).toBe("LOGIN_OPERATION_FAILED");
    }
  });
});
