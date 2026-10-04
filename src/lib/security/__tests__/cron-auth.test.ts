import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { verifyCronAuth } from "../cron-auth";

const SECRET = "segredo-do-cron";

function requestWith(headers: Record<string, string>): Request {
  return new Request("https://arcadium.app/api/sync", { method: "POST", headers });
}

describe("verifyCronAuth", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = SECRET;
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("libera tudo quando não há segredo configurado", () => {
    delete process.env.CRON_SECRET;
    expect(verifyCronAuth(requestWith({})).authorized).toBe(true);
  });

  it("aceita o agendador com o segredo no Bearer", () => {
    expect(verifyCronAuth(requestWith({ authorization: `Bearer ${SECRET}` })).authorized).toBe(true);
  });

  it("aceita o segredo em x-cron-secret", () => {
    expect(verifyCronAuth(requestWith({ "x-cron-secret": SECRET })).authorized).toBe(true);
  });

  it("recusa um Bearer errado", () => {
    expect(verifyCronAuth(requestWith({ authorization: "Bearer outro" })).authorized).toBe(false);
  });

  /** É este caso que o botão "buscar agora" da ficha técnica exercita. */
  it("aceita a requisição feita de dentro da própria página", () => {
    const result = verifyCronAuth(
      requestWith({
        "sec-fetch-site": "same-origin",
        origin: "https://arcadium.app",
        host: "arcadium.app",
      }),
    );
    expect(result.authorized).toBe(true);
  });

  it("aceita same-origin quando o host público vem do proxy", () => {
    const result = verifyCronAuth(
      requestWith({
        "sec-fetch-site": "same-origin",
        origin: "https://arcadium.app",
        host: "localhost:3000",
        "x-forwarded-host": "arcadium.app",
      }),
    );
    expect(result.authorized).toBe(true);
  });

  it("recusa o POST disparado por outro site", () => {
    const result = verifyCronAuth(
      requestWith({
        "sec-fetch-site": "cross-site",
        origin: "https://site-de-terceiro.com",
        host: "arcadium.app",
      }),
    );
    expect(result.authorized).toBe(false);
  });

  /** curl não manda Sec-Fetch-Site; forjar só o Origin não pode bastar. */
  it("recusa quem alega a origem sem ser navegador", () => {
    const result = verifyCronAuth(
      requestWith({ origin: "https://arcadium.app", host: "arcadium.app" }),
    );
    expect(result.authorized).toBe(false);
  });

  it("recusa same-origin com origem de outro host", () => {
    const result = verifyCronAuth(
      requestWith({
        "sec-fetch-site": "same-origin",
        origin: "https://outro.app",
        host: "arcadium.app",
      }),
    );
    expect(result.authorized).toBe(false);
  });
});
