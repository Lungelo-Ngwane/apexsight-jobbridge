export function getSupabaseTransformedImageUrl(
  url: string | null | undefined,
  options: {
    width: number;
    height?: number;
    resize?: "cover" | "contain" | "fill";
    quality?: number;
  },
): string {
  const rawUrl = String(url ?? "").trim();
  if (!rawUrl) return "";

  try {
    const parsed = new URL(rawUrl);
    parsed.pathname = parsed.pathname.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/");
    parsed.searchParams.set("width", String(options.width));
    if (options.height) {
      parsed.searchParams.set("height", String(options.height));
    }
    parsed.searchParams.set("resize", options.resize ?? "cover");
    if (options.quality) {
      parsed.searchParams.set("quality", String(options.quality));
    }
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}
