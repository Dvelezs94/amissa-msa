import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { attachments, workOrders } from "@/lib/db/schema";
import { publicWebWorkOrderFilter } from "@/lib/public-web-work-order-filter";
import { workOrderFolioEquals } from "@/lib/work-order-folio";
import { parseWorkOrderFolioInput } from "@/lib/work-order-folio-helpers";
import { presignS3PublicUrl } from "@/lib/s3-storage";

export const dynamic = "force-dynamic";

/**
 * Download an attachment when the requester proves knowledge of the work order folio.
 * (Unauthenticated; pair `attachmentId` + `folio` must match DB.)
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ attachmentId: string }> }
) {
  const url = new URL(req.url);
  const folioRaw = url.searchParams.get("folio")?.trim() ?? "";
  const parsedFolio = parseWorkOrderFolioInput(folioRaw);
  const folioMatch = parsedFolio ? workOrderFolioEquals(parsedFolio.canonical) : null;
  if (!folioMatch) {
    return NextResponse.json({ error: "Folio no valido." }, { status: 400 });
  }

  const { attachmentId } = await params;

  const [row] = await db
    .select({
      fileUrl: attachments.fileUrl,
      woFolio: workOrders.folio,
    })
    .from(attachments)
    .innerJoin(workOrders, eq(attachments.workOrderId, workOrders.id))
    .where(
      and(eq(attachments.id, attachmentId), folioMatch, publicWebWorkOrderFilter)
    )
    .limit(1);

  if (!row || row.woFolio == null) {
    return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  }

  return NextResponse.redirect(presignS3PublicUrl(row.fileUrl), { status: 302 });
}
