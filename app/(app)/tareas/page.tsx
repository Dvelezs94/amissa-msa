import { redirect } from "next/navigation";
import { WorkOrderList } from "./WorkOrderList";
import { TareasPageHeader } from "./TareasPageHeader";
import { getSession } from "@/lib/auth";

export default async function WorkOrdersPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <div className="space-y-4">
      <TareasPageHeader />
      <WorkOrderList
        currentUserId={session.id}
        isAdmin={session.role === "admin"}
      />
    </div>
  );
}
