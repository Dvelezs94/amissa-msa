import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { runWorkflowAction } from "@/lib/workflow-engine";
import {
  parseWorkflowAction,
  type WorkflowActionType,
} from "@/lib/workflows";
import {
  buildWorkflowTestEvent,
  parseWorkflowTestTriggerType,
  workflowActionForDryRun,
} from "@/lib/workflow-test-action";

function requireAdmin(session: { role: string } | null) {
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

function successMessage(type: WorkflowActionType): string {
  if (type === "email") return "Email de prueba enviado a tu correo";
  if (type === "telegram") return "Mensaje de prueba enviado a Telegram";
  return "Notificación de prueba enviada a tu cuenta";
}

export async function POST(req: Request) {
  const session = await getSession();
  const denied = requireAdmin(session);
  if (denied) return denied;

  const body = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const action = parseWorkflowAction(body.action);
  if (!action) {
    return NextResponse.json(
      { error: "Hay una acción inválida (revisa el tipo o destinatarios)" },
      { status: 400 }
    );
  }
  if (action.type === "email" && !session!.email) {
    return NextResponse.json(
      { error: "Tu usuario no tiene email para la prueba" },
      { status: 400 }
    );
  }

  const tester = {
    id: session!.id,
    name: session!.name,
    email: session!.email,
  };
  const event = buildWorkflowTestEvent({
    triggerType: parseWorkflowTestTriggerType(body.triggerType),
    tester,
  });
  const result = await runWorkflowAction(
    workflowActionForDryRun(action, tester),
    event
  );

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        skipped: Boolean(result.skipped),
        error: result.error || "La prueba falló",
      },
      { status: result.skipped ? 400 : 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: successMessage(action.type),
  });
}
