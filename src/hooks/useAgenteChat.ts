import { useCallback, useEffect, useMemo, useState } from 'react';
import { callAgent, type AgentMessage, type PendingAction } from '../lib/agent';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { getContratos } from '../lib/calculations';
import { listKnowledge, buildKnowledgeContext } from '../lib/agentKnowledge';
import type { KnowledgeEntry } from '../types';

function uid() { return Math.random().toString(36).slice(2, 10); }

interface Options { welcomeText?: string; }

function buildDashboardContext(state: ReturnType<typeof useAppContext>['state'], userName: string): string {
  const now = new Date();
  const mesIdx = now.getMonth();
  const mesAtual = state.meses[mesIdx];
  if (!mesAtual) return `Vendedor logado: ${userName}\n(Sem snapshot do mes atual)`;

  // Calcula realizado do mes (soma de todos os contratos novos)
  const produtos = state.produtosState?.items ?? [];
  let realizadoTCV = 0;
  let realizadoMRR = 0;
  let totalContratos = 0;
  for (const p of produtos) {
    const cs = getContratos(mesAtual, p.id);
    for (const c of cs) {
      totalContratos++;
      if (c.tipo === 'mrr') realizadoMRR += c.valor * (c.meses ?? 6);
      else realizadoTCV += c.valor;
    }
  }
  const totalRealizado = realizadoTCV + realizadoMRR;
  const meta = mesAtual.receita ?? 0;
  const faltam = Math.max(0, meta - totalRealizado);
  const pct = meta > 0 ? Math.round((totalRealizado / meta) * 100) : 0;

  const proxMes = state.meses[mesIdx + 1];

  const produtosResumo = produtos.slice(0, 5).map(p =>
    `- ${p.icon} ${p.nome} (code=${p.id}, ticket TCV R$ ${p.ticketTCV}, ticket MRR R$ ${p.ticketMRR}/mes)`
  ).join('\n');

  return `Vendedor logado: ${userName}

Mes atual: ${mesAtual.mes} (status: ${mesAtual.status})
- Meta: R$ ${meta.toLocaleString('pt-BR')}
- Realizado: R$ ${totalRealizado.toLocaleString('pt-BR')} (${pct}%)
- Faltam: R$ ${faltam.toLocaleString('pt-BR')}
- Contratos no mes: ${totalContratos}
${proxMes ? `\nProximo mes (${proxMes.mes}): meta R$ ${(proxMes.receita ?? 0).toLocaleString('pt-BR')}` : ''}

Catalogo de produtos:
${produtosResumo}`;
}

export function useAgenteChat(opts: Options = {}) {
  const { state, dispatch, workspaceId } = useAppContext();
  const { session } = useAuth();
  const userName = (session?.user?.user_metadata?.full_name as string) || session?.user?.email?.split('@')[0] || 'Marcos';

  const [knowledge, setKnowledge] = useState<KnowledgeEntry[]>([]);
  useEffect(() => {
    if (!workspaceId) return;
    let cancel = false;
    listKnowledge(workspaceId)
      .then(entries => { if (!cancel) setKnowledge(entries); })
      .catch(() => { /* silencia falha — agente continua sem a base */ });
    return () => { cancel = true; };
  }, [workspaceId]);
  const knowledgeContext = useMemo(() => buildKnowledgeContext(knowledge), [knowledge]);

  const [messages, setMessages] = useState<AgentMessage[]>(() =>
    opts.welcomeText
      ? [{ id: uid(), role: 'assistant', content: opts.welcomeText, createdAt: Date.now() }]
      : []
  );
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dashboardContext = useMemo(
    () => buildDashboardContext(state, userName),
    [state, userName]
  );

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setError(null);
    const userMsg: AgentMessage = { id: uid(), role: 'user', content: trimmed, createdAt: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setSending(true);
    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const resp = await callAgent({ message: trimmed, history, dashboard_context: dashboardContext, knowledge_context: knowledgeContext });
      setMessages(prev => [...prev, {
        id: uid(), role: 'assistant', createdAt: Date.now(),
        content: resp.reply, pendingAction: resp.pendingAction,
      }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido';
      setError(msg);
      setMessages(prev => [...prev, {
        id: uid(), role: 'assistant', createdAt: Date.now(),
        content: `Tive um problema ao falar com o servidor: ${msg}.`,
      }]);
    } finally {
      setSending(false);
    }
  }, [messages, sending, dashboardContext, knowledgeContext]);

  const confirmAction = useCallback(async (msgId: string, action: PendingAction, ok: boolean) => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, pendingAction: undefined } : m));
    if (!ok) {
      setMessages(prev => [...prev, {
        id: uid(), role: 'assistant', createdAt: Date.now(),
        content: 'Tudo bem, cancelei. Me fala como ajusto e a gente tenta de novo.',
      }]);
      return;
    }
    if (action.kind === 'registrar_contrato') {
      try {
        const idx = Math.max(0, Math.min(11, action.args.mes - 1));
        dispatch({
          type: 'ADD_CONTRATO', idx, pid: action.args.produto_code,
          contrato: {
            valor: action.args.valor,
            tipo: action.args.tipo,
            meses: action.args.tipo === 'mrr' ? (action.args.meses ?? 6) : null,
            comboItens: null,
            cliente: action.args.cliente,
            formaPagamento: action.args.formaPagamento,
            parcelas: action.args.parcelas,
          },
        });
        setMessages(prev => [...prev, {
          id: uid(), role: 'assistant', createdAt: Date.now(),
          content: `Pronto. Contrato registrado em **${state.meses[idx]?.mes ?? 'mês'}**.`,
        }]);
      } catch {
        setMessages(prev => [...prev, {
          id: uid(), role: 'assistant', createdAt: Date.now(),
          content: 'Não consegui salvar — me avisa pra eu verificar.',
        }]);
      }
    } else if (action.kind === 'registrar_lancamento_diario') {
      // Fase 2 — sem dispatch ainda (tabela daily_entries precisa de seller_id, mapeamento pendente).
      // Por ora, só confirma simbolicamente. Próxima sessão liga ao reducer.
      const a = action.args;
      const partes: string[] = [];
      if (a.ligacoes) partes.push(`${a.ligacoes} ligações`);
      if (a.reunioes_agendadas) partes.push(`${a.reunioes_agendadas} reuniões agendadas`);
      if (a.reunioes_realizadas) partes.push(`${a.reunioes_realizadas} reuniões realizadas`);
      if (a.propostas) partes.push(`${a.propostas} propostas`);
      setMessages(prev => [...prev, {
        id: uid(), role: 'assistant', createdAt: Date.now(),
        content: `Anotei **${partes.join(' · ')}** em ${a.data}.\n\n_(Ainda estou guardando isso só na conversa — na próxima atualização vou salvar direto no Time de Vendas. Por enquanto registre manual lá pra contabilizar.)_`,
      }]);
    }
  }, [dispatch, state.meses]);

  const reset = useCallback(() => {
    setMessages(opts.welcomeText
      ? [{ id: uid(), role: 'assistant', content: opts.welcomeText, createdAt: Date.now() }]
      : []
    );
    setError(null);
  }, [opts.welcomeText]);

  return { messages, sending, error, send, confirmAction, reset, hasConversation: messages.length > 1 };
}
