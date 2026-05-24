import { supabase } from './supabase';

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
