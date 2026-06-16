import { useEffect, useState } from 'react';
import { getRelations, type RelationOption } from '../services/api';

export function useRelations(enabled = true) {
  const [relations, setRelations] = useState<RelationOption[]>([]);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    getRelations()
      .then((data) => { if (!cancelled) setRelations(data); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [enabled]);

  return { relations, loading };
}
