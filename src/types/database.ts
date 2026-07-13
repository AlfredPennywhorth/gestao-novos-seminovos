// ============================================================
// Enums
// ============================================================

export enum UserRole {
  ADMIN = 'ADMIN',
  OPERADOR = 'OPERADOR',
  VISUALIZADOR = 'VISUALIZADOR',
}

export enum TipoSaida {
  NOVO = 'NOVO',
  SEMINOVO = 'SEMINOVO',
}

export enum OrigemSaida {
  MANUAL = 'MANUAL',
  IMPORTACAO = 'IMPORTACAO',
}

export enum StatusLote {
  PENDENTE = 'PENDENTE',
  PROCESSANDO = 'PROCESSANDO',
  CONCLUIDO = 'CONCLUIDO',
  ERRO = 'ERRO',
  DESFEITO = 'DESFEITO',
}

// ============================================================
// Table types (full rows returned by Supabase)
// ============================================================

export interface Profile {
  id: string;
  nome: string;
  email: string;
  role: UserRole;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Almoxarifado {
  id: string;
  nome: string;
  codigo: string | null;
  descricao: string | null;
  aceita_novos: boolean;
  aceita_seminovos: boolean;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Setor {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Item {
  id: string;
  codigo: string | null;
  nome: string;
  descricao: string | null;
  unidade: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ItemSetor {
  id: string;
  item_id: string;
  setor_id: string;
  ativo: boolean;
  created_at: string;
}

export interface CustoMensalItem {
  id: string;
  competencia: string;
  item_id: string | null;
  almoxarifado_id: string | null;
  valor_medio_novo: number;
  valor_medio_seminovo: number;
  observacao: string | null;
  ativo: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SaidaItem {
  id: string;
  competencia: string;
  periodo_texto: string | null;
  almoxarifado_id: string | null;
  setor_id: string;
  item_id: string;
  tipo: TipoSaida;
  quantidade: number;
  observacao: string | null;
  origem: OrigemSaida;
  lote_importacao_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface LoteImportacao {
  id: string;
  nome_arquivo: string;
  almoxarifado_id: string;
  data_importacao: string;
  usuario_id: string;
  total_linhas_lidas: number;
  total_registros_novo: number;
  total_registros_seminovo: number;
  total_qtd_novo: number;
  total_qtd_seminovo: number;
  setores_criados: number;
  itens_criados: number;
  status: StatusLote;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Auditoria {
  id: string;
  usuario_id: string;
  acao: string;
  tabela_afetada: string;
  registro_id: string | null;
  dados_anteriores: Record<string, unknown> | null;
  dados_novos: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

// ============================================================
// Insert types (omit generated/auto fields)
// ============================================================

export type ProfileInsert = Omit<Profile, 'id' | 'created_at' | 'updated_at'>;
export type AlmoxarifadoInsert = Omit<Almoxarifado, 'id' | 'created_at' | 'updated_at'>;
export type SetorInsert = Omit<Setor, 'id' | 'created_at' | 'updated_at'>;
export type ItemInsert = Omit<Item, 'id' | 'created_at' | 'updated_at' | 'codigo'> & {
  codigo?: string | null;
};
export type ItemSetorInsert = Omit<ItemSetor, 'id' | 'created_at'>;
export type CustoMensalItemInsert = Omit<CustoMensalItem, 'id' | 'created_at' | 'updated_at'>;
export type SaidaItemInsert = Omit<SaidaItem, 'id' | 'created_at' | 'updated_at'>;
export type LoteImportacaoInsert = Omit<LoteImportacao, 'id' | 'created_at' | 'updated_at'>;
export type AuditoriaInsert = Omit<Auditoria, 'id' | 'created_at'>;

// ============================================================
// Update types (all insert fields are optional)
// ============================================================

export type ProfileUpdate = Partial<ProfileInsert>;
export type AlmoxarifadoUpdate = Partial<AlmoxarifadoInsert>;
export type SetorUpdate = Partial<SetorInsert>;
export type ItemUpdate = Partial<ItemInsert>;
export type ItemSetorUpdate = Partial<ItemSetorInsert>;
export type CustoMensalItemUpdate = Partial<CustoMensalItemInsert>;
export type SaidaItemUpdate = Partial<SaidaItemInsert>;
export type LoteImportacaoUpdate = Partial<LoteImportacaoInsert>;
export type AuditoriaUpdate = Partial<AuditoriaInsert>;

// Compatibility aliases for alternative naming formats
export type InsertProfile = ProfileInsert;
export type InsertAlmoxarifado = AlmoxarifadoInsert;
export type InsertSetor = SetorInsert;
export type InsertItem = ItemInsert;
export type InsertItemSetor = ItemSetorInsert;
export type InsertCustoMensalItem = CustoMensalItemInsert;
export type InsertSaidaItem = SaidaItemInsert;
export type InsertLoteImportacao = LoteImportacaoInsert;
export type InsertAuditoria = AuditoriaInsert;

export type UpdateProfile = ProfileUpdate;
export type UpdateAlmoxarifado = AlmoxarifadoUpdate;
export type UpdateSetor = SetorUpdate;
export type UpdateItem = ItemUpdate;
export type UpdateItemSetor = ItemSetorUpdate;
export type UpdateCustoMensalItem = CustoMensalItemUpdate;
export type UpdateSaidaItem = SaidaItemUpdate;
export type UpdateLoteImportacao = LoteImportacaoUpdate;
export type UpdateAuditoria = AuditoriaUpdate;

// ============================================================
// Joined / enriched types (common query shapes)
// ============================================================

export interface SaidaItemComRelacoes extends SaidaItem {
  almoxarifado?: Pick<Almoxarifado, 'id' | 'nome' | 'codigo'>;
  setor?: Pick<Setor, 'id' | 'nome'>;
  item?: Pick<Item, 'id' | 'nome' | 'unidade'>;
}

export interface CustoMensalItemComRelacoes extends CustoMensalItem {
  item?: Pick<Item, 'id' | 'nome' | 'unidade'>;
  almoxarifado?: Pick<Almoxarifado, 'id' | 'nome' | 'codigo'>;
}
