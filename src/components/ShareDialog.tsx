import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  listTokens, createToken, revokeToken,
  buildPublicUrl, type ShareToken,
} from '../lib/shareTokens';
import { CopyIcon, CheckIcon, CloseIcon, PlusIcon, PowerOffIcon } from './icons/Icons';
import type { Contrato } from '../types';

interface Props {
  contrato: Contrato;
  contratoLabel: string; // ex: "Vieira Barbosa · Funil de Vendas"
  onClose: () => void;
}

export default function ShareDialog({ contrato, contratoLabel, onClose }: Props) {
  const contractId = contrato.id;
  const [tokens, setTokens] = useState<ShareToken[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const reload = async () => {
    if (!contractId) return;
    setLoading(true);
    setError(null);
    try {
      const list = await listTokens(contractId);
      setTokens(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [contractId]);

  const gerar = async () => {
    if (!contractId || working) return;
    setWorking(true);
    setError(null);
    try {
      await createToken(contractId, 30);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setWorking(false);
    }
  };

  const revogar = async (tokenId: string) => {
    if (working) return;
    setWorking(true);
    setError(null);
    try {
      await revokeToken(tokenId);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setWorking(false);
    }
  };

  const copiar = async (token: ShareToken) => {
    const url = buildPublicUrl(token.token);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(token.id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch { /* noop */ }
  };

  return createPortal(
    <div className="modal-backdrop show" onClick={onClose}>
      <div
        className="modal modal-sm"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 580, padding: 28 }}
      >
        <div className="modal-head">
          <div>
            <div className="modal-title">Compartilhar ficha</div>
            <div className="modal-subtitle" style={{ marginBottom: 0, marginTop: 4, fontSize: 12.5, color: 'var(--txt-2)' }}>
              {contratoLabel}
            </div>
          </div>
          <button
            className="modal-close"
            onClick={onClose}
            style={{ display: 'grid', placeItems: 'center' }}
          ><CloseIcon size={14} /></button>
        </div>

        <div className="modal-body">
          {/* Aviso quando o contrato ainda não foi salvo no servidor */}
          {!contractId && (
            <div style={{
              padding: 14, borderRadius: 10, marginBottom: 16,
              background: 'rgba(251,191,36,.10)', border: '1px solid rgba(251,191,36,.3)',
              color: '#fbbf24', fontSize: 12.5, lineHeight: 1.5,
            }}>
              ⏳ Este contrato ainda está sincronizando no servidor (auto-save em andamento). Aguarde
              alguns segundos e clique no botão 🔗 de novo. Se persistir, abra qualquer outro mês
              do Plano Anual e volte — força a sincronização.
            </div>
          )}

          {/* Aviso LGPD */}
          {contractId && (
            <div style={{
              padding: 12, borderRadius: 10, marginBottom: 14,
              background: 'rgba(96,165,250,.08)', border: '1px solid rgba(96,165,250,.2)',
              color: 'var(--txt-2)', fontSize: 11.5, lineHeight: 1.5,
            }}>
              🔒 Quem tiver o link consegue ver a ficha sem login. O link expira em <strong>30 dias</strong>.
              Você pode revogar a qualquer momento. <strong>Não compartilhe em canais públicos</strong> —
              a ficha contém dados sensíveis (cliente, valor, condições).
            </div>
          )}

          {/* Erro */}
          {error && (
            <div style={{
              padding: 12, borderRadius: 8, marginBottom: 12,
              background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)',
              color: '#f87171', fontSize: 12.5,
            }}>⚠ {error}</div>
          )}

          {/* Lista de tokens */}
          {contractId && loading && (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--txt-3)', fontSize: 12.5 }}>Carregando…</div>
          )}

          {contractId && !loading && tokens && tokens.length === 0 && (
            <EmptyTokens onCreate={gerar} working={working} />
          )}

          {contractId && !loading && tokens && tokens.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tokens.map(t => (
                <TokenRow
                  key={t.id}
                  token={t}
                  copied={copiedId === t.id}
                  onCopy={() => copiar(t)}
                  onRevoke={() => revogar(t.id)}
                  working={working}
                />
              ))}
            </div>
          )}
        </div>

        <div
          className="modal-actions"
          style={{
            gap: 10, marginTop: 24, paddingTop: 18,
            borderTop: '1px solid var(--border)',
            justifyContent: 'space-between',
          }}
        >
          <button className="btn" onClick={onClose}>Fechar</button>
          {contractId && (
            <button
              className="btn btn-primary"
              onClick={gerar}
              disabled={working}
              style={{ opacity: working ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <PlusIcon size={13} />
              {working ? 'Gerando…' : 'Gerar novo link'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ────────────────────────────────────────────────────────────────── */

function TokenRow({
  token, copied, onCopy, onRevoke, working,
}: { token: ShareToken; copied: boolean; onCopy: () => void; onRevoke: () => void; working: boolean }) {
  const isRevoked = !!token.revokedAt;
  const expiresAt = new Date(token.expiresAt);
  const isExpired = expiresAt.getTime() < Date.now();
  const active = !isRevoked && !isExpired;
  const url = buildPublicUrl(token.token);

  const status = isRevoked ? 'revogado' : (isExpired ? 'expirado' : 'ativo');
  const statusColor = isRevoked ? '#f87171' : (isExpired ? 'var(--txt-3)' : '#34d399');

  return (
    <div style={{
      padding: 12, borderRadius: 10,
      background: 'var(--bg-1)', border: '1px solid var(--border)',
      opacity: active ? 1 : 0.55,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 10, padding: '2px 7px', borderRadius: 5,
          background: 'rgba(255,255,255,.04)', color: statusColor,
          fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase',
        }}>● {status}</span>
        <span style={{ fontSize: 11, color: 'var(--txt-3)' }}>
          {isRevoked ? `Revogado em ${new Date(token.revokedAt!).toLocaleDateString('pt-BR')}` :
            (isExpired ? `Expirou em ${expiresAt.toLocaleDateString('pt-BR')}` :
              `Expira em ${expiresAt.toLocaleDateString('pt-BR')}`)}
        </span>
        <span style={{ fontSize: 11, color: 'var(--txt-3)' }}>· {token.accessCount} acesso{token.accessCount === 1 ? '' : 's'}</span>
      </div>

      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input
          readOnly
          value={url}
          className="form-input"
          style={{ flex: 1, fontSize: 11.5, fontFamily: 'var(--font-mono, monospace)' }}
          onFocus={e => e.currentTarget.select()}
        />
        {active && (
          <>
            <button
              type="button" onClick={onCopy}
              style={{
                padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
                background: copied ? 'rgba(52,211,153,.15)' : 'var(--bg-2)',
                color: copied ? '#34d399' : 'var(--txt-1)',
                cursor: 'pointer', fontFamily: 'inherit', fontSize: 11.5, fontWeight: 600,
                whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
              {copied ? 'copiado' : 'copiar'}
            </button>
            <button
              type="button" onClick={onRevoke} disabled={working} title="Revogar este link"
              style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'var(--bg-2)', border: '1px solid var(--border)',
                color: '#f87171', cursor: working ? 'wait' : 'pointer',
                display: 'grid', placeItems: 'center', fontFamily: 'inherit',
              }}
            ><PowerOffIcon size={14} /></button>
          </>
        )}
      </div>
    </div>
  );
}

function EmptyTokens({ onCreate, working }: { onCreate: () => void; working: boolean }) {
  return (
    <div style={{
      padding: 30, textAlign: 'center', borderRadius: 10,
      background: 'var(--bg-1)', border: '1px dashed var(--border)',
    }}>
      <div style={{ fontSize: 13, color: 'var(--txt-1)', marginBottom: 6, fontWeight: 600 }}>
        Nenhum link ainda
      </div>
      <div style={{ fontSize: 12, color: 'var(--txt-3)', marginBottom: 16 }}>
        Gere um link pra compartilhar a ficha com o time operacional ou jurídico.
      </div>
      <button
        type="button" onClick={onCreate} disabled={working}
        style={{
          padding: '8px 16px', borderRadius: 9, border: 'none',
          background: 'var(--silver-grad)', color: '#0a0a0c',
          fontWeight: 700, fontSize: 12.5, cursor: working ? 'wait' : 'pointer',
          fontFamily: 'inherit', opacity: working ? 0.5 : 1,
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}
      >
        <PlusIcon size={13} />
        {working ? 'Gerando…' : 'Gerar primeiro link'}
      </button>
    </div>
  );
}
