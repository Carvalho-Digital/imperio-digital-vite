import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { useAgenteChat } from '../../hooks/useAgenteChat';
import { useAuth } from '../../context/AuthContext';
import AgenteLogo from '../AgenteLogo';
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
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch { /* noop */ }
  };

  return (
    <div style={{ alignSelf: isUser ? 'flex-end' : 'flex-start', maxWidth: isUser ? '82%' : '88%' }}>
      <div style={{
        padding: '12px 16px', borderRadius: 14,
        background: isUser ? 'var(--silver-grad)' : 'rgba(255,255,255,.04)',
        color: isUser ? '#0a0a0c' : 'var(--txt-0)',
        fontSize: 13.5, lineHeight: 1.55,
        border: isUser ? 'none' : '1px solid var(--border)',
      }}>
        {isUser ? (
          <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
        ) : (
          <MarkdownContent text={msg.content} />
        )}
      </div>
      {!isUser && (
        <div style={{ display: 'flex', gap: 6, marginTop: 4, opacity: 0.65 }}>
          <button
            type="button" onClick={copy}
            style={{
              fontSize: 10.5, padding: '3px 8px', borderRadius: 5,
              background: 'transparent', border: '1px solid var(--border)',
              color: 'var(--txt-3)', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >{copied ? '✓ copiado' : '⧉ copiar'}</button>
        </div>
      )}
      {msg.pendingAction && (
        <ConfirmCard action={msg.pendingAction} onChoose={(ok) => onConfirm(msg.id, msg.pendingAction!, ok)} />
      )}
    </div>
  );
}

function MarkdownContent({ text }: { text: string }) {
  return (
    <div className="md-body">
      <style>{`
        .md-body > *:first-child { margin-top: 0 }
        .md-body > *:last-child { margin-bottom: 0 }
        .md-body p { margin: 0 0 8px 0; line-height: 1.55 }
        .md-body strong { color: var(--txt-0); font-weight: 700 }
        .md-body em { color: var(--txt-2); font-style: italic }
        .md-body ul, .md-body ol { margin: 6px 0 10px 0; padding-left: 20px }
        .md-body li { margin: 3px 0; line-height: 1.5 }
        .md-body code { background: rgba(255,255,255,.07); padding: 1px 5px; border-radius: 4px; font-size: 12px; font-family: var(--font-mono, monospace) }
        .md-body pre { background: rgba(0,0,0,.35); padding: 10px 12px; border-radius: 8px; overflow-x: auto; margin: 8px 0 }
        .md-body pre code { background: transparent; padding: 0 }
        .md-body h1, .md-body h2, .md-body h3 { color: var(--txt-0); margin: 12px 0 6px 0; font-weight: 700; line-height: 1.3 }
        .md-body h1 { font-size: 16px } .md-body h2 { font-size: 14.5px } .md-body h3 { font-size: 13.5px }
        .md-body hr { border: none; border-top: 1px solid var(--border); margin: 12px 0 }
        .md-body blockquote { border-left: 2px solid var(--border); padding-left: 10px; margin: 8px 0; color: var(--txt-2) }
        .md-body a { color: #60a5fa; text-decoration: underline }
      `}</style>
      <ReactMarkdown>{text}</ReactMarkdown>
    </div>
  );
}

function ConfirmCard({ action, onChoose }: { action: PendingAction; onChoose: (ok: boolean) => void }) {
  return (
    <div style={{
      marginTop: 8, padding: 14, borderRadius: 12,
      background: 'rgba(255,255,255,.04)', border: '1px solid var(--border)',
    }}>
      <div style={{ fontSize: 11, color: 'var(--txt-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 700 }}>
        Confirma este registro?
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', fontSize: 12.5, color: 'var(--txt-1)' }}>
        {action.kind === 'registrar_contrato' ? (
          <>
            <span style={{ color: 'var(--txt-3)' }}>Cliente</span><span>{action.args.cliente}</span>
            <span style={{ color: 'var(--txt-3)' }}>Produto</span><span>{action.args.produto_nome}</span>
            <span style={{ color: 'var(--txt-3)' }}>Valor</span><span>R$ {action.args.valor.toLocaleString('pt-BR')} ({action.args.tipo.toUpperCase()})</span>
            <span style={{ color: 'var(--txt-3)' }}>Pagamento</span><span>{({ cartao: 'Cartão', avista: 'À vista', mensalidade: 'Mensalidade', parcelado: 'Parcelado' })[action.args.formaPagamento]}{action.args.parcelas ? ` em ${action.args.parcelas}x` : ''}</span>
          </>
        ) : (
          <>
            <span style={{ color: 'var(--txt-3)' }}>Data</span><span>{action.args.data}</span>
            {action.args.ligacoes != null && <><span style={{ color: 'var(--txt-3)' }}>Ligações</span><span>{action.args.ligacoes}</span></>}
            {action.args.reunioes_agendadas != null && <><span style={{ color: 'var(--txt-3)' }}>Reun. agendadas</span><span>{action.args.reunioes_agendadas}</span></>}
            {action.args.reunioes_realizadas != null && <><span style={{ color: 'var(--txt-3)' }}>Reun. realizadas</span><span>{action.args.reunioes_realizadas}</span></>}
            {action.args.propostas != null && <><span style={{ color: 'var(--txt-3)' }}>Propostas</span><span>{action.args.propostas}</span></>}
          </>
        )}
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
