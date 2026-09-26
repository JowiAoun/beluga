import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { admit, boundedBody } from "./request";

describe("voice request boundaries", () => {
  it("rejects cross-origin requests", () => {
    expect(() => admit(new Request("https://beluga.test/api/ask", { headers: { origin: "https://elsewhere.test" } }))).toThrow("Origin not allowed");
  });
  it("bounds streaming bodies even without a content-length header", async () => {
    const request = new Request("https://beluga.test/api/ask", { method: "POST", body: "123456" });
    await expect(boundedBody(request, 5)).rejects.toMatchObject({ status: 413 });
  });
  it("returns a valid bounded body", async () => {
    const request = new Request("https://beluga.test/api/ask", { method: "POST", body: "hello" });
    expect(new TextDecoder().decode(await boundedBody(request, 5))).toBe("hello");
  });
});
