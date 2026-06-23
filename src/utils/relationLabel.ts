import type { RelationOption } from '../services/api';

export function relationLabel(relations: RelationOption[], value: string): string {
  if (!value) return '—';
  return relations.find(r => r.value === value)?.label ?? value;
}
