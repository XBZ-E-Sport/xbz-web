// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const { reportMock, rateLimitMock } = vi.hoisted(() => ({
  reportMock: vi.fn(),
  rateLimitMock: vi.fn(),
}));

vi.mock("@/lib/report-error", () => ({
  reportError: (r: unknown) => reportMock(r),
}));

vi.mock("@/lib/ratelimit", () => ({
  checkRateLimit: (...a: unknown[]) => rateLimitMock(...a),
  getClientIp: () => "127.0.0.1",
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) =>
      new Response(JSON.stringify(body), {
        status: init?.status ?? 200,
        headers: { "content-type": "application/json" },
      }),
  },
}));

import { POST } from "@/app/api/report-error/route";

const post = (body: unknown, raw = false) =>
  POST(
    new Request("https://x.test/api/report-error", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: raw ? (body as string) : JSON.stringify(body),
    }),
  );

describe("POST /api/report-error", () => {
  beforeEach(() => {
    reportMock.mockReset();
    rateLimitMock.mockReset().mockResolvedValue({ allowed: true, retryAfter: 0 });
  });

  it("relaie un rapport client au sink de monitoring", async () => {
    const res = await post({ message: "Boom", stack: "at foo()", path: "/boutique" });

    expect(res.status).toBe(200);
    expect(reportMock).toHaveBeenCalledWith(
      expect.objectContaining({ source: "client", message: "Boom", path: "/boutique" }),
    );
  });

  it("limite le débit par IP (10 / minute) et renvoie 429 au-delà", async () => {
    rateLimitMock.mockResolvedValue({ allowed: false, retryAfter: 60 });

    const res = await post({ message: "flood" });
    expect(res.status).toBe(429);
    // Un flood ne doit JAMAIS atteindre le webhook Discord.
    expect(reportMock).not.toHaveBeenCalled();
    expect(rateLimitMock).toHaveBeenCalledWith("127.0.0.1", "report-error", {
      limit: 10,
      windowSeconds: 60,
    });
  });

  it("renvoie 400 sur un corps JSON invalide", async () => {
    const res = await post("{pas du json", true);
    expect(res.status).toBe(400);
    expect(reportMock).not.toHaveBeenCalled();
  });

  it("tronque les champs trop longs et remplace un message vide", async () => {
    await post({ message: "", stack: "S".repeat(9000), path: "/p".repeat(400) });

    const arg = reportMock.mock.calls[0][0] as { message: string; stack: string; path: string };
    expect(arg.message).toBe("Erreur client inconnue");
    expect(arg.stack).toHaveLength(4000);
    expect(arg.path).toHaveLength(300);
  });
});
