import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useAgenteChat } from '../hooks/useAgenteChat';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import AgenteLogo from './AgenteLogo';
import type { AgentMessage, PendingAction } from '../lib/agent';

export default function AgenteFab() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Botão flutuante */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Falar com o Agente"
        aria-label="Abrir agente"
        style={{
          position: 'fixed', bottom: 22, right: 22,
          width: 54, height: 54, borderRadius: '50%',
          background: 'var(--silver-grad)', color: '#0a0a0c',
          border: 'none', cursor: 'pointer',
          fontFamily: 'inherit',
          display: open ? 'none' : 'grid', placeItems: 'center',
          boxShadow: '0 8px 28px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.06)',
          zIndex: 95, transition: 'transform .15s ease',
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.06)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
      >
        <AgenteLogo size={26} color="#0a0a0c" />
      </button>

      {open && <AgenteDrawer onClose={() => setOpen(false)} />}
    </>
  );
}

/* ────────────────────────────────────────────────────────────────── */

function AgenteDrawer({ onClose }: { onClose: () => void }) {
  const { messages, sending, error, send, confirmAction } = useAgenteChat({
    welcomeText: 'Oi. Me fala o que aconteceu hoje — ligações, reuniões, contratos — que eu registro.',
  });
  const speech = useSpeechRecognition('pt-BR');
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  useEffect(() => {
    if (speech.state === 'idle' && speech.transcript) {
      setDraft(prev => (prev ? prev + ' ' : '') + speech.transcript);
      speech.reset();
    }
  }, [speech]);

  const handleSend = () => {
    if (!draft.trim() || sending) return;
    send(draft);
    setDraft('');
  };

  const micOn = speech.state === 'listening';
  const micUnsupported = speech.state === 'unsupported';

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
          zIndex: 96, backdropFilter: 'blur(2px)',
        }}
      />

      {/* Drawer */}
      <aside
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 'min(420px, 100vw)', zIndex: 97,
          background: 'var(--bg-0)', borderLeft: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
          boxShadow: '-12px 0 40px rgba(0,0,0,.4)',
          animation: 'slideInRight .22s ease-out',
        }}
      >
        <style>{`@keyframes slideInRight { from { transform: translateX(20px); opacity: 0 } to { transform: none; opacity: 1 } }`}</style>

        {/* Header */}
        <header style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '14px 16px', borderBottom: '1px solid var(--border)',
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: 'var(--silver-grad)', color: '#0a0a0c',
            display: 'grid', placeItems: 'center',
          }}>
            <AgenteLogo size={18} color="#0a0a0c" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--txt-0)', lineHeight: 1.2 }}>Agente</div>
            <div style={{ fontSize: 10.5, color: 'var(--txt-3)' }}>Texto ou voz</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            style={{
              width: 30, height: 30, borderRadius: 8,
              background: 'var(--bg-2)', color: 'var(--txt-1)',
              border: '1px solid var(--border)', cursor: 'pointer',
              fontSize: 16, fontFamily: 'inherit',
              display: 'grid', placeItems: 'center',
            }}
          >×</button>
        </header>

        {/* Mensagens */}
        <div ref={listRef} style={{
          flex: 1, overflowY: 'auto', padding: 12,
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          {messages.map(m => <BubbleMini key={m.id} msg={m} onConfirm={confirmAction} />)}
          {sending && (
            <div style={{ alignSelf: 'flex-start', color: 'var(--txt-3)', fontSize: 11.5, padding: '4px 8px' }}>
              <em>pensando…</em>
            </div>
          )}
        </div>

        {/* Erro */}
        {error && (
          <div style={{ fontSize: 11, color: '#f87171', padding: '6px 12px' }}>⚠ {error}</div>
        )}

        {/* Composer */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: 10, margin: 10,
          background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12,
        }}>
          <button
            type="button"
            onClick={() => micOn ? speech.stop() : speech.start()}
            disabled={micUnsupported || sending}
            title={micUnsupported ? 'Voz não suportada' : (micOn ? 'Parar' : 'Falar')}
            style={{
              width: 34, height: 34, borderRadius: 9,
              border: '1px solid var(--border)',
              background: micOn ? '#ef4444' : 'var(--bg-1)',
              color: micOn ? '#fff' : 'var(--txt-1)',
              cursor: micUnsupported ? 'not-allowed' : 'pointer',
              opacity: micUnsupported ? 0.4 : 1, fontSize: 14,
              display: 'grid', placeItems: 'center', fontFamily: 'inherit',
            }}
          >{micOn ? '■' : '🎤'}</button>
          <input
            type="text"
            value={draft + (micOn && speech.interim ? ' ' + speech.interim : '')}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={micOn ? 'Ouvindo…' : 'Pergunta ou conta…'}
            disabled={sending}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--txt-0)', fontSize: 13, fontFamily: 'inherit',
            }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!draft.trim() || sending}
            style={{
              padding: '7px 12px', borderRadius: 9, border: 'none',
              background: draft.trim() ? 'var(--silver-grad)' : 'var(--bg-1)',
              color: draft.trim() ? '#0a0a0c' : 'var(--txt-3)',
              fontWeight: 700, fontSize: 11.5,
              cursor: draft.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
            }}
          >→</button>
        </div>
      </aside>
    </>
  );
}

function BubbleMini({ msg, onConfirm }: { msg: AgentMessage; onConfirm: (msgId: string, a: PendingAction, ok: boolean) => void }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{ alignSelf: isUser ? 'flex-end' : 'flex-start', maxWidth: '92%' }}>
      <div style={{
        padding: '8px 11px', borderRadius: 11,
        background: isUser ? 'var(--silver-grad)' : 'var(--bg-2)',
        color: isUser ? '#0a0a0c' : 'var(--txt-0)',
        fontSize: 12.5, lineHeight: 1.5,
        border: isUser ? 'none' : '1px solid var(--border)',
      }}>
        {isUser ? (
          <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
        ) : (
          <div className="md-body-mini">
            <style>{`
              .md-body-mini > *:first-child { margin-top: 0 }
              .md-body-mini > *:last-child { margin-bottom: 0 }
              .md-body-mini p { margin: 0 0 6px 0 }
              .md-body-mini strong { color: var(--txt-0); font-weight: 700 }
              .md-body-mini em { color: var(--txt-2) }
              .md-body-mini ul, .md-body-mini ol { margin: 4px 0 6px 0; padding-left: 16px }
              .md-body-mini li { margin: 2px 0 }
              .md-body-mini code { background: rgba(255,255,255,.07); padding: 1px 4px; border-radius: 3px; font-size: 11.5px }
            `}</style>
            <ReactMarkdown>{msg.content}</ReactMarkdown>
          </div>
        )}
      </div>
      {msg.pendingAction && (
        <ConfirmCardMini action={msg.pendingAction} onChoose={(ok) => onConfirm(msg.id, msg.pendingAction!, ok)} />
      )}
    </div>
  );
}

function ConfirmCardMini({ action, onChoose }: { action: PendingAction; onChoose: (ok: boolean) => void }) {
  return (
    <div style={{
      marginTop: 6, padding: 10, borderRadius: 10,
      background: 'var(--bg-1)', border: '1px solid var(--border)',
    }}>
      <div style={{ fontSize: 10, color: 'var(--txt-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 700 }}>
        Confirma?
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--txt-1)', lineHeight: 1.45 }}>
        {action.kind === 'registrar_contrato' ? (
          <>
            <strong style={{ color: 'var(--txt-0)' }}>{action.args.cliente}</strong> · {action.args.produto_nome}<br />
            R$ {action.args.valor.toLocaleString('pt-BR')} ({action.args.tipo.toUpperCase()}) · {({ cartao: 'Cartão', avista: 'À vista', mensalidade: 'Mensalidade', parcelado: 'Parcelado' })[action.args.formaPagamento]}{action.args.parcelas ? ` ${action.args.parcelas}x` : ''}
          </>
        ) : (
          <>
            <strong style={{ color: 'var(--txt-0)' }}>Lançamento {action.args.data}</strong><br />
            {[
              action.args.ligacoes != null ? `${action.args.ligacoes} ligações` : null,
              action.args.reunioes_agendadas != null ? `${action.args.reunioes_agendadas} reun. agend.` : null,
              action.args.reunioes_realizadas != null ? `${action.args.reunioes_realizadas} reun. real.` : null,
              action.args.propostas != null ? `${action.args.propostas} propostas` : null,
            ].filter(Boolean).join(' · ')}
          </>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button type="button" onClick={() => onChoose(false)} style={{
          flex: 1, padding: '6px 10px', borderRadius: 7,
          border: '1px solid var(--border)', background: 'var(--bg-2)',
          color: 'var(--txt-1)', cursor: 'pointer', fontFamily: 'inherit',
          fontSize: 11, fontWeight: 600,
        }}>Não</button>
        <button type="button" onClick={() => onChoose(true)} style={{
          flex: 1, padding: '6px 10px', borderRadius: 7, border: 'none',
          background: 'var(--silver-grad)', color: '#0a0a0c', cursor: 'pointer',
          fontFamily: 'inherit', fontSize: 11, fontWeight: 700,
        }}>Sim</button>
      </div>
    </div>
  );
}
