import { record } from "./payment-validation.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-paystack-signature",
};
export function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
export function methodResponse(req: Request): Response | null {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  return req.method === "POST" ? null : json({ error: "Method not allowed" }, 405);
}
export function bearerToken(req: Request): string {
  const match = /^Bearer\s+(\S+)$/i.exec(req.headers.get("Authorization") ?? "");
  if (!match) throw new Error("Unauthorized");
  return match[1];
}
export async function requestObject(req: Request): Promise<Record<string, unknown>> {
  const raw = await boundedText(req, 65536);
  return record(JSON.parse(raw));
}
export async function boundedText(req: Request, maxBytes: number): Promise<string> {
  if (Number(req.headers.get("content-length")) > maxBytes) throw new Error("Payload too large");
  const reader = req.body?.getReader();
  if (!reader) throw new Error("Missing body");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new Error("Payload too large"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
export function failure(error: unknown): Response {
  const message = error instanceof Error ? error.message : "";
  if (message === "Unauthorized") return json({ error: message }, 401);
  if (message === "Forbidden") return json({ error: message }, 403);
  if (error instanceof SyntaxError || /^(Invalid |Missing body|Payload too large)/.test(message))
    return json({ error: "Invalid request" }, 400);
  return json({ error: "The request could not be completed" }, 500);
}

