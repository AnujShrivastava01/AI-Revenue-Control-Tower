import { NextResponse } from "next/server";
import { buildPaymentEvents, getDataset } from "@/lib/demo/dataset";
import { transactionIdSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = transactionIdSchema.safeParse(id);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid transaction id." }, { status: 400 });
  }
  const ds = getDataset();
  const txn = ds.byId.get(parsed.data);
  if (!txn) {
    return NextResponse.json({ error: "Transaction not found." }, { status: 404 });
  }
  const customer = ds.customerById.get(txn.customerId);
  const product = ds.productById.get(txn.productId);
  const refund = ds.refunds.find((r) => r.transactionId === txn.id) ?? null;

  return NextResponse.json({
    transaction: txn,
    customer,
    product,
    refund,
    events: buildPaymentEvents(txn),
  });
}
