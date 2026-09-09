import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptJson, encryptJson, hasEncryptionKey, MissingEncryptionKeyError } from "./token-crypto";

const KEY = Buffer.alloc(32, 7).toString("base64");

describe("token-crypto", () => {
  beforeEach(() => {
    process.env.TOKEN_ENCRYPTION_KEY = KEY;
  });

  afterEach(() => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
  });

  it("faz a volta completa preservando o conteúdo", () => {
    const tokens = { accessToken: "abc123", refreshToken: "def456", expiresAt: 1893456000000 };
    expect(decryptJson(encryptJson(tokens))).toEqual(tokens);
  });

  it("não deixa o segredo legível no texto cifrado", () => {
    const envelope = encryptJson({ refreshToken: "segredo-que-nao-pode-vazar" });
    expect(envelope).not.toContain("segredo-que-nao-pode-vazar");
    expect(envelope).not.toContain("refreshToken");
  });

  it("gera envelopes diferentes para o mesmo valor", () => {
    const value = { accessToken: "mesmo-valor" };
    expect(encryptJson(value)).not.toBe(encryptJson(value));
  });

  it("recusa envelope adulterado em vez de devolver lixo", () => {
    const [iv, tag, payload] = encryptJson({ accessToken: "original" }).split(".");
    const mexido = Buffer.from(payload, "base64url");
    mexido[0] ^= 0xff;
    expect(() => decryptJson(`${iv}.${tag}.${mexido.toString("base64url")}`)).toThrow();
  });

  it("recusa envelope malformado", () => {
    expect(() => decryptJson("sem-pontos")).toThrow("malformado");
  });

  it("exige a chave em vez de guardar texto puro", () => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
    expect(hasEncryptionKey()).toBe(false);
    expect(() => encryptJson({ a: 1 })).toThrow(MissingEncryptionKeyError);
  });

  it("recusa chave de tamanho errado", () => {
    process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(16, 1).toString("base64");
    expect(() => encryptJson({ a: 1 })).toThrow(/32 bytes/);
  });

  it("aceita a chave em hex além de base64", () => {
    process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("hex");
    expect(decryptJson(encryptJson({ ok: true }))).toEqual({ ok: true });
  });
});
