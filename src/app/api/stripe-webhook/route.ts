import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature error:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    const snap = await adminDb
      .collection("orders")
      .where("stripeSessionId", "==", session.id)
      .limit(1)
      .get();

    if (snap.empty) {
      // Order doc not found — return 200 so Stripe doesn't retry forever.
      return NextResponse.json({ received: true });
    }

    const doc = snap.docs[0];
    if (doc.data().status === "paid") {
      // Already processed (Stripe retried). Skip duplicate update so we
      // don't overwrite the original paidAt timestamp.
      return NextResponse.json({ received: true, deduplicated: true });
    }

    await doc.ref.update({
      status: "paid",
      paidAt: FieldValue.serverTimestamp(),
      stripePaymentIntentId: session.payment_intent,
      amountPaid: session.amount_total,
    });
  }

  return NextResponse.json({ received: true });
}
