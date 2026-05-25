import { useEffect, useRef, useState } from 'react';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { useAgenteChat } from '../../hooks/useAgenteChat';
import { useAuth } from '../../context/AuthContext';
import type { AgentMessage, PendingAction } from '../../lib/agent';

function greetingByHour() {
  const h = new Date().getHours();
  if (h < 12) return 'BOM DIA';
  if (h < 18) return 'BOA TARDE';
  return 'BOA NOITE';
}

const SUGESTOES = [
  'Fiz 3 ligações agora',
  'Contrato fechado: Vieira Barbosa, Funil de Vendas, 10800 TCV cartão 12x',
  'Como tá meu mês?',
];

export default function AgentePanel() {
  const { session } = useAuth();
  const firstName = (() => {
    const full = (session?.user?.user_metadata?.full_name as string) || session?.user?.email?.split('@')[0] || 'você';
    return full.split(' ')[0].replace(/^./, c => c.toUpperCase());
  })();

  const {
    messages, sending, error, send, confirmAction, reset, hasConversation,
  } = useAgenteChat({
    welcomeText: `Olá, ${firstName}. Sou o agente da plataforma. Conta o que aconteceu — eu registro pra você. Pode ser texto ou voz.`,
  });

  const speech = useSpeechRecognition('pt-BR');
  const [draft, setDraft] = useState('');
  const [chatExpanded, setChatExpanded] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const showHero = !chatExpanded && !hasConversation;

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
    if (!chatExpanded) setChatExpanded(true);
    send(draft);
    setDraft('');
  };

  const micOn = speech.state === 'listening';
  const micUnsupported = speech.state === 'unsupported';

  return (
    <div style={{
      position: 'relative', width: '100%', minHeight: 'calc(100vh - 48px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '24px 24px 32px',
      overflow: 'hidden',
    }}>
      {/* Background cosmic — gradientes radiais sutis */}
      <CosmicBg />

      {/* HERO — saudação centralizada (mostra antes de iniciar conversa) */}
      {showHero && (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 18, textAlign: 'center', position: 'relative', zIndex: 1,
          paddingBottom: 40,
        }}>
          <div style={{
            fontSize: 11, color: 'var(--txt-3)', letterSpacing: 3, fontWeight: 600,
          }}>{greetingByHour()}</div>
          <div style={{
            fontSize: 64, fontWeight: 300, color: 'var(--txt-0)',
            letterSpacing: -1.5, lineHeight: 1, fontFamily: 'var(--font-display)',
          }}>{firstName}</div>
          <button
            type="button"
            onClick={() => { setChatExpanded(true); send('Me dá um resumo rápido do meu mês'); }}
            style={{
              marginTop: 6, padding: '8px 18px',
              background: 'rgba(96,165,250,.08)',
              border: '1px solid rgba(96,165,250,.3)',
              borderRadius: 999,
              color: '#9bc7ff', fontSize: 12.5, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all .15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(96,165,250,.16)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(96,165,250,.08)')}
          >ver briefing diário</button>
        </div>
      )}

      {/* CHAT — mensagens (visíveis quando expandido) */}
      {!showHero && (
        <div style={{
          flex: 1, width: '100%', maxWidth: 760,
          overflowY: 'auto', position: 'relative', zIndex: 1,
          padding: '20px 0',
          display: 'flex', flexDirection: 'column', gap: 12,
        }} ref={listRef}>
          {messages.map(m => <Bubble key={m.id} msg={m} onConfirm={confirmAction} />)}
          {sending && (
            <div style={{ alignSelf: 'flex-start', color: 'var(--txt-3)', fontSize: 12, padding: '4px 8px' }}>
              <em>pensando…</em>
            </div>
          )}
        </div>
      )}

      {/* SUGESTÕES — só no hero */}
      {showHero && (
        <div style={{
          display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center',
          marginBottom: 14, position: 'relative', zIndex: 1, maxWidth: 760,
        }}>
          {SUGESTOES.map(s => (
            <button
              key={s} type="button" onClick={() => setDraft(s)}
              style={{
                padding: '6px 12px', background: 'rgba(255,255,255,.04)',
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
        <div style={{ fontSize: 11.5, color: '#f87171', marginBottom: 8, position: 'relative', zIndex: 1 }}>
          ⚠ {error}
        </div>
      )}

      {/* COMPOSER — centralizado, estilo Néctar */}
      <div style={{
        width: '100%', maxWidth: 760, position: 'relative', zIndex: 1,
        background: 'rgba(20,22,26,.85)', backdropFilter: 'blur(8px)',
        border: '1px solid var(--border)', borderRadius: 16,
        padding: '14px 16px',
        boxShadow: '0 8px 32px rgba(0,0,0,.4)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            type="text"
            value={draft + (micOn && speech.interim ? ' ' + speech.interim : '')}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={micOn ? 'Ouvindo…' : 'Como posso te ajudar?'}
            disabled={sending}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--txt-0)', fontSize: 15, fontFamily: 'inherit',
              padding: '6px 0',
            }}
          />
          <ToolbarButton title="Anexar (em breve)" disabled>📎</ToolbarButton>
          <ToolbarButton title="Voz de saída (em breve)" disabled>🎧</ToolbarButton>
          <ToolbarButton
            title={micUnsupported ? 'Voz não suportada' : (micOn ? 'Parar' : 'Falar')}
            onClick={() => micOn ? speech.stop() : speech.start()}
            disabled={micUnsupported || sending}
            active={micOn}
          >{micOn ? '■' : '🎤'}</ToolbarButton>
        </div>
      </div>

      {/* RETOMAR CHAT (só no hero, se tem conversa anterior) */}
      {showHero && hasConversation && (
        <button
          type="button"
          onClick={() => setChatExpanded(true)}
          style={{
            marginTop: 14, padding: '6px 12px', background: 'transparent',
            border: 'none', color: 'var(--txt-2)', fontSize: 12.5,
            cursor: 'pointer', fontFamily: 'inherit',
            position: 'relative', zIndex: 1,
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}
        >💬 retomar chat</button>
      )}

      {/* "Nova conversa" quando expandido */}
      {!showHero && (
        <button
          type="button"
          onClick={() => { reset(); setChatExpanded(false); }}
          style={{
            marginTop: 12, padding: '6px 12px', background: 'transparent',
            border: 'none', color: 'var(--txt-3)', fontSize: 11.5,
            cursor: 'pointer', fontFamily: 'inherit',
            position: 'relative', zIndex: 1,
          }}
        >⟲ nova conversa</button>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────── */

function ToolbarButton({
  children, title, onClick, disabled, active,
}: {
  children: React.ReactNode; title: string;
  onClick?: () => void; disabled?: boolean; active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        width: 34, height: 34, borderRadius: 9,
        background: active ? '#ef4444' : 'transparent',
        color: active ? '#fff' : (disabled ? 'var(--txt-3)' : 'var(--txt-1)'),
        border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 14, opacity: disabled ? 0.35 : 1, fontFamily: 'inherit',
        display: 'grid', placeItems: 'center', transition: 'all .12s',
      }}
    >{children}</button>
  );
}

function Bubble({ msg, onConfirm }: { msg: AgentMessage; onConfirm: (msgId: string, a: PendingAction, ok: boolean) => void }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{ alignSelf: isUser ? 'flex-end' : 'flex-start', maxWidth: '82%' }}>
      <div style={{
        padding: '10px 14px', borderRadius: 14,
        background: isUser ? 'var(--silver-grad)' : 'rgba(255,255,255,.04)',
        color: isUser ? '#0a0a0c' : 'var(--txt-0)',
        fontSize: 13.5, lineHeight: 1.5,
        border: isUser ? 'none' : '1px solid var(--border)',
        whiteSpace: 'pre-wrap',
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
      background: 'rgba(255,255,255,.04)', border: '1px solid var(--border)',
    }}>
      <div style={{ fontSize: 11, color: 'var(--txt-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 700 }}>
        Confirma este registro?
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', fontSize: 12.5, color: 'var(--txt-1)' }}>
        <span style={{ color: 'var(--txt-3)' }}>Cliente</span><span>{a.cliente}</span>
        <span style={{ color: 'var(--txt-3)' }}>Produto</span><span>{a.produto_nome}</span>
        <span style={{ color: 'var(--txt-3)' }}>Valor</span><span>R$ {a.valor.toLocaleString('pt-BR')} ({a.tipo.toUpperCase()})</span>
        <span style={{ color: 'var(--txt-3)' }}>Pagamento</span><span>{fpLabel}{a.parcelas ? ` em ${a.parcelas}x` : ''}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button type="button" onClick={() => onChoose(false)} style={{
          flex: 1, padding: '8px 12px', borderRadius: 8,
          border: '1px solid var(--border)', background: 'transparent',
          color: 'var(--txt-1)', cursor: 'pointer', fontFamily: 'inherit',
          fontSize: 12.5, fontWeight: 600,
        }}>Cancelar</button>
        <button type="button" onClick={() => onChoose(true)} style={{
          flex: 1, padding: '8px 12px', borderRadius: 8, border: 'none',
          background: 'var(--silver-grad)', color: '#0a0a0c', cursor: 'pointer',
          fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700,
        }}>Confirmar</button>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────── */

function CosmicBg() {
  return (
    <div aria-hidden style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
      background: `
        radial-gradient(circle at 50% 38%, rgba(96,165,250,.10), transparent 45%),
        radial-gradient(circle at 50% 38%, rgba(96,165,250,.05) 0, rgba(96,165,250,.05) 1px, transparent 1px) 0 0 / 28px 28px,
        radial-gradient(circle at 14% 22%, rgba(255,255,255,.25), transparent 1.2px),
        radial-gradient(circle at 78% 18%, rgba(255,255,255,.20), transparent 1px),
        radial-gradient(circle at 22% 76%, rgba(255,255,255,.18), transparent 1.5px),
        radial-gradient(circle at 86% 70%, rgba(255,255,255,.22), transparent 1px),
        radial-gradient(circle at 64% 50%, rgba(255,255,255,.15), transparent 1px)
      `,
      maskImage: 'radial-gradient(circle at 50% 38%, black 0, black 35%, transparent 70%)',
      WebkitMaskImage: 'radial-gradient(circle at 50% 38%, black 0, black 35%, transparent 70%)',
    }} />
  );
}
