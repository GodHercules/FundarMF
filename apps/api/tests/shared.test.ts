import { describe, expect, it } from "vitest";
import { STEP_ORDER } from "@fundarmf/shared";

describe("shared constants", () => {
  it("contains 6 steps", () => {
    expect(STEP_ORDER).toHaveLength(6);
  });
});
