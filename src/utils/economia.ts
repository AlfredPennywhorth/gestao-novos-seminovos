// ============================================================
// Constantes padrão de custo (em R$)
// ============================================================

/** Custo unitário padrão de um item NOVO (R$) */
export const CUSTO_PADRAO_NOVO = 40;

/** Custo unitário padrão de um item SEMINOVO (R$) */
export const CUSTO_PADRAO_SEMINOVO = 4;

/** Economia padrão por unidade seminova (CUSTO_PADRAO_NOVO - CUSTO_PADRAO_SEMINOVO) */
export const ECONOMIA_PADRAO_UNITARIA = CUSTO_PADRAO_NOVO - CUSTO_PADRAO_SEMINOVO; // 36

// ============================================================
// Funções de cálculo de economia (puras, sem Supabase)
// ============================================================

/**
 * Calcula o custo que seria gasto se todos os seminovos fossem adquiridos
 * como novos (custo evitado bruto).
 *
 * @param qtdSeminovo - Quantidade de itens fornecidos como seminovos
 * @param valorNovo   - Valor médio unitário do item novo (R$)
 * @returns Custo bruto evitado em R$
 */
export function calcularCustoEvitadoBruto(
  qtdSeminovo: number,
  valorNovo: number,
): number {
  return qtdSeminovo * valorNovo;
}

/**
 * Calcula o custo efetivo gasto com os itens seminovos.
 *
 * @param qtdSeminovo   - Quantidade de itens fornecidos como seminovos
 * @param valorSeminovo - Valor médio unitário do item seminovo (R$)
 * @returns Custo total dos seminovos em R$
 */
export function calcularCustoSeminovo(
  qtdSeminovo: number,
  valorSeminovo: number,
): number {
  return qtdSeminovo * valorSeminovo;
}

/**
 * Calcula a economia líquida obtida com o uso de seminovos.
 * Economia = (qtd × valorNovo) - (qtd × valorSeminovo)
 *
 * @param qtdSeminovo   - Quantidade de itens fornecidos como seminovos
 * @param valorNovo     - Valor médio unitário do item novo (R$)
 * @param valorSeminovo - Valor médio unitário do item seminovo (R$)
 * @returns Economia líquida em R$
 */
export function calcularEconomiaLiquida(
  qtdSeminovo: number,
  valorNovo: number,
  valorSeminovo: number,
): number {
  return calcularCustoEvitadoBruto(qtdSeminovo, valorNovo) -
    calcularCustoSeminovo(qtdSeminovo, valorSeminovo);
}

/**
 * Calcula a economia estimada com base nos valores padrão do sistema.
 * Usa CUSTO_PADRAO_NOVO = 40 e CUSTO_PADRAO_SEMINOVO = 4.
 *
 * @param qtdSeminovo - Quantidade de itens fornecidos como seminovos
 * @returns Economia estimada em R$ (qtdSeminovo × ECONOMIA_PADRAO_UNITARIA)
 */
export function calcularEconomiaEstimada(qtdSeminovo: number): number {
  return qtdSeminovo * ECONOMIA_PADRAO_UNITARIA;
}

// ============================================================
// Funções auxiliares agregadas
// ============================================================

/**
 * Calcula todos os valores de economia de uma vez.
 *
 * @param qtdSeminovo   - Quantidade de seminovos
 * @param valorNovo     - Valor unitário novo (R$)
 * @param valorSeminovo - Valor unitário seminovo (R$)
 */
export function calcularEconomiaCompleta(
  qtdSeminovo: number,
  valorNovo: number,
  valorSeminovo: number,
): {
  custoEvitadoBruto: number;
  custoSeminovo: number;
  economiaLiquida: number;
} {
  const custoEvitadoBruto = calcularCustoEvitadoBruto(qtdSeminovo, valorNovo);
  const custoSeminovo = calcularCustoSeminovo(qtdSeminovo, valorSeminovo);
  return {
    custoEvitadoBruto,
    custoSeminovo,
    economiaLiquida: custoEvitadoBruto - custoSeminovo,
  };
}

/**
 * Calcula o percentual de seminovos em relação ao total de saídas.
 *
 * @param qtdSeminovo - Quantidade de saídas seminovos
 * @param qtdNovo     - Quantidade de saídas novos
 * @returns Percentual de 0 a 100, ou 0 se total for zero
 */
export function calcularPercentualSeminovos(
  qtdSeminovo: number,
  qtdNovo: number,
): number {
  const total = qtdSeminovo + qtdNovo;
  if (total === 0) return 0;
  return (qtdSeminovo / total) * 100;
}
