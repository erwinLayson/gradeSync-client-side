// Build a 1–2 letter monogram from a full name, e.g. "Maria Santos" -> "MS".
export function getInitials(name: string): string {
    const parts = name.split(" ").filter(Boolean);
    const initials = parts.slice(0, 2).map((part) => part.charAt(0)?.toUpperCase() ?? "").join("");
    return initials || "?";
}
