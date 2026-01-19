// Utility helpers for formatting.

export function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return date.toLocaleString();
}









