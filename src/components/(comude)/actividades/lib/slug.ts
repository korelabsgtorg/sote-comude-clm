export function extractUuid(idOrSlug: string): string {
  if (!idOrSlug) return "";
  const match = idOrSlug.match(/^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/);
  return match ? match[1] : idOrSlug;
}

export function slugify(text: string): string {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getComudeUrl(id: string, titulo?: string): string {
  const cleanId = extractUuid(id);
  const slug = titulo ? slugify(titulo) : "";
  return slug ? `/comude/comude/${slug}` : `/comude/comude/${cleanId}`;
}
