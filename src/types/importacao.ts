// ============================================================
// Tipos para o fluxo de importação Excel
// ============================================================

/**
 * Representa uma linha da planilha tblSeminovos conforme lida do Excel.
 * Os campos refletem os cabeçalhos originais da planilha.
 */
export interface LinhaExcel {
  /** Número da linha na planilha (1-indexado, excluindo cabeçalho) */
  numeroLinha: number;

  /** Coluna PERÍODO — pode vir como serial Excel (número) ou string (ex: "jun/2026", "06/2026") */
  periodo: string | number;

  /** Coluna SETOR — nome do setor */
  setor: string;

  /** Coluna ITEM — nome do item */
  item: string;

  /** Coluna NOVOS — quantidade de itens novos saídos */
  novos: number;

  /** Coluna SEMINOVOS — quantidade de itens seminovos saídos */
  seminovos: number;

  /** Coluna Mês-Ano — string auxiliar como "jun/2026" ou similar */
  mesAno: string | null;
}

/**
 * Inconsistência encontrada durante a validação do arquivo Excel.
 */
export interface InconsistenciaImportacao {
  numeroLinha: number;
  campo: string;
  valor: string | number | null;
  motivo: string;
}

/**
 * Resumo/preview gerado antes de confirmar a importação.
 */
export interface PreviewImportacao {
  /** Total de linhas lidas da planilha (excluindo cabeçalho) */
  totalLinhasLidas: number;

  /** Total de registros válidos com tipo NOVO */
  totalRegistrosNovo: number;

  /** Total de registros válidos com tipo SEMINOVO */
  totalRegistrosSeminovo: number;

  /** Soma das quantidades de itens novos */
  totalQtdNovo: number;

  /** Soma das quantidades de itens seminovos */
  totalQtdSeminovo: number;

  /** Nomes de setores que serão criados (não existem ainda no banco) */
  setoresNovos: string[];

  /** Nomes de itens que serão criados (não existem ainda no banco) */
  itensNovos: string[];

  /** Lista de inconsistências/erros encontrados (linhas inválidas) */
  inconsistencias: InconsistenciaImportacao[];

  /** Estimativa de economia (em R$) baseada nos valores padrão */
  economiaEstimada: number;

  /** Competências únicas detectadas (ex: ["2026-06-01", "2026-07-01"]) */
  competenciasDetectadas: string[];

  /** Linhas válidas prontas para importação */
  linhasValidas: LinhaExcel[];
}

/**
 * Configuração selecionada pelo usuário antes de iniciar a importação.
 */
export interface ConfigImportacao {
  /** ID do almoxarifado de destino selecionado pelo usuário */
  almoxarifadoId: string;

  /** Nome do arquivo Excel selecionado */
  nomeArquivo: string;

  /** Conteúdo binário do arquivo (ArrayBuffer para leitura com SheetJS) */
  arquivo: ArrayBuffer | null;
}

/**
 * Estado completo do fluxo de importação.
 */
export interface EstadoImportacao {
  etapa: 'selecao' | 'preview' | 'confirmacao' | 'processando' | 'concluido' | 'erro';
  config: ConfigImportacao | null;
  preview: PreviewImportacao | null;
  loteImportacaoId: string | null;
  erroMensagem: string | null;
}

/**
 * Resultado do processamento de uma linha após inserção no banco.
 */
export interface ResultadoLinhaProcessada {
  numeroLinha: number;
  sucesso: boolean;
  erro: string | null;
  saidaItemId: string | null;
}

/**
 * Resultado final do processo de importação.
 */
export interface ResultadoImportacao {
  loteImportacaoId: string;
  totalProcessadas: number;
  totalSucesso: number;
  totalErros: number;
  detalhes: ResultadoLinhaProcessada[];
}
