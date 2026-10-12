import { describe, expect, it } from "vitest";
import { buildPublicOrderTimeline } from "@/lib/public-order-timeline";

describe("buildPublicOrderTimeline", () => {
  it("orders registration, comments, and completion", () => {
    const events = buildPublicOrderTimeline({
      status: "completed",
      createdAt: "2026-10-01T15:00:00.000Z",
      startedAt: "2026-10-02T15:00:00.000Z",
      completedAt: "2026-10-04T15:00:00.000Z",
      comments: [
        {
          id: "n1",
          createdAt: "2026-10-03T15:00:00.000Z",
          authorName: "Ana",
          text: "Pieza pedida",
          inlineFiles: [],
        },
      ],
    });
    expect(events.map((event) => event.title)).toEqual([
      "Orden registrada",
      "Trabajo iniciado",
      "Comentario",
      "Orden completada",
    ]);
    expect(events[2]).toMatchObject({
      detail: "Pieza pedida",
      authorName: "Ana",
    });
  });

  it("keeps a file-only note and a cancellation", () => {
    const events = buildPublicOrderTimeline({
      status: "cancelled",
      createdAt: "2026-10-01T15:00:00.000Z",
      startedAt: null,
      completedAt: "2026-10-02T15:00:00.000Z",
      comments: [
        {
          id: "n2",
          createdAt: "2026-10-01T18:00:00.000Z",
          authorName: "Luis",
          text: "  ",
          inlineFiles: [{ filename: "foto.jpg", url: "/x" }],
        },
      ],
    });
    expect(events.map((event) => event.kind)).toEqual([
      "created",
      "comment",
      "cancelled",
    ]);
    expect(events[1]?.title).toBe("Archivo");
    expect(events[1]?.files).toHaveLength(1);
  });
});
