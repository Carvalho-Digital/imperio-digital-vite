import { useCallback, useState } from 'react';
import { callAgent, type AgentMessage, type PendingAction } from '../lib/agent';
import { useAppContext } from '../context/AppContext';

function uid() { return Math.random().toString(36).slice(2, 10); }

interface Options { welcomeText?: string; }

export function useAgenteChat(opts: Options = {}) {
  const { state, dispatch } = useAppContext();

  const [messages, setMessages] = useState<AgentMessage[]>(() =>
    opts.welcomeText
      ? [{ id: uid(), role: 'assistant', content: opts.welcomeText, createdAt: Date.now() }]
      : []
  );
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setError(null);
    const userMsg: AgentMessage = { id: uid(), role: 'user', content: trimmed, createdAt: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setSending(true);
    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const resp = await callAgent({ message: trimmed, history });
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
  }, [messages, sending]);

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
          type: 'ADD_CONTRATO',
          idx,
          pid: action.args.produto_code,
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
          content: `Pronto. Contrato registrado em ${state.meses[idx]?.mes ?? 'mês'}.`,
        }]);
      } catch {
        setMessages(prev => [...prev, {
          id: uid(), role: 'assistant', createdAt: Date.now(),
          content: 'Não consegui salvar — me avisa pra eu verificar.',
        }]);
      }
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
