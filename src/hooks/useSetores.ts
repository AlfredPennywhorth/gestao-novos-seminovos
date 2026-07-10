import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/services/supabase';
import type { Setor } from '@/types/database';

interface UseSetoresReturn {
  setores: Setor[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Hook que busca todos os setores ativos do Supabase.
 * Ordena por nome ascendente.
 */
export function useSetores(): UseSetoresReturn {
  const [setores, setSetores] = useState<Setor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async (): Promise<void> => {
      setLoading(true);
      setError(null);

      const { data, error: supabaseError } = await supabase
        .from('setores')
        .select('*')
        .eq('ativo', true)
        .order('nome', { ascending: true });

      if (cancelled) return;

      if (supabaseError) {
        setError(supabaseError.message);
        setSetores([]);
      } else {
        setSetores((data ?? []) as Setor[]);
      }

      setLoading(false);
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [tick]);

  return { setores, loading, error, refetch };
}
