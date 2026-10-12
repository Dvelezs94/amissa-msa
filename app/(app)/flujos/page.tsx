import Link from "next/link";
import { desc } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { workflowDefinitions } from "@/lib/db/schema";
import { SetPageHeader } from "@/components/SetPageHeader";
import { coerceStoredWorkflowActions } from "@/lib/workflows";
import { WorkflowList } from "./WorkflowList";

export default async function FlujosPage() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
        No tienes permisos para administrar flujos.
      </div>
    );
  }

  const rows = await db
    .select({
      id: workflowDefinitions.id,
      name: workflowDefinitions.name,
      description: workflowDefinitions.description,
      enabled: workflowDefinitions.enabled,
      triggerType: workflowDefinitions.triggerType,
      actions: workflowDefinitions.actions,
    })
    .from(workflowDefinitions)
    .orderBy(desc(workflowDefinitions.updatedAt));

  return (
    <div className="space-y-4">
      <SetPageHeader
        title="Flujos"
        actions={
          <Link
            href="/flujos/new"
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            Nuevo flujo
          </Link>
        }
      />
      <p className="max-w-xl text-sm text-zinc-500">
        Automatiza avisos cuando pasa algo en MSA: una tarea se completa, hay
        una nota nueva, llega una orden de trabajo o Calidad revisa un
        checklist.
      </p>
      <WorkflowList
        initial={rows.map((row) => {
          const actions = coerceStoredWorkflowActions(row.actions);
          return {
            id: row.id,
            name: row.name,
            description: row.description,
            enabled: row.enabled,
            triggerType: row.triggerType,
            actions: actions.map((action) => ({ type: action.type })),
          };
        })}
      />
    </div>
  );
}
