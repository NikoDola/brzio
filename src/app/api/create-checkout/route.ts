import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { priceLogoOrder, priceWebsiteOrder, type PriceResult } from "@/lib/pricing";
import { sanitizeCheckoutInput } from "@/lib/orderValidation";
import { checkCheckoutRateLimit } from "@/lib/rateLimit";
import { verifyRecaptchaToken } from "@/lib/recaptcha-server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

// Never trust the Origin header for redirects — an attacker can spoof it
// to redirect victims to a phishing site after payment.
function getSiteUrl(req: NextRequest): string {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (envUrl) return envUrl;
  if (process.env.NODE_ENV === "production") return "https://thelogoprofessionals.com";
  return req.headers.get("origin") ?? "http://localhost:3000";
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const recaptchaToken = (body as { recaptchaToken?: unknown })?.recaptchaToken;
  const captcha = await verifyRecaptchaToken(recaptchaToken);
  if (!captcha.ok) {
    return NextResponse.json({ error: captcha.reason }, { status: 403 });
  }

  const validated = sanitizeCheckoutInput(body);
  if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });
  const input = validated.data;

  const limit = await checkCheckoutRateLimit(clientIp(req), input.clientEmail.toLowerCase());
  if (!limit.ok) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${Math.ceil(limit.retryAfterSec / 60)} min.` },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  const isWebsite = input.serviceType === "website";

  let priced: PriceResult;
  try {
    if (isWebsite) {
      priced = priceWebsiteOrder({
        siteType: input.websiteTypeInfo?.siteType,
        pagesMode: input.websitePagesInfo?.mode,
        pages: input.websitePagesInfo?.pages,
        domainMode: input.websiteExtrasInfo?.domainMode,
        hostingMode: input.websiteExtrasInfo?.hostingMode,
        maintenance: input.websiteExtrasInfo?.maintenance,
        couponApplied: input.couponApplied,
        couponCode: input.couponCode,
        payOption: input.payOption,
      });
    } else {
      priced = priceLogoOrder({
        variations: input.order?.variations,
        typographyType: input.order?.typographyType,
        customPrice: input.order?.customPrice,
        couponApplied: input.couponApplied,
        couponCode: input.couponCode,
        payOption: input.payOption,
      });
    }
  } catch (err) {
    console.error("Pricing error:", err);
    return NextResponse.json({ error: "Pricing failed." }, { status: 400 });
  }

  if (priced.dueNow < 1 || priced.dueNow > 50000) {
    return NextResponse.json({ error: "Computed amount is out of allowed range." }, { status: 400 });
  }

  const productName = isWebsite
    ? "Website Design"
    : input.serviceType === "redesign" ? "Logo Redesign" : "Logo Design";

  const productDesc = input.payOption === "deposit"
    ? "35% deposit — remaining balance due before final delivery."
    : "Full payment.";

  const origin = getSiteUrl(req);

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: input.clientEmail,
      line_items: [{
        price_data: {
          currency: "usd",
          unit_amount: priced.dueNow * 100,
          product_data: {
            name: `${productName} — ${input.payOption === "deposit" ? "Deposit" : "Full Payment"}`,
            description: productDesc,
          },
        },
        quantity: 1,
      }],
      metadata: {
        order_type: input.serviceType,
        client_name: input.clientName,
        client_email: input.clientEmail,
        pay_option: input.payOption,
      },
      success_url: `${origin}/services/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/services/cancel`,
    });
  } catch (err) {
    console.error("Stripe session error:", err);
    return NextResponse.json({ error: "Failed to create checkout session." }, { status: 500 });
  }

  const companyName = isWebsite
    ? input.websiteInfo?.companyName ?? ""
    : input.order?.companyName ?? "";

  const orderDoc: Record<string, unknown> = {
    type: input.serviceType,
    status: "pending",
    stripeSessionId: session.id,
    clientName: input.clientName,
    clientEmail: input.clientEmail,
    companyName,
    payOption: input.payOption,
    amount: priced.dueNow * 100,
    totalAmount: priced.total * 100,
    couponApplied: input.couponApplied,
    fileMetadata: input.fileMetadata ?? null,
    createdAt: FieldValue.serverTimestamp(),
  };

  if (isWebsite) {
    orderDoc.websiteInfo = input.websiteInfo ?? {};
    orderDoc.websiteTypeInfo = input.websiteTypeInfo ?? {};
    orderDoc.websitePagesInfo = input.websitePagesInfo ?? {};
    orderDoc.websiteStyleInfo = input.websiteStyleInfo ?? {};
    orderDoc.websiteColorsInfo = input.websiteColorsInfo ?? {};
    orderDoc.websiteFontsInfo = input.websiteFontsInfo ?? {};
    orderDoc.websiteExtrasInfo = input.websiteExtrasInfo ?? {};
  } else {
    orderDoc.order = input.order ?? {};
  }

  try {
    await adminDb.collection("orders").add(orderDoc);
  } catch (err) {
    console.error("Order save error (Stripe session was already created):", err);
  }

  return NextResponse.json({ url: session.url });
}
