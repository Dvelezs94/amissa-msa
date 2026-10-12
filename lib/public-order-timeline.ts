export type PublicOrderTimelineFile = { filename: string; url: string };

export type PublicOrderTimelineComment = {
  id: string;
  createdAt: string;
  authorName: string;
  text: string;
  inlineFiles: PublicOrderTimelineFile[];
};

export type PublicOrderTimelineKind =
  | "created"
  | "started"
  | "comment"
  | "completed"
  | "cancelled";

export type PublicOrderTimelineEvent = {
  id: string;
  at: string;
  kind: PublicOrderTimelineKind;
  title: string;
  detail: string | null;
  authorName: string | null;
  files: PublicOrderTimelineFile[];
};

const KIND_RANK: Record<PublicOrderTimelineKind, number> = {
  created: 0,
  started: 1,
  comment: 2,
  completed: 3,
  cancelled: 4,
};

/** Chronological public activity: registration, start, comments, close. */
export function buildPublicOrderTimeline(input: {
  status: string;
  createdAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  comments: PublicOrderTimelineComment[];
}): PublicOrderTimelineEvent[] {
  const events: PublicOrderTimelineEvent[] = [];

  if (input.createdAt) {
    events.push({
      id: "created",
      at: input.createdAt,
      kind: "created",
      title: "Orden registrada",
      detail: null,
      authorName: null,
      files: [],
    });
  }

  if (input.startedAt) {
    events.push({
      id: "started",
      at: input.startedAt,
      kind: "started",
      title: "Trabajo iniciado",
      detail: null,
      authorName: null,
      files: [],
    });
  }

  for (const comment of input.comments) {
    const text = comment.text.trim();
    events.push({
      id: `comment:${comment.id}`,
      at: comment.createdAt,
      kind: "comment",
      title: text ? "Comentario" : "Archivo",
      detail: text || null,
      authorName: comment.authorName,
      files: comment.inlineFiles,
    });
  }

  if (input.status === "completed" && input.completedAt) {
    events.push({
      id: "completed",
      at: input.completedAt,
      kind: "completed",
      title: "Orden completada",
      detail: null,
      authorName: null,
      files: [],
    });
  }

  if (input.status === "cancelled" && input.completedAt) {
    events.push({
      id: "cancelled",
      at: input.completedAt,
      kind: "cancelled",
      title: "Orden cancelada",
      detail: null,
      authorName: null,
      files: [],
    });
  }

  return events.sort((a, b) => {
    const byTime = a.at.localeCompare(b.at);
    if (byTime !== 0) return byTime;
    return KIND_RANK[a.kind] - KIND_RANK[b.kind];
  });
}
