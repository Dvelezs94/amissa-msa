import { describe, expect, it } from "vitest";
import {
  WORKFLOW_TEST_ENTITY_TYPE,
  buildWorkflowTestEvent,
  parseWorkflowTestTriggerType,
  workflowActionForDryRun,
} from "@/lib/workflow-test-action";
import { defaultWorkflowAction } from "@/lib/workflows";

describe("workflowActionForDryRun", () => {
  it("targets the tester for notify and email", () => {
    const notify = workflowActionForDryRun(
      {
        ...defaultWorkflowAction("notify"),
        recipientKind: "role",
        role: "tecnico",
        excludeActor: true,
      },
      { id: "admin1", email: "admin@example.com" }
    );
    expect(notify).toMatchObject({
      recipientKind: "users",
      userIds: ["admin1"],
      excludeActor: false,
      emails: ["admin@example.com"],
    });

    const telegram = workflowActionForDryRun(
      {
        ...defaultWorkflowAction("telegram"),
        telegramChatId: "@planta",
      },
      { id: "admin1", email: "admin@example.com" }
    );
    expect(telegram.telegramChatId).toBe("@planta");
    expect(telegram.type).toBe("telegram");
  });
});

describe("buildWorkflowTestEvent", () => {
  it("fills sample template vars and does not use the tester as actor", () => {
    const event = buildWorkflowTestEvent({
      triggerType: "work_order.note_added",
      tester: {
        id: "admin1",
        name: "Ana",
        email: "ana@example.com",
      },
    });
    expect(event.type).toBe("work_order.note_added");
    expect(event.entityType).toBe(WORKFLOW_TEST_ENTITY_TYPE);
    expect(event.actorUserId).toBeNull();
    expect(event.payload.title).toBe("Prueba de flujo");
    expect(event.payload.contactEmail).toBe("ana@example.com");
    expect(event.payload.requesterId).toBe("admin1");
  });
});

describe("parseWorkflowTestTriggerType", () => {
  it("falls back to tarea creada", () => {
    expect(parseWorkflowTestTriggerType("work_order.completed")).toBe(
      "work_order.completed"
    );
    expect(parseWorkflowTestTriggerType("nope")).toBe("work_order.created");
  });
});
