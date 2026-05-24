import { useEffect, useRef, useState } from 'react';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { callAgent, type AgentMessage, type PendingAction } from '../../lib/agent';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';

const SUGESTOES_RAPIDAS = [
  'Fiz 3 ligações agora',
  'Contrato fechado de Vieira Barbosa, Funil de Vendas, 10800 TCV à vista',
  'Como tá meu mês?',
];

function uid() { return Math.random().toString(36).slice(2, 10); }

export default function AgentePanel() {
  const { state, dispatch } = useAppContext();
  const { session } = useAuth();
  const userName = (session?.user?.user_metadata?.full_name as string) || session?.user?.email?.split('@')[0] || 'você';

  const [messages, setMessages] = useState<AgentMessage[]>([
    {
      id: uid(), role: 'assistant', createdAt: Date.now(),
      content: `Olá, ${userName}. Sou o agente da plataforma. Me fala o que aconteceu hoje — ligações, reuniões, contratos fechados — que eu registro pra você. Pode falar por texto ou clicar no microfone.`,
    },
  ]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const speech = useSpeechRecognition('pt-BR');

  // Auto-scroll ao final
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  // Quando termina de gravar voz, joga no draft
  useEffect(() => {
    if (speech.state === 'idle' && speech.transcript) {
      setDraft(prev => (prev ? prev + ' ' : '') + speech.transcript);
      speech.reset();
    }
  }, [speech]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setError(null);
    const userMsg: AgentMessage = { id: uid(), role: 'user', content: text, createdAt: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setDraft('');
    setSending(true);

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const resp = await callAgent({ message: text, history });
      const reply: AgentMessage = {
        id: uid(), role: 'assistant', content: resp.reply, createdAt: Date.now(),
        pendingAction: resp.pendingAction,
      };
      setMessages(prev => [...prev, reply]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido';
      setError(msg);
      setMessages(prev => [...prev, {
        id: uid(), role: 'assistant', createdAt: Date.now(),
        content: `Tive um problema ao falar com o servidor: ${msg}. Tenta de novo em alguns segundos.`,
      }]);
    } finally {
      setSending(false);
    }
  };

  const confirmAction = async (msgId: string, action: PendingAction, ok: boolean) => {
    // remove pendingAction da mensagem (resolve UI)
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, pendingAction: undefined } : m));
    if (!ok) {
      setMessages(prev => [...prev, {
        id: uid(), role: 'assistant', createdAt: Date.now(),
        content: 'Tudo bem, cancelei. Me fala como ajusto e a gente tenta de novo.',
      }]);
      return;
    }
    // Executa ação local — Fase 1: só registrar_contrato
    if (action.kind === 'registrar_contrato') {
      const ok = await executarRegistrarContrato(action.args);
      setMessages(prev => [...prev, {
        id: uid(), role: 'assistant', createdAt: Date.now(),
        content: ok
          ? `Pronto. Contrato registrado em ${state.meses[action.args.mes - 1]?.mes ?? 'mês'}. Você já vê no Plano Anual.`
          : 'Não consegui salvar — me avisa pra eu verificar.',
      }]);
    }
  };

  const executarRegistrarContrato = async (args: PendingAction extends { kind: 'registrar_contrato'; args: infer A } ? A : never) => {
    try {
      const idx = Math.max(0, Math.min(11, args.mes - 1));
      dispatch({
        type: 'ADD_CONTRATO',
        idx,
        pid: args.produto_code,
        contrato: {
          valor: args.valor,
          tipo: args.tipo,
          meses: args.tipo === 'mrr' ? (args.meses ?? 6) : null,
          comboItens: null,
          cliente: args.cliente,
          formaPagamento: args.formaPagamento,
          parcelas: args.parcelas,
        },
      });
      return true;
    } catch {
      return false;
    }
  };

  const micOn = speech.state === 'listening';
  const micUnsupported = speech.state === 'unsupported';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 48px)', maxWidth: 820, margin: '0 auto', padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 12,
          background: 'var(--silver-grad)', color: '#0a0a0c',
          display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 16,
        }}>★</div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--txt-0)', letterSpacing: -0.2 }}>
            Agente
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--txt-2)' }}>
            Pergunte, lance dados, peça orientações — em texto ou por voz
          </div>
        </div>
      </div>

      {/* Lista de mensagens */}
      <div
        ref={listRef}
        style={{
          flex: 1, overflowY: 'auto', padding: '8px 4px',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}
      >
        {messages.map(m => (
          <MessageBubble key={m.id} msg={m} onConfirm={confirmAction} />
        ))}
        {sending && (
          <div style={{ alignSelf: 'flex-start', color: 'var(--txt-3)', fontSize: 12 }}>
            <em>pensando…</em>
          </div>
        )}
      </div>

      {/* Sugestões rápidas (só aparece se ainda não trocou muita msg) */}
      {messages.length <= 2 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '10px 0' }}>
          {SUGESTOES_RAPIDAS.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setDraft(s)}
              style={{
                padding: '6px 10px', background: 'var(--bg-2)',
                border: '1px solid var(--border)', borderRadius: 999,
                fontSize: 11.5, color: 'var(--txt-2)', cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >{s}</button>
          ))}
        </div>
      )}

      {/* Erro */}
      {error && (
        <div style={{ fontSize: 11.5, color: '#f87171', marginBottom: 8 }}>⚠ {error}</div>
      )}

      {/* Composer */}
      <div style={{
        display: 'flex', gap: 8, alignItems: 'center',
        padding: 12, background: 'var(--bg-2)',
        border: '1px solid var(--border)', borderRadius: 14,
      }}>
        <button
          type="button"
          onClick={() => micOn ? speech.stop() : speech.start()}
          disabled={micUnsupported || sending}
          title={micUnsupported ? 'Voz não suportada neste navegador' : (micOn ? 'Parar gravação' : 'Falar')}
          style={{
            width: 38, height: 38, borderRadius: 10,
            border: '1px solid var(--border)',
            background: micOn ? '#ef4444' : 'var(--bg-1)',
            color: micOn ? '#fff' : 'var(--txt-1)',
            cursor: micUnsupported ? 'not-allowed' : 'pointer',
            opacity: micUnsupported ? 0.4 : 1,
            display: 'grid', placeItems: 'center',
            fontSize: 16, transition: 'all .12s',
          }}
        >
          {micOn ? '■' : '🎤'}
        </button>
        <input
          type="text"
          value={draft + (micOn && speech.interim ? ' ' + speech.interim : '')}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={micOn ? 'Ouvindo… fala aí' : 'Conta o que aconteceu, ou pergunta…'}
          disabled={sending}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--txt-0)', fontSize: 14, fontFamily: 'inherit',
          }}
        />
        <button
          type="button"
          onClick={send}
          disabled={!draft.trim() || sending}
          style={{
            padding: '8px 14px', borderRadius: 10,
            border: '1px solid var(--border)',
            background: draft.trim() ? 'var(--silver-grad)' : 'var(--bg-1)',
            color: draft.trim() ? '#0a0a0c' : 'var(--txt-3)',
            fontWeight: 700, fontSize: 12.5,
            cursor: draft.trim() ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit', transition: 'all .12s',
          }}
        >Enviar</button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- */

interface BubbleProps {
  msg: AgentMessage;
  onConfirm: (msgId: string, action: PendingAction, ok: boolean) => void;
}

function MessageBubble({ msg, onConfirm }: BubbleProps) {
  const isUser = msg.role === 'user';
  return (
    <div style={{
      alignSelf: isUser ? 'flex-end' : 'flex-start',
      maxWidth: '78%',
    }}>
      <div style={{
        padding: '10px 14px', borderRadius: 14,
        background: isUser ? 'var(--silver-grad)' : 'var(--bg-2)',
        color: isUser ? '#0a0a0c' : 'var(--txt-0)',
        fontSize: 13.5, lineHeight: 1.5,
        border: isUser ? 'none' : '1px solid var(--border)',
      }}>
        {msg.content}
      </div>
      {msg.pendingAction && (
        <ConfirmCard action={msg.pendingAction} onChoose={(ok) => onConfirm(msg.id, msg.pendingAction!, ok)} />
      )}
    </div>
  );
}

function ConfirmCard({ action, onChoose }: { action: PendingAction; onChoose: (ok: boolean) => void }) {
  const a = action.args;
  const fpLabel = { cartao: 'Cartão', avista: 'À vista', mensalidade: 'Mensalidade', parcelado: 'Parcelado' }[a.formaPagamento];
  return (
    <div style={{
      marginTop: 8, padding: 14, borderRadius: 12,
      background: 'var(--bg-1)', border: '1px solid var(--border)',
    }}>
      <div style={{ fontSize: 11.5, color: 'var(--txt-2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.3, fontWeight: 600 }}>
        Confirma este registro?
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', fontSize: 12.5, color: 'var(--txt-1)' }}>
        <span style={{ color: 'var(--txt-3)' }}>Cliente</span><span>{a.cliente}</span>
        <span style={{ color: 'var(--txt-3)' }}>Produto</span><span>{a.produto_nome}</span>
        <span style={{ color: 'var(--txt-3)' }}>Valor</span><span>R$ {a.valor.toLocaleString('pt-BR')} ({a.tipo.toUpperCase()})</span>
        <span style={{ color: 'var(--txt-3)' }}>Pagamento</span><span>{fpLabel}{a.parcelas ? ` em ${a.parcelas}x` : ''}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button
          type="button" onClick={() => onChoose(false)}
          style={{
            flex: 1, padding: '8px 12px', borderRadius: 8,
            border: '1px solid var(--border)', background: 'var(--bg-2)',
            color: 'var(--txt-1)', cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 12.5, fontWeight: 600,
          }}
        >Cancelar</button>
        <button
          type="button" onClick={() => onChoose(true)}
          style={{
            flex: 1, padding: '8px 12px', borderRadius: 8,
            border: 'none', background: 'var(--silver-grad)',
            color: '#0a0a0c', cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 12.5, fontWeight: 700,
          }}
        >Confirmar</button>
      </div>
    </div>
  );
}
