import { describe, expect, it } from "vitest";
import {
  coerceStoredWorkflowActions,
  collectEventContactEmails,
  defaultWorkflowAction,
  filterRecipientUserIds,
  interpolateWorkflowTemplate,
  parseEmailList,
  parseWorkflowDefinition,
  workflowMatchesEvent,
  workflowTemplateVarsFromEvent,
  workflowTriggerLabel,
  workflowRecipientLabel,
  WORKFLOW_TRIGGER_TYPES,
  buildWorkflowEvent,
} from "@/lib/workflows";

describe("workflowTriggerLabel", () => {
  it("labels known triggers in Spanish", () => {
    expect(workflowTriggerLabel("work_order.completed")).toBe(
      "Tarea completada"
    );
    expect(workflowTriggerLabel("work_order.note_added")).toBe(
      "Nueva nota en tarea"
    );
    expect(workflowTriggerLabel("solicitud.created")).toBe(
      "Orden de trabajo creada"
    );
    expect(WORKFLOW_TRIGGER_TYPES).toContain("solicitud.created");
    expect(workflowRecipientLabel("contact")).toBe(
      "Contacto del evento (orden de trabajo)"
    );
  });
});

describe("interpolateWorkflowTemplate", () => {
  it("replaces placeholders and blanks missing keys", () => {
    expect(
      interpolateWorkflowTemplate("Hola {{actorName}} — {{title}}", {
        actorName: "Ana",
        title: "Prensa 1",
      })
    ).toBe("Hola Ana — Prensa 1");
    expect(interpolateWorkflowTemplate("{{missing}}", {})).toBe("");
  });
});

describe("workflowMatchesEvent", () => {
  it("requires the same trigger and enabled flag", () => {
    const event = {
      type: "work_order.completed" as const,
      entityType: "work_order",
      entityId: "wo1",
      actorUserId: "u1",
      actorName: "Ana",
      payload: { status: "completed" },
    };
    expect(
      workflowMatchesEvent(
        { enabled: true, triggerType: "work_order.completed", triggerConfig: {} },
        event
      )
    ).toBe(true);
    expect(
      workflowMatchesEvent(
        { enabled: false, triggerType: "work_order.completed", triggerConfig: {} },
        event
      )
    ).toBe(false);
    expect(
      workflowMatchesEvent(
        { enabled: true, triggerType: "work_order.created", triggerConfig: {} },
        event
      )
    ).toBe(false);
  });

  it("filters status_changed by optional toStatus", () => {
    const event = {
      type: "work_order.status_changed" as const,
      entityType: "work_order",
      entityId: "wo1",
      actorUserId: "u1",
      actorName: "Ana",
      payload: { status: "cancelled" },
    };
    expect(
      workflowMatchesEvent(
        {
          enabled: true,
          triggerType: "work_order.status_changed",
          triggerConfig: { toStatus: "cancelled" },
        },
        event
      )
    ).toBe(true);
    expect(
      workflowMatchesEvent(
        {
          enabled: true,
          triggerType: "work_order.status_changed",
          triggerConfig: { toStatus: "completed" },
        },
        event
      )
    ).toBe(false);
  });
});

describe("parseWorkflowDefinition", () => {
  it("accepts a notify flow and rejects empty actions", () => {
    const ok = parseWorkflowDefinition({
      name: "Avisar al crear",
      triggerType: "work_order.created",
      actions: [defaultWorkflowAction("notify")],
    });
    expect(ok.ok).toBe(true);
    expect(
      parseWorkflowDefinition({
        name: "Sin acciones",
        triggerType: "work_order.created",
        actions: [],
      }).ok
    ).toBe(false);
  });

  it("rejects empty actions", () => {
    expect(
      parseWorkflowDefinition({
        name: "Sin acciones",
        triggerType: "work_order.created",
        actions: [],
      }).ok
    ).toBe(false);
  });
});

describe("filterRecipientUserIds", () => {
  it("resolves assignees and can exclude the actor", () => {
    expect(
      filterRecipientUserIds({
        recipientKind: "assignees",
        assigneeIds: ["a", "b", "actor"],
        requesterId: "r",
        actorUserId: "actor",
        selectedUserIds: [],
        roleUserIds: [],
        excludeActor: true,
      })
    ).toEqual(["a", "b"]);
    expect(
      filterRecipientUserIds({
        recipientKind: "requester",
        assigneeIds: ["a"],
        requesterId: "r",
        actorUserId: "r",
        selectedUserIds: [],
        roleUserIds: [],
        excludeActor: true,
      })
    ).toEqual([]);
  });
});

describe("parseEmailList / contact emails", () => {
  it("dedupes valid addresses", () => {
    expect(parseEmailList("Ana@X.com, bob@x.com ana@x.com")).toEqual([
      "ana@x.com",
      "bob@x.com",
    ]);
    expect(
      collectEventContactEmails({ contactEmail: "planta@amissa.mx" })
    ).toEqual(["planta@amissa.mx"]);
  });
});

describe("buildWorkflowEvent / coerceStoredWorkflowActions", () => {
  it("stringifies payload values and drops invalid stored actions", () => {
    const event = buildWorkflowEvent({
      type: "work_order.completed",
      entityType: "work_order",
      entityId: "wo1",
      actorUserId: "u1",
      actorName: "Ana",
      payload: { folio: 2044, title: "Prensa" },
    });
    expect(event.payload.folio).toBe("2044");
    expect(
      coerceStoredWorkflowActions([
        defaultWorkflowAction("notify"),
        { type: "nope" },
      ]).length
    ).toBe(1);
  });
});

describe("workflowTemplateVarsFromEvent", () => {
  it("merges payload with actorName", () => {
    const vars = workflowTemplateVarsFromEvent({
      type: "work_order.note_added",
      entityType: "work_order",
      entityId: "wo1",
      actorUserId: "u1",
      actorName: "Luis",
      payload: { title: "Fuga", note: "Revisar sello" },
    });
    expect(vars.actorName).toBe("Luis");
    expect(vars.title).toBe("Fuga");
    expect(vars.note).toBe("Revisar sello");
  });
});
