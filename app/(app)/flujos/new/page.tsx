import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { asc, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { isSmtpConfigured } from "@/lib/smtp-config";
import { isTelegramConfigured } from "@/lib/telegram-config";
import { SetPageHeader } from "@/components/SetPageHeader";
import { WorkflowForm } from "../WorkflowForm";

export default async function NewFlujoPage() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
        No tienes permisos para administrar flujos.
      </div>
    );
  }

  const userRows = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.isDisabled, false))
    .orderBy(asc(users.name));

  return (
    <div className="space-y-4">
      <SetPageHeader
        title="Nuevo flujo"
        filters={
          <Link
            href="/flujos"
            className="inline-flex items-center gap-1 text-sm font-medium text-[#F14C03] hover:underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Flujos
          </Link>
        }
      />
      <WorkflowForm
        users={userRows}
        smtpConfigured={isSmtpConfigured()}
        telegramConfigured={isTelegramConfigured()}
      />
    </div>
  );
}
