import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/services/supabase';
import type { Item } from '@/types/database';

interface UseItensReturn {
  itens: Item[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Hook que busca itens ativos do Supabase.
 *
 * Se `setorId` for informado, filtra apenas os itens vinculados àquele setor
 * via tabela `item_setor` (apenas registros ativos).
 *
 * Ordena por nome ascendente.
 *
 * @param setorId - ID do setor para filtrar (opcional)
 */
export function useItens(setorId?: string): UseItensReturn {
  const [itens, setItens] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async (): Promise<void> => {
      setLoading(true);
      setError(null);

      let result: Item[] = [];
      let fetchError: string | null = null;

      if (setorId) {
        // Busca item_ids do setor e depois os itens correspondentes
        const { data: itemSetorData, error: isError } = await supabase
          .from('item_setor')
          .select('item_id')
          .eq('setor_id', setorId)
          .eq('ativo', true);

        if (isError) {
          fetchError = isError.message;
        } else if (itemSetorData && itemSetorData.length > 0) {
          const itemIds = itemSetorData.map((row) => row.item_id as string);

          const { data: itensData, error: itensError } = await supabase
            .from('itens')
            .select('*')
            .in('id', itemIds)
            .eq('ativo', true)
            .order('nome', { ascending: true });

          if (itensError) {
            fetchError = itensError.message;
          } else {
            result = (itensData ?? []) as Item[];
          }
        }
        // Se não há itens no setor, result permanece []
      } else {
        // Sem filtro de setor: busca todos os itens ativos
        const { data, error: supabaseError } = await supabase
          .from('itens')
          .select('*')
          .eq('ativo', true)
          .order('nome', { ascending: true });

        if (supabaseError) {
          fetchError = supabaseError.message;
        } else {
          result = (data ?? []) as Item[];
        }
      }

      if (cancelled) return;

      if (fetchError) {
        setError(fetchError);
        setItens([]);
      } else {
        setItens(result);
      }

      setLoading(false);
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [setorId, tick]);

  return { itens, loading, error, refetch };
}
