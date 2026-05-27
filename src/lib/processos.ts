import { supabase } from './supabase';
import type { Processo, ProcessoStatus, ProcessoSecao } from '../types';

interface DbRow {
  id: string;
  workspace_id: string;
  titulo: string;
  descricao: string | null;
  status: ProcessoStatus;
  pdf_path: string | null;
  pdf_link: string | null;
  estrutura: ProcessoSecao[] | null;
  ordem: number;
  created_at: string;
  updated_at: string;
}

function fromDb(r: DbRow): Processo {
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    titulo: r.titulo,
    descricao: r.descricao,
    status: r.status,
    pdfPath: r.pdf_path,
    pdfLink: r.pdf_link,
    estrutura: Array.isArray(r.estrutura) ? r.estrutura : [],
    ordem: r.ordem ?? 0,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listProcessos(workspaceId: string): Promise<Processo[]> {
  const { data, error } = await supabase
    .from('processos')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('ordem', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw new Error(`listProcessos: ${error.message}`);
  return (data ?? []).map(r => fromDb(r as DbRow));
}

export async function createProcesso(workspaceId: string, payload: {
  titulo: string;
  descricao?: string | null;
  status?: ProcessoStatus;
  ordem?: number;
}): Promise<Processo> {
  const { data, error } = await supabase
    .from('processos')
    .insert({
      workspace_id: workspaceId,
      titulo: payload.titulo,
      descricao: payload.descricao ?? null,
      status: payload.status ?? 'rascunho',
      ordem: payload.ordem ?? 0,
      estrutura: [],
    })
    .select()
    .single();
  if (error) throw new Error(`createProcesso: ${error.message}`);
  return fromDb(data as DbRow);
}

export async function updateProcesso(id: string, payload: Partial<{
  titulo: string;
  descricao: string | null;
  status: ProcessoStatus;
  pdfPath: string | null;
  pdfLink: string | null;
  estrutura: ProcessoSecao[];
  ordem: number;
}>): Promise<void> {
  const update: Record<string, unknown> = {};
  if (payload.titulo    !== undefined) update.titulo    = payload.titulo;
  if (payload.descricao !== undefined) update.descricao = payload.descricao;
  if (payload.status    !== undefined) update.status    = payload.status;
  if (payload.pdfPath   !== undefined) update.pdf_path  = payload.pdfPath;
  if (payload.pdfLink   !== undefined) update.pdf_link  = payload.pdfLink;
  if (payload.estrutura !== undefined) update.estrutura = payload.estrutura;
  if (payload.ordem     !== undefined) update.ordem     = payload.ordem;
  const { error } = await supabase.from('processos').update(update).eq('id', id);
  if (error) throw new Error(`updateProcesso: ${error.message}`);
}

export async function deleteProcesso(id: string): Promise<void> {
  const { error } = await supabase.from('processos').delete().eq('id', id);
  if (error) throw new Error(`deleteProcesso: ${error.message}`);
}

/* ── Upload de PDF no bucket 'processos' ─────────────────────────────
   Convenção de path: <workspaceId>/<processoId>/<filename>.pdf
   Retorna o path salvo (sem URL — gere signed URL na hora de exibir).
*/
export async function uploadProcessoPdf(
  workspaceId: string,
  processoId: string,
  file: File,
): Promise<string> {
  const safeName = file.name.replace(/[^\w.\-]+/g, '_');
  const path = `${workspaceId}/${processoId}/${Date.now()}_${safeName}`;
  const { error } = await supabase.storage
    .from('processos')
    .upload(path, file, { upsert: true, contentType: file.type || 'application/pdf' });
  if (error) throw new Error(`uploadProcessoPdf: ${error.message}`);
  return path;
}

export async function getProcessoPdfSignedUrl(path: string, expiresInSec = 60 * 30): Promise<string> {
  const { data, error } = await supabase.storage
    .from('processos')
    .createSignedUrl(path, expiresInSec);
  if (error) throw new Error(`getProcessoPdfSignedUrl: ${error.message}`);
  return data.signedUrl;
}

export async function deleteProcessoPdf(path: string): Promise<void> {
  const { error } = await supabase.storage.from('processos').remove([path]);
  if (error) throw new Error(`deleteProcessoPdf: ${error.message}`);
}
