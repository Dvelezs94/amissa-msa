import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assets, attachments, notes, users, workOrders } from "@/lib/db/schema";
import { createId } from "@/lib/id";
import { recordAuditLog } from "@/lib/audit";
import { getNextWorkOrderFolio } from "@/lib/work-order-folio";
import { publicWebWorkOrderFilter } from "@/lib/public-web-work-order-filter";
import {
  parsePublicOrderLookup,
  publicContactEmailLinePattern,
} from "@/lib/public-order-lookup";
import {
  buildPublicAttachmentUrlMaps,
  extractInlineFilesFromRewrittenNote,
  rewriteNoteBodyToPublicDownloadUrls,
} from "@/lib/solicitud-public-note-urls";
import { emitWorkflowEvent } from "@/lib/workflow-engine";
import { buildWorkflowEvent } from "@/lib/workflows";

export const dynamic = "force-dynamic";

/** Public lookup by folio or contact email. Solo ordenes del formulario publico. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const emailRaw = url.searchParams.get("email")?.trim() ?? "";
  if (emailRaw) {
    const parsed = parsePublicOrderLookup(emailRaw);
    if (!parsed.ok || parsed.value.kind !== "email") {
      return NextResponse.json({ error: "Email no válido." }, { status: 400 });
    }
    const email = parsed.value.email;
    const rows = await db
      .select({
        folio: workOrders.folio,
        title: workOrders.title,
        status: workOrders.status,
        createdAt: workOrders.createdAt,
        assetName: assets.name,
        assetCode: assets.assetId,
      })
      .from(workOrders)
      .leftJoin(assets, eq(workOrders.assetId, assets.id))
      .where(
        and(
          publicWebWorkOrderFilter,
          isNotNull(workOrders.folio),
          sql`${workOrders.description} ~* ${publicContactEmailLinePattern(email)}`
        )
      )
      .orderBy(desc(workOrders.createdAt))
      .limit(50);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No se encontró una orden con ese email." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      orders: rows.map((row) => ({
        folio: row.folio,
        title: row.title,
        status: row.status,
        createdAt: row.createdAt?.toISOString() ?? null,
        assetName: row.assetName ?? null,
        assetCode: row.assetCode ?? null,
      })),
    });
  }

  const raw = url.searchParams.get("folio")?.trim() ?? "";
  if (!raw) {
    return NextResponse.json({ error: "Indica el folio de la orden." }, { status: 400 });
  }
  const folio = Number(raw);
  if (!Number.isInteger(folio) || folio < 1) {
    return NextResponse.json({ error: "Folio no valido." }, { status: 400 });
  }

  const [wo] = await db
    .select({
      id: workOrders.id,
      folio: workOrders.folio,
      title: workOrders.title,
      status: workOrders.status,
      priority: workOrders.priority,
      kind: workOrders.kind,
      createdAt: workOrders.createdAt,
      dueDate: workOrders.dueDate,
      startedAt: workOrders.startedAt,
      completedAt: workOrders.completedAt,
      assetName: assets.name,
      assetCode: assets.assetId,
    })
    .from(workOrders)
    .leftJoin(assets, eq(workOrders.assetId, assets.id))
    .where(and(eq(workOrders.folio, folio), publicWebWorkOrderFilter))
    .limit(1);

  if (!wo) {
    return NextResponse.json(
      { error: "No se encontro una orden con ese folio." },
      { status: 404 }
    );
  }

  const attachmentRows = await db.query.attachments.findMany({
    where: eq(attachments.workOrderId, wo.id),
    columns: { id: true, fileUrl: true, filename: true },
    orderBy: [desc(attachments.createdAt)],
  });
  const { byId, byUrl } = buildPublicAttachmentUrlMaps(attachmentRows, folio);

  const noteRows = await db.query.notes.findMany({
    where: eq(notes.workOrderId, wo.id),
    orderBy: [desc(notes.createdAt)],
  });

  const uniqueUserIds = Array.from(new Set(noteRows.map((n) => n.userId)));
  const authorRows =
    uniqueUserIds.length > 0
      ? await db.query.users.findMany({
          where: inArray(users.id, uniqueUserIds),
          columns: { id: true, name: true },
        })
      : [];
  const authorNameById = new Map(authorRows.map((u) => [u.id, u.name]));

  const comments = noteRows.map((note) => {
    const rewritten = rewriteNoteBodyToPublicDownloadUrls(note.body, folio, byId, byUrl);
    const { text, files } = extractInlineFilesFromRewrittenNote(rewritten);
    return {
      id: note.id,
      createdAt: note.createdAt.toISOString(),
      authorName: authorNameById.get(note.userId) ?? "Usuario",
      text,
      inlineFiles: files,
    };
  });

  return NextResponse.json({
    folio: wo.folio,
    title: wo.title,
    status: wo.status,
    priority: wo.priority,
    kind: wo.kind,
    assetName: wo.assetName ?? null,
    assetCode: wo.assetCode ?? null,
    createdAt: wo.createdAt?.toISOString() ?? null,
    dueDate: wo.dueDate?.toISOString() ?? null,
    startedAt: wo.startedAt?.toISOString() ?? null,
    completedAt: wo.completedAt?.toISOString() ?? null,
    comments,
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const titulo = (body.titulo ?? "").trim();
  const descripcion = (body.descripcion ?? "").trim();
  const prioridadRaw = String(body.prioridad ?? "medium").trim();
  const prioridad =
    prioridadRaw === "low" ||
    prioridadRaw === "medium" ||
    prioridadRaw === "high" ||
    prioridadRaw === "urgent"
      ? prioridadRaw
      : "medium";
  const nombreContacto = (body.nombreContacto ?? "").trim();
  const emailContacto = (body.emailContacto ?? "").trim().toLowerCase();
  const rawAssetId = String(body.assetId ?? "").trim();

  if (!titulo || !descripcion || !nombreContacto) {
    return NextResponse.json(
      { error: "Titulo, descripcion y nombre de contacto son obligatorios" },
      { status: 400 }
    );
  }

  let assetId: string | null = null;
  let assetLabel: string | null = null;
  if (rawAssetId) {
    const [asset] = await db
      .select({ id: assets.id, name: assets.name, assetId: assets.assetId })
      .from(assets)
      .where(eq(assets.id, rawAssetId))
      .limit(1);
    if (!asset) {
      return NextResponse.json({ error: "Máquina no válida." }, { status: 400 });
    }
    assetId = asset.id;
    assetLabel = `${asset.name} (${asset.assetId})`;
  }

  const detalleContacto = [
    assetLabel ? `Máquina: ${assetLabel}` : null,
    nombreContacto ? `Nombre contacto: ${nombreContacto}` : null,
    emailContacto ? `Email contacto: ${emailContacto}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const id = createId();
  const folio = await getNextWorkOrderFolio();
  const now = new Date();
  const finalDescription = detalleContacto
    ? `${descripcion}\n\n---\nOrden publica desde /orden\n${detalleContacto}`
    : `${descripcion}\n\n---\nOrden publica desde /orden`;

  await db.insert(workOrders).values({
    id,
    folio,
    title: titulo,
    description: finalDescription,
    status: "pending",
    priority: prioridad,
    kind: "on_demand",
    assetId,
    requesterId: null,
    createdAt: now,
    updatedAt: now,
  });

  await recordAuditLog({
    entityType: "work_order",
    entityId: id,
    action: "created_from_public_form",
    userId: null,
    metadata: {
      source: "/orden",
      title: titulo,
      priority: prioridad,
      hasContact: Boolean(nombreContacto),
      assetId,
    },
  });

  const woPayload = {
    title: titulo,
    folio,
    status: "pending",
    priority: prioridad,
    href: `/tareas/${id}`,
    contactEmail: emailContacto || null,
    contactName: nombreContacto,
    assetName: assetLabel,
    note: descripcion.slice(0, 500),
  };
  await emitWorkflowEvent(
    buildWorkflowEvent({
      type: "work_order.created",
      entityType: "work_order",
      entityId: id,
      actorUserId: null,
      actorName: nombreContacto,
      payload: woPayload,
    })
  );
  await emitWorkflowEvent(
    buildWorkflowEvent({
      type: "solicitud.created",
      entityType: "work_order",
      entityId: id,
      actorUserId: null,
      actorName: nombreContacto,
      payload: woPayload,
    })
  );

  return NextResponse.json({ ok: true, workOrderId: id, folio });
}
