import type { Setor, InsertSetor, UpdateSetor } from '@/types/database'
import { supabase } from '@/services/supabase'

const SETOR_MISTO_LEGADO = 'BEBE - CAMA E BANHO - CHINELOS'

const SETORES_CANONICOS: Record<string, string> = {
  'FEMININO INFANTIL': 'INFANTIL FEMININO',
  'MASCULINO INFANTIL': 'INFANTIL MASCULINO',
  [SETOR_MISTO_LEGADO]: 'OUTROS',
}

function chaveSetor(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

export function setorExigeReclassificacao(nome: string): boolean {
  return chaveSetor(nome) === SETOR_MISTO_LEGADO
}

export function normalizarNomeSetor(nome: string): string {
  const nomeNormalizado = nome.replace(/\s+/g, ' ').trim().toUpperCase()
  return SETORES_CANONICOS[chaveSetor(nomeNormalizado)] ?? nomeNormalizado
}

// ─────────────────────────────────────────────
// listSetores
// ─────────────────────────────────────────────
export async function listSetores(apenasAtivos = false): Promise<Setor[]> {
  let query = supabase.from('setores').select('*').order('nome', { ascending: true })

  if (apenasAtivos) {
    query = query.eq('ativo', true)
  }

  const { data, error } = await query

  if (error) {
    console.error('[setores] Erro ao listar:', error.message)
    return []
  }

  return (data ?? []) as Setor[]
}

// ─────────────────────────────────────────────
// getSetor
// ─────────────────────────────────────────────
export async function getSetor(id: string): Promise<Setor | null> {
  const { data, error } = await supabase.from('setores').select('*').eq('id', id).single()

  if (error) {
    console.error('[setores] Erro ao buscar:', error.message)
    return null
  }

  return data as Setor
}

// ─────────────────────────────────────────────
// createSetor
// ─────────────────────────────────────────────
export async function createSetor(
  data: InsertSetor
): Promise<{ data: Setor | null; error: string | null }> {
  const { data: created, error } = await supabase
    .from('setores')
    .insert(data)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return { data: null, error: 'Já existe um setor com este nome.' }
    }
    return { data: null, error: 'Erro ao criar setor: ' + error.message }
  }

  return { data: created as Setor, error: null }
}

// ─────────────────────────────────────────────
// updateSetor
// ─────────────────────────────────────────────
export async function updateSetor(
  id: string,
  data: UpdateSetor
): Promise<{ data: Setor | null; error: string | null }> {
  const { data: updated, error } = await supabase
    .from('setores')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { data: null, error: 'Erro ao atualizar setor: ' + error.message }
  }

  return { data: updated as Setor, error: null }
}

// ─────────────────────────────────────────────
// toggleActive
// ─────────────────────────────────────────────
export async function toggleActive(
  id: string,
  ativo: boolean
): Promise<{ data: Setor | null; error: string | null }> {
  const { data, error } = await supabase
    .from('setores')
    .update({ ativo })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return {
      data: null,
      error: `Erro ao ${ativo ? 'ativar' : 'desativar'} setor: ` + error.message,
    }
  }

  return { data: data as Setor, error: null }
}

// ─────────────────────────────────────────────
// findOrCreate
// ─────────────────────────────────────────────
export async function findOrCreate(
  nome: string
): Promise<{ setor: Setor; criado: boolean }> {
  const nomeTrimado = normalizarNomeSetor(nome)

  // Tenta buscar pelo nome (case-insensitive)
  const { data: existente, error: erroBusca } = await supabase
    .from('setores')
    .select('*')
    .ilike('nome', nomeTrimado)
    .eq('ativo', true)
    .limit(1)
    .single()

  if (!erroBusca && existente) {
    return { setor: existente as Setor, criado: false }
  }

  // Cria novo setor
  const { data: criado, error: erroCriacao } = await supabase
    .from('setores')
    .insert({ nome: nomeTrimado, ativo: true })
    .select()
    .single()

  if (erroCriacao || !criado) {
    // Pode ter ocorrido race condition — tenta buscar novamente
    const { data: recheck } = await supabase
      .from('setores')
      .select('*')
      .ilike('nome', nomeTrimado)
      .eq('ativo', true)
      .limit(1)
      .single()

    if (recheck) {
      return { setor: recheck as Setor, criado: false }
    }

    throw new Error(`Falha ao criar setor "${nomeTrimado}": ` + (erroCriacao?.message ?? 'erro desconhecido'))
  }

  return { setor: criado as Setor, criado: true }
}
