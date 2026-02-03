import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("chat faq", () => {
  it("contains required intents and fallback", () => {
    const faqPath = path.resolve(__dirname, "..", "src", "modules", "chat", "faq.json");
    const raw = fs.readFileSync(faqPath, "utf-8");
    const data = JSON.parse(raw) as {
      intents: Array<{ id: string; keywords?: string[]; answer?: string }>;
      fallback?: { question?: string };
    };

    const ids = new Set(data.intents.map((intent) => intent.id));
    ["documentos", "socios", "endereco", "prazos", "erros_upload"].forEach((id) => {
      expect(ids.has(id)).toBe(true);
    });

    data.intents.forEach((intent) => {
      expect(intent.keywords?.length).toBeGreaterThan(0);
      expect(typeof intent.answer).toBe("string");
      expect(intent.answer?.length).toBeGreaterThan(0);
    });

    expect(typeof data.fallback?.question).toBe("string");
    expect(data.fallback?.question?.length).toBeGreaterThan(0);
  });
});
