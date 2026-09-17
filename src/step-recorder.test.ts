import type { TestInfo } from "@playwright/test";
import { describe, expect, it } from "vitest";
import { SLIDEMUX_STEPS_ATTACHMENT } from "./env.js";
import type { SlidemuxStepMark } from "./manifest.js";
import { createSlidemuxStepRecorder } from "./step-recorder.js";

class FakeTestInfo {
  attachments: Array<{ name: string; body: string; contentType: string }> = [];

  async attach(name: string, options: { body: string; contentType: string }): Promise<void> {
    this.attachments.push({ name, ...options });
  }
}

describe("createSlidemuxStepRecorder", () => {
  it("records step marks and attaches them in reporter format", async () => {
    const recorder = createSlidemuxStepRecorder();
    await recorder.step("open-invite", async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    await recorder.step("send-invite", async () => undefined);

    const testInfo = new FakeTestInfo();
    await recorder.attachSteps(testInfo as unknown as TestInfo);

    expect(testInfo.attachments).toHaveLength(1);
    const attachment = testInfo.attachments[0]!;
    expect(attachment.name).toBe(SLIDEMUX_STEPS_ATTACHMENT);
    expect(attachment.contentType).toBe("application/json");

    const payload = JSON.parse(attachment.body) as { steps: SlidemuxStepMark[]; elapsedAtAttachMs: number };
    const steps = payload.steps;
    expect(steps.map((step) => step.slug)).toEqual(["open-invite", "send-invite"]);
    for (const step of steps) {
      expect(step.endMs).toBeGreaterThanOrEqual(step.startMs);
    }
    expect(steps[1]!.startMs).toBeGreaterThanOrEqual(steps[0]!.endMs);
    expect(payload.elapsedAtAttachMs).toBeGreaterThanOrEqual(steps[1]!.endMs);
  });
});
