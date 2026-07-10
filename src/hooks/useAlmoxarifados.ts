import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/services/supabase';
import type { Almoxarifado } from '@/types/database';

interface UseAlmoxarifadosReturn {
  almoxarifados: Almoxarifado[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Hook que busca todos os almoxarifados ativos do Supabase.
 * Ordena por nome ascendente.
 */
export function useAlmoxarifados(): UseAlmoxarifadosReturn {
  const [almoxarifados, setAlmoxarifados] = useState<Almoxarifado[]>([]);
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
        .from('almoxarifados')
        .select('*')
        .eq('ativo', true)
        .order('nome', { ascending: true });

      if (cancelled) return;

      if (supabaseError) {
        setError(supabaseError.message);
        setAlmoxarifados([]);
      } else {
        setAlmoxarifados((data ?? []) as Almoxarifado[]);
      }

      setLoading(false);
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [tick]);

  return { almoxarifados, loading, error, refetch };
}
