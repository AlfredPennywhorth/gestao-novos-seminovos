import { useCallback, useMemo, useState } from 'react';
import type { FiltrosDashboard } from '@/types/dashboard';
import { TipoSaida } from '@/types/database';

// ============================================================
// Valores padrão dos filtros
// ============================================================

const ANO_ATUAL = new Date().getFullYear();

const FILTROS_PADRAO: FiltrosDashboard = {
  ano: ANO_ATUAL,
  mesInicio: 1,
  mesFim: 12,
  almoxarifadoId: undefined,
  setorId: undefined,
  itemId: undefined,
  tipo: undefined,
};

// ============================================================
// Types retornados pelo hook
// ============================================================

interface UseFiltrosDashboardReturn {
  filtros: FiltrosDashboard;
  /** Define um campo individual do filtro */
  setFiltro: <K extends keyof FiltrosDashboard>(key: K, value: FiltrosDashboard[K]) => void;
  /** Reseta todos os filtros para os valores padrão */
  resetFiltros: () => void;
  /** Date calculada para o início do período filtrado (primeiro dia do mês) */
  dataInicio: Date;
  /** Date calculada para o fim do período filtrado (último dia do mês) */
  dataFim: Date;
  /** String ISO do início ("YYYY-MM-01") — útil para queries no Supabase */
  competenciaInicio: string;
  /** String ISO do fim ("YYYY-MM-DD") — último dia do mês fim */
  competenciaFim: string;
}

// ============================================================
// Helpers
// ============================================================

function calcDataInicio(filtros: FiltrosDashboard): Date {
  return new Date(Date.UTC(filtros.ano ?? ANO_ATUAL, (filtros.mesInicio ?? 1) - 1, 1));
}

function calcDataFim(filtros: FiltrosDashboard): Date {
  // Último dia do mês: dia 0 do mês seguinte
  return new Date(Date.UTC(filtros.ano ?? ANO_ATUAL, filtros.mesFim ?? 12, 0));
}

function toISODate(date: Date): string {
  const ano = date.getUTCFullYear();
  const mes = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(date.getUTCDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

// ============================================================
// Hook
// ============================================================

/**
 * Hook que gerencia o estado dos filtros globais do dashboard.
 *
 * Fornece:
 * - `filtros`: estado atual dos filtros
 * - `setFiltro`: atualiza um campo individual
 * - `resetFiltros`: volta aos valores padrão
 * - `dataInicio` / `dataFim`: objetos Date calculados
 * - `competenciaInicio` / `competenciaFim`: strings ISO para queries
 */
export function useFiltrosDashboard(): UseFiltrosDashboardReturn {
  const [filtros, setFiltros] = useState<FiltrosDashboard>(FILTROS_PADRAO);

  const setFiltro = useCallback(
    <K extends keyof FiltrosDashboard>(key: K, value: FiltrosDashboard[K]) => {
      setFiltros((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const resetFiltros = useCallback(() => {
    setFiltros(FILTROS_PADRAO);
  }, []);

  const dataInicio = useMemo(() => calcDataInicio(filtros), [filtros]);
  const dataFim = useMemo(() => calcDataFim(filtros), [filtros]);
  const competenciaInicio = useMemo(() => toISODate(dataInicio), [dataInicio]);
  const competenciaFim = useMemo(() => toISODate(dataFim), [dataFim]);

  return {
    filtros,
    setFiltro,
    resetFiltros,
    dataInicio,
    dataFim,
    competenciaInicio,
    competenciaFim,
  };
}

// Re-exporta o enum para conveniência dos consumidores
export { TipoSaida };
