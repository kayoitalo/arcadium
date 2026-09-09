import crypto from "crypto";

/**
 * Tokens de provedor ficam em `ProviderConnection.encryptedTokens`. O
 * nome do campo é uma promessa: nada entra ali em texto puro.
 *
 * AES-256-GCM porque além de cifrar ele autentica — um registro adulterado
 * falha na decifragem em vez de devolver lixo silenciosamente.
 */
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;

export class MissingEncryptionKeyError extends Error {
  constructor() {
    super(
      "TOKEN_ENCRYPTION_KEY não configurada. Gere uma com: openssl rand -base64 32"
    );
    this.name = "MissingEncryptionKeyError";
  }
}

function readKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY?.trim();
  if (!raw) throw new MissingEncryptionKeyError();

  const key = Buffer.from(raw, raw.length === KEY_BYTES * 2 ? "hex" : "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `TOKEN_ENCRYPTION_KEY deve ter ${KEY_BYTES} bytes (44 caracteres em base64); recebi ${key.length}.`
    );
  }
  return key;
}

export function hasEncryptionKey(): boolean {
  try {
    readKey();
    return true;
  } catch {
    return false;
  }
}

/** Formato: iv.authTag.payload, tudo em base64url, separado por ponto. */
export function encryptJson(value: unknown): string {
  const key = readKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const payload = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);

  return [
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    payload.toString("base64url"),
  ].join(".");
}

export function decryptJson<T>(envelope: string): T {
  const key = readKey();
  const [ivPart, tagPart, payloadPart] = envelope.split(".");
  if (!ivPart || !tagPart || !payloadPart) {
    throw new Error("Envelope de token malformado.");
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));

  const plain = Buffer.concat([
    decipher.update(Buffer.from(payloadPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");

  return JSON.parse(plain) as T;
}
