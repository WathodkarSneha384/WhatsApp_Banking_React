import { useEffect, useState } from 'react';
import { getRelations, type RelationOption } from '../services/api';



export function useRelations(
  loadingFor: 'relation' | 'pmyrelation' = 'relation'
) {
  const [relations, setRelations] = useState<RelationOption[]>([]);

  useEffect(() => {
    getRelations(loadingFor).then(setRelations);
  }, [loadingFor]);

  return { relations };
}