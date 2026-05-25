import { supabase } from './supabase';
import type { FormaPagamento } from '../types';

export type AgentRole = 'user' | 'assistant' | 'tool';

export interface AgentMessage {
  id: string;
  role: AgentRole;
  content: string;
  pendingAction?: PendingAction;
  createdAt: number;
}

export type PendingAction =
  | {
      kind: 'registrar_contrato';
      args: {
        produto_code: string;
        produto_nome: string;
        valor: number;
        tipo: 'tcv' | 'mrr';
        cliente: string;
        formaPagamento: 'cartao' | 'avista' | 'mensalidade' | 'parcelado';
        parcelas: number | null;
        mes: number;
        meses?: number | null;
      };
    };

export interface AgentTurnRequest {
  message: string;
  history: { role: AgentRole; content: string }[];
}

export interface AgentTurnResponse {
  reply: string;
  pendingAction?: PendingAction;
}

export async function callAgent(req: AgentTurnRequest): Promise<AgentTurnResponse> {
  const { data, error } = await supabase.functions.invoke<AgentTurnResponse>('agent', { body: req });
  if (error) throw new Error(`agent edge function: ${error.message}`);
  if (!data) throw new Error('agent edge function: empty response');
  return data;
}

/* ============================================================
   Fase B — Auto-preenchimento da Ficha por transcrição Read AI
   ============================================================ */
export interface ExtractedFicha {
  cliente?: string | null;
  valor?: number | null;
  tipo?: 'tcv' | 'mrr' | null;
  formaPagamento?: FormaPagamento | null;
  parcelas?: number | null;
  vigenciaInicio?: string | null;
  vigenciaMeses?: number | null;
  entregaveis?: string | null;
  notasOperacional?: string | null;
  notasJuridico?: string | null;
  notasLivres?: string | null;
}

export interface ExtractFichaResponse { extracted: ExtractedFicha; }

export async function callExtractFicha(transcript: string): Promise<ExtractedFicha> {
  const { data, error } = await supabase.functions.invoke<ExtractFichaResponse>('extract-ficha', { body: { transcript } });
  if (error) throw new Error(`extract-ficha: ${error.message}`);
  if (!data) throw new Error('extract-ficha: empty response');
  return data.extracted ?? {};
}
