/** Human-friendly labels for built-in style guide IDs. */
export const STYLE_DISPLAY_NAMES: Record<string, string> = {
  general: "General",
  "literary-essay": "Essay",
  technical: "Technical",
  journalism: "Newsletter",
  fiction: "Creative",
  marketing: "Marketing",
  academic: "Academic",
  code: "Code",
};

export function styleDisplayName(id: string | undefined | null): string {
  if (!id) return "No style guide";
  return STYLE_DISPLAY_NAMES[id] ?? id.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}
