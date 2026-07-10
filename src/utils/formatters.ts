/**
 * Formata um valor numérico como moeda brasileira (BRL).
 * @example formatCurrency(1234.56) → "R$ 1.234,56"
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Formata um número inteiro com separador de milhar brasileiro.
 * @example formatNumber(1234) → "1.234"
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Formata um número como percentual brasileiro.
 * @param value  Valor de 0 a 100 (ex: 45.3)
 * @param decimals Casas decimais (padrão: 1)
 * @example formatPercent(45.3) → "45,3%"
 */
export function formatPercent(value: number, decimals = 1): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value) + '%';
}

/**
 * Formata uma data como "mês abreviado/ano" em português.
 * Aceita string ISO ou objeto Date.
 * @example formatDate("2024-01-15") → "jan/2024"
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date + (date.length === 10 ? 'T12:00:00' : '')) : date;
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  })
    .format(d)
    .replace('.', '')
    .replace(' de ', '/');
}

/**
 * Formata uma data como "Mês por extenso/Ano" em português.
 * @example formatCompetencia("2024-01-01") → "Janeiro/2024"
 */
export function formatCompetencia(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date + (date.length === 10 ? 'T12:00:00' : '')) : date;
  const mes = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    timeZone: 'America/Sao_Paulo',
  }).format(d);
  const ano = new Intl.DateTimeFormat('pt-BR', {
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  }).format(d);
  return `${mes.charAt(0).toUpperCase()}${mes.slice(1)}/${ano}`;
}

// -----------------------------------------------------------------------
// Mapeamento de abreviações de meses para índice (0-based)
// -----------------------------------------------------------------------
const MESES_ABREV: Record<string, number> = {
  jan: 0,
  fev: 1,
  mar: 2,
  abr: 3,
  mai: 4,
  jun: 5,
  jul: 6,
  ago: 7,
  set: 8,
  out: 9,
  nov: 10,
  dez: 11,
};

/**
 * Converte um serial Excel (número de dias desde 1900-01-00) para Date no
 * primeiro dia do mês correspondente, sem deslocamento de fuso horário.
 */
function excelSerialToDate(serial: number): Date {
  // Excel conta a partir de 1 = 1900-01-01, com o bug do ano bissexto de 1900
  const EXCEL_EPOCH = new Date(Date.UTC(1899, 11, 30)); // 1899-12-30 UTC
  const ms = serial * 86400000;
  const raw = new Date(EXCEL_EPOCH.getTime() + ms);
  // Retorna o primeiro dia do mês no UTC para evitar fuso
  return new Date(Date.UTC(raw.getUTCFullYear(), raw.getUTCMonth(), 1));
}

/**
 * Converte um serial Excel OU string de competência para Date no primeiro
 * dia do mês, sem deslocamento de fuso horário.
 *
 * Formatos suportados:
 * - Serial Excel numérico (ex: 46175)
 * - "jun/2026" ou "Jun/2026"
 * - "06/2026" ou "6/2026"
 * - "2026-06-01" (ISO date)
 * - "2026-06" (ISO year-month)
 *
 * @returns Date no primeiro dia do mês em UTC, ou null se não reconhecido.
 */
export function competenciaToDate(competencia: string | number): Date | null {
  if (typeof competencia === 'number') {
    if (!isFinite(competencia) || competencia <= 0) return null;
    return excelSerialToDate(competencia);
  }

  const raw = competencia.trim();
  if (!raw) return null;

  // Tenta como número (string numérica = serial Excel)
  const asNumber = Number(raw);
  if (!isNaN(asNumber) && asNumber > 0 && String(asNumber) === raw) {
    return excelSerialToDate(asNumber);
  }

  // Formato "jun/2026" ou "Jun/2026"
  const abrevMatch = raw.match(/^([a-zA-Záéíóúâêôãõç]{3})[\/-](\d{4})$/i);
  if (abrevMatch) {
    const mesAbrev = abrevMatch[1].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const ano = parseInt(abrevMatch[2], 10);
    const mesIdx = MESES_ABREV[mesAbrev];
    if (mesIdx !== undefined && !isNaN(ano)) {
      return new Date(Date.UTC(ano, mesIdx, 1));
    }
  }

  // Formato "06/2026" ou "6/2026"
  const numericMonthMatch = raw.match(/^(\d{1,2})[\/-](\d{4})$/);
  if (numericMonthMatch) {
    const mes = parseInt(numericMonthMatch[1], 10) - 1; // 0-based
    const ano = parseInt(numericMonthMatch[2], 10);
    if (mes >= 0 && mes <= 11 && !isNaN(ano)) {
      return new Date(Date.UTC(ano, mes, 1));
    }
  }

  // Formato ISO "2026-06-01" ou "2026-06"
  const isoMatch = raw.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
  if (isoMatch) {
    const ano = parseInt(isoMatch[1], 10);
    const mes = parseInt(isoMatch[2], 10) - 1; // 0-based
    if (mes >= 0 && mes <= 11 && !isNaN(ano)) {
      return new Date(Date.UTC(ano, mes, 1));
    }
  }

  return null;
}

/**
 * Converte um objeto Date para string ISO do primeiro dia do mês ("YYYY-MM-01").
 * Usa UTC para evitar deslocamento de fuso.
 * @example dateToCompetencia(new Date("2026-06-15")) → "2026-06-01"
 */
export function dateToCompetencia(date: Date): string {
  const ano = date.getUTCFullYear();
  const mes = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${ano}-${mes}-01`;
}
