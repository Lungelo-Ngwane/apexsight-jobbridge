export interface CheckoutIntent {
  reference: string;
  employer_id: string;
  kind: "subscription" | "addon";
  amount_minor: number;
  currency: string;
  plan_name: string | null;
  addon_id: string | null;
  credit_type: string | null;
  credits: number | null;
  created_at: string;
  provider_plan_code?: string | null;
  provider_subscription_code?: string | null;
}

export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid object");
  return value as Record<string, unknown>;
}

export function paymentReference(value: unknown): string {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(value)) throw new Error("Invalid payment reference");
  return value;
}

export function positiveInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) throw new Error("Invalid positive integer");
  return value;
}

export function assertPaymentMatches(intent: CheckoutIntent, value: unknown, employerId?: string): void {
  const data = record(value);
  if (data.status !== "success" || paymentReference(data.reference) !== intent.reference ||
    positiveInteger(data.amount) !== intent.amount_minor || data.currency !== intent.currency ||
    (employerId !== undefined && intent.employer_id !== employerId)) {
    throw new Error("Payment does not match the checkout intent");
  }
  // Metadata is not the authority for fulfillment, but conflicting metadata is rejected.
  const metadata = record(data.metadata ?? {});
  if (intent.provider_subscription_code) {
    const customer = record(data.customer);
    const plan = record(data.plan_object ?? data.plan);
    if (!customer.customer_code || plan.plan_code !== intent.provider_plan_code) throw new Error("Recurring payment identity mismatch");
    return;
  }
  if (metadata.employerId !== intent.employer_id ||
    (intent.kind === "addon" && metadata.addonId !== intent.addon_id) ||
    (intent.kind === "subscription" && metadata.targetPlan !== intent.plan_name)) {
    throw new Error("Payment metadata does not match the checkout intent");
  }
}

export async function verifySignature(body: string, signature: string | null, secret: string): Promise<boolean> {
  if (!secret || !signature || !/^[a-fA-F0-9]{128}$/.test(signature)) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" }, false, ["verify"]);
  const bytes = Uint8Array.from(signature.match(/../g)!, hex => parseInt(hex, 16));
  return crypto.subtle.verify("HMAC", key, bytes, new TextEncoder().encode(body));
}

export function safeReturnPath(value: unknown, fallback = "/employer/addons"): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") &&
    !/[\\\r\n]/.test(value) ? value : fallback;
}

