export function formatDDMMYYYY(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return value.toString();
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

export function toInputDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function minIssueDate(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 3);
  return toInputDate(d);
}
