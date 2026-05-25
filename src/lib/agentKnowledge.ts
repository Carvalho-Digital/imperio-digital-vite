import { supabase } from './supabase';
import type { KnowledgeEntry, KnowledgeCategory } from '../types';

interface DbRow {
  id: string; workspace_id: string; title: string; content: string;
  category: KnowledgeCategory; is_active: boolean; sort_order: number;
  updated_at: string;
}

function fromDb(r: DbRow): KnowledgeEntry {
  return {
    id: r.id, workspaceId: r.workspace_id,
    title: r.title, content: r.content,
    category: r.category, isActive: r.is_active, sortOrder: r.sort_order,
    updatedAt: r.updated_at,
  };
}

export async function listKnowledge(workspaceId: string): Promise<KnowledgeEntry[]> {
  const { data, error } = await supabase
    .from('agent_knowledge')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('sort_order', { ascending: true })
    .order('updated_at', { ascending: false });
  if (error) throw new Error(`listKnowledge: ${error.message}`);
  return (data ?? []).map(r => fromDb(r as DbRow));
}

export async function createKnowledge(workspaceId: string, payload: {
  title: string; content: string; category: KnowledgeCategory; isActive?: boolean;
}): Promise<KnowledgeEntry> {
  const { data, error } = await supabase
    .from('agent_knowledge')
    .insert({
      workspace_id: workspaceId,
      title: payload.title, content: payload.content,
      category: payload.category, is_active: payload.isActive ?? true,
    })
    .select()
    .single();
  if (error) throw new Error(`createKnowledge: ${error.message}`);
  return fromDb(data as DbRow);
}

export async function updateKnowledge(id: string, payload: Partial<{
  title: string; content: string; category: KnowledgeCategory; isActive: boolean; sortOrder: number;
}>): Promise<void> {
  const update: Record<string, unknown> = {};
  if (payload.title !== undefined)    update.title = payload.title;
  if (payload.content !== undefined)  update.content = payload.content;
  if (payload.category !== undefined) update.category = payload.category;
  if (payload.isActive !== undefined) update.is_active = payload.isActive;
  if (payload.sortOrder !== undefined) update.sort_order = payload.sortOrder;
  const { error } = await supabase.from('agent_knowledge').update(update).eq('id', id);
  if (error) throw new Error(`updateKnowledge: ${error.message}`);
}

export async function deleteKnowledge(id: string): Promise<void> {
  const { error } = await supabase.from('agent_knowledge').delete().eq('id', id);
  if (error) throw new Error(`deleteKnowledge: ${error.message}`);
}

/* Constrói o bloco de texto que vai pro system prompt do agente.
   Filtra só entries ativas. Limita tamanho total pra evitar gasto absurdo de tokens. */
const MAX_CHARS = 20_000; // ~5k tokens — barato e suficiente pra MVP

export function buildKnowledgeContext(entries: KnowledgeEntry[]): string {
  const ativas = entries.filter(e => e.isActive);
  if (ativas.length === 0) return '';
  const blocos: string[] = [];
  let totalChars = 0;
  for (const e of ativas) {
    const bloco = `### [${e.category}] ${e.title}\n${e.content.trim()}`;
    if (totalChars + bloco.length > MAX_CHARS) {
      blocos.push(`\n(... ${ativas.length - blocos.length} entrada(s) extra(s) omitida(s) por limite de tamanho. Reduza ou desative algumas.)`);
      break;
    }
    blocos.push(bloco);
    totalChars += bloco.length;
  }
  return blocos.join('\n\n');
}

export function totalKnowledgeChars(entries: KnowledgeEntry[]): number {
  return entries.filter(e => e.isActive).reduce((acc, e) => acc + e.title.length + e.content.length, 0);
}

export const KNOWLEDGE_MAX_CHARS = MAX_CHARS;
