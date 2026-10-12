import { describe, expect, it } from "vitest";
import {
  WORKFLOW_CANVAS,
  clampWorkflowCanvasZoom,
  layoutWorkflowCanvas,
  workflowActionSummary,
  workflowCanvasActionId,
  workflowCanvasBezier,
  workflowMiniGraphChips,
  workflowTriggerSummary,
} from "@/lib/workflow-canvas";
import { defaultWorkflowAction } from "@/lib/workflows";

describe("layoutWorkflowCanvas", () => {
  it("places action nodes to the right of the trigger with no editor chrome", () => {
    const layout = layoutWorkflowCanvas(1);
    const trigger = layout.nodes.find((n) => n.kind === "trigger");
    const action = layout.nodes.find((n) => n.id === workflowCanvasActionId(0));
    expect(trigger).toBeTruthy();
    expect(action).toBeTruthy();
    expect(layout.nodes.map((n) => n.kind).sort()).toEqual(["action", "trigger"]);
    expect(action!.x).toBe(
      WORKFLOW_CANVAS.padding +
        WORKFLOW_CANVAS.nodeWidth +
        WORKFLOW_CANVAS.colGap
    );
    expect(action!.y).toBe(WORKFLOW_CANVAS.padding);
    expect(trigger!.y).toBe(WORKFLOW_CANVAS.padding);
    expect(layout.edges).toHaveLength(1);
  });

  it("centers the trigger among stacked actions", () => {
    const layout = layoutWorkflowCanvas(2);
    const trigger = layout.nodes.find((n) => n.kind === "trigger")!;
    const actionsHeight =
      2 * WORKFLOW_CANVAS.actionHeight + WORKFLOW_CANVAS.rowGap;
    expect(trigger.y).toBe(
      WORKFLOW_CANVAS.padding +
        (actionsHeight - WORKFLOW_CANVAS.triggerHeight) / 2
    );
  });

  it("renders only the trigger when there are no actions", () => {
    const layout = layoutWorkflowCanvas(0);
    expect(layout.nodes.map((n) => n.kind)).toEqual(["trigger"]);
    expect(layout.edges).toHaveLength(0);
  });
});

describe("workflowCanvasBezier", () => {
  it("emits a cubic path from left to right", () => {
    expect(workflowCanvasBezier(0, 10, 100, 10)).toMatch(
      /^M 0 10 C \d+ 10, \d+ 10, 100 10$/
    );
  });
});

describe("summaries and mini graph", () => {
  it("summarizes trigger status filter and action recipients", () => {
    expect(workflowTriggerSummary("work_order.completed")).toBe(
      "Tarea completada"
    );
    expect(
      workflowTriggerSummary("work_order.status_changed", "cancelled")
    ).toBe("Solo si queda Cancelada");
    expect(
      workflowActionSummary({
        ...defaultWorkflowAction("notify"),
        recipientKind: "role",
        role: "calidad",
        title: "",
      })
    ).toBe("Calidad");
    expect(
      workflowActionSummary({
        ...defaultWorkflowAction("telegram"),
        telegramChatId: "-1009",
      })
    ).toBe("Telegram -1009");
    expect(workflowActionSummary(defaultWorkflowAction("telegram"))).toBe(
      "Canal de Telegram"
    );
  });

  it("builds chips for the list preview", () => {
    const chips = workflowMiniGraphChips({
      triggerType: "work_order.created",
      actions: [{ type: "notify" }, { type: "email" }, { type: "telegram" }],
    });
    expect(chips.map((c) => c.label)).toEqual([
      "Tarea creada",
      "Notificación en la app",
      "Enviar email",
      "Telegram",
    ]);
  });
});

describe("clampWorkflowCanvasZoom", () => {
  it("keeps zoom in a usable range", () => {
    expect(clampWorkflowCanvasZoom(0.1)).toBe(0.55);
    expect(clampWorkflowCanvasZoom(4)).toBe(1.6);
    expect(clampWorkflowCanvasZoom(1)).toBe(1);
    expect(clampWorkflowCanvasZoom(Number.NaN)).toBe(1);
  });
});
