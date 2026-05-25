import React, { createContext, useContext, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import type {
  PromptOpts, ConfirmOpts, AlertOpts, ChoiceOpts,
  AddContratoOpts, DetalharContratoOpts, Contrato, ContratoFicha,
  ModalContextValue, FormaPagamento,
} from '../types';
import { callExtractFicha } from '../lib/agent';

interface ModalState {
  promptOpen: boolean;
  promptOpts: PromptOpts;
  confirmOpen: boolean;
  confirmOpts: ConfirmOpts;
  alertOpen: boolean;
  alertOpts: AlertOpts;
  choiceOpen: boolean;
  choiceOpts: ChoiceOpts;
  addContratoOpen: boolean;
  addContratoOpts: AddContratoOpts | null;
  detalharContratoOpen: boolean;
  detalharContratoOpts: DetalharContratoOpts | null;
}

const defaultState: ModalState = {
  promptOpen: false,
  promptOpts: {},
  confirmOpen: false,
  confirmOpts: {},
  alertOpen: false,
  alertOpts: {},
  choiceOpen: false,
  choiceOpts: {},
  addContratoOpen: false,
  addContratoOpts: null,
  detalharContratoOpen: false,
  detalharContratoOpts: null,
};

const ModalCtx = createContext<ModalContextValue | null>(null);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [ms, setMs] = useState<ModalState>(defaultState);

  const promptResolveRef      = useRef<((v: string | null) => void) | null>(null);
  const confirmResolveRef     = useRef<((v: boolean) => void) | null>(null);
  const alertResolveRef       = useRef<(() => void) | null>(null);
  const choiceResolveRef      = useRef<((v: string | null) => void) | null>(null);
  const contratoResolveRef    = useRef<((v: Contrato | null) => void) | null>(null);
  const detalharResolveRef    = useRef<((v: ContratoFicha | null) => void) | null>(null);

  const showPrompt = (opts: PromptOpts): Promise<string | null> =>
    new Promise(resolve => {
      promptResolveRef.current = resolve;
      setMs(p => ({ ...p, promptOpen: true, promptOpts: opts }));
    });

  const showConfirm = (opts: ConfirmOpts): Promise<boolean> =>
    new Promise(resolve => {
      confirmResolveRef.current = resolve;
      setMs(p => ({ ...p, confirmOpen: true, confirmOpts: opts }));
    });

  const showAlert = (opts: AlertOpts): Promise<void> =>
    new Promise(resolve => {
      alertResolveRef.current = resolve;
      setMs(p => ({ ...p, alertOpen: true, alertOpts: opts }));
    });

  const showChoice = (opts: ChoiceOpts): Promise<string | null> =>
    new Promise(resolve => {
      choiceResolveRef.current = resolve;
      setMs(p => ({ ...p, choiceOpen: true, choiceOpts: opts }));
    });

  const showAddContrato = (opts: AddContratoOpts): Promise<Contrato | null> =>
    new Promise(resolve => {
      contratoResolveRef.current = resolve;
      setMs(p => ({ ...p, addContratoOpen: true, addContratoOpts: opts }));
    });

  const showDetalharContrato = (opts: DetalharContratoOpts): Promise<ContratoFicha | null> =>
    new Promise(resolve => {
      detalharResolveRef.current = resolve;
      setMs(p => ({ ...p, detalharContratoOpen: true, detalharContratoOpts: opts }));
    });

  const resolvePrompt = (v: string | null) => {
    promptResolveRef.current?.(v);
    setMs(p => ({ ...p, promptOpen: false }));
  };

  const resolveConfirm = (v: boolean) => {
    confirmResolveRef.current?.(v);
    setMs(p => ({ ...p, confirmOpen: false }));
  };

  const resolveAlert = () => {
    alertResolveRef.current?.();
    setMs(p => ({ ...p, alertOpen: false }));
  };

  const resolveChoice = (v: string | null) => {
    choiceResolveRef.current?.(v);
    setMs(p => ({ ...p, choiceOpen: false }));
  };

  const resolveContrato = (v: Contrato | null) => {
    contratoResolveRef.current?.(v);
    setMs(p => ({ ...p, addContratoOpen: false }));
  };

  const resolveDetalhar = (v: ContratoFicha | null) => {
    detalharResolveRef.current?.(v);
    setMs(p => ({ ...p, detalharContratoOpen: false }));
  };

  return (
    <ModalCtx.Provider value={{ showPrompt, showConfirm, showAlert, showChoice, showAddContrato, showDetalharContrato }}>
      {children}
      {/* Todos modais renderizam em document.body via Portal — evita problemas de
          containing block (transforms/filters em ancestrais quebrando position:fixed). */}
      {createPortal(
        <>
          {ms.promptOpen && (
            <ModalPrompt opts={ms.promptOpts} onResolve={resolvePrompt} />
          )}
          {ms.confirmOpen && (
            <ModalConfirm opts={ms.confirmOpts} onResolve={resolveConfirm} />
          )}
          {ms.alertOpen && (
            <ModalAlert opts={ms.alertOpts} onResolve={resolveAlert} />
          )}
          {ms.choiceOpen && (
            <ModalChoice opts={ms.choiceOpts} onResolve={resolveChoice} />
          )}
          {ms.addContratoOpen && ms.addContratoOpts && (
            <ModalAddContrato opts={ms.addContratoOpts} onResolve={resolveContrato} />
          )}
          {ms.detalharContratoOpen && ms.detalharContratoOpts && (
            <ModalDetalharContrato opts={ms.detalharContratoOpts} onResolve={resolveDetalhar} />
          )}
        </>,
        document.body
      )}
    </ModalCtx.Provider>
  );
}

export function useModal(): ModalContextValue {
  const ctx = useContext(ModalCtx);
  if (!ctx) throw new Error('useModal must be used inside ModalProvider');
  return ctx;
}

/* ============================================================
   ModalPrompt
   ============================================================ */
function ModalPrompt({
  opts, onResolve,
}: { opts: PromptOpts; onResolve: (v: string | null) => void }) {
  const [value, setValue] = useState(String(opts.defaultValue ?? ''));

  const ok = () => onResolve(value);
  const cancel = () => onResolve(null);

  return (
    <div className="modal-backdrop show" onClick={cancel}>
      <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-title">{opts.title || 'Editar valor'}</div>
            {opts.subtitle && <div className="modal-subtitle" style={{ marginBottom: 0, marginTop: 4, fontSize: 12.5, color: "var(--txt-2)" }}>{opts.subtitle}</div>}
          </div>
          <button className="modal-close" onClick={cancel}>×</button>
        </div>
        <div className="modal-body">
          {opts.message && (
            <div className="modal-msg" dangerouslySetInnerHTML={{ __html: opts.message }} />
          )}
          <input
            autoFocus
            type={opts.type || 'text'}
            className="form-input"
            placeholder={opts.placeholder || ''}
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); ok(); }
              if (e.key === 'Escape') cancel();
            }}
          />
          {opts.help && <div className="modal-help">{opts.help}</div>}
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={cancel}>Cancelar</button>
          <button className="btn btn-primary" onClick={ok}>{opts.okText || 'Salvar'}</button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   ModalConfirm
   ============================================================ */
function ModalConfirm({
  opts, onResolve,
}: { opts: ConfirmOpts; onResolve: (v: boolean) => void }) {
  const kind = opts.kind || 'warning';
  const icon = kind === 'danger' ? '⚠' : kind === 'info' ? 'ⓘ' : '⚠';

  return (
    <div className="modal-backdrop show" onClick={() => onResolve(false)}>
      <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">{opts.title || 'Confirmar'}</div>
          <button className="modal-close" onClick={() => onResolve(false)}>×</button>
        </div>
        <div className="modal-body">
          <div className={`modal-confirm-icon ${kind}`}>{icon}</div>
          {opts.message && (
            <div className="modal-msg" dangerouslySetInnerHTML={{ __html: opts.message }} />
          )}
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={() => onResolve(false)}>
            {opts.cancelText || 'Cancelar'}
          </button>
          <button
            autoFocus
            className={`btn ${kind === 'danger' ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => onResolve(true)}
          >
            {opts.okText || 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   ModalAlert
   ============================================================ */
function ModalAlert({
  opts, onResolve,
}: { opts: AlertOpts; onResolve: () => void }) {
  const kind = opts.kind || 'info';
  const icon = kind === 'danger' ? '⚠' : kind === 'warning' ? '⚠' : 'ⓘ';

  return (
    <div className="modal-backdrop show" onClick={onResolve}>
      <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">{opts.title || 'Aviso'}</div>
          <button className="modal-close" onClick={onResolve}>×</button>
        </div>
        <div className="modal-body">
          <div className={`modal-confirm-icon ${kind}`}>{icon}</div>
          {opts.message && (
            <div className="modal-msg" dangerouslySetInnerHTML={{ __html: opts.message }} />
          )}
        </div>
        <div className="modal-actions">
          <button autoFocus className="btn btn-primary" onClick={onResolve}>OK</button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   ModalChoice
   ============================================================ */
function ModalChoice({
  opts, onResolve,
}: { opts: ChoiceOpts; onResolve: (v: string | null) => void }) {
  return (
    <div className="modal-backdrop show" onClick={() => onResolve(null)}>
      <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-title">{opts.title || 'Escolha uma opção'}</div>
            {opts.subtitle && <div className="modal-subtitle" style={{ marginBottom: 0, marginTop: 4, fontSize: 12.5, color: "var(--txt-2)" }}>{opts.subtitle}</div>}
          </div>
          <button className="modal-close" onClick={() => onResolve(null)}>×</button>
        </div>
        <div className="modal-body">
          <div id="m-choice-options">
            {(opts.options || []).map(opt => (
              <div
                key={opt.key}
                className="modal-choice-row"
                onClick={() => onResolve(opt.key)}
              >
                <div className="choice-icon">{opt.icon || '◆'}</div>
                <div className="choice-content">
                  <div className="choice-title">{opt.title}</div>
                  {opt.desc && <div className="choice-desc">{opt.desc}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={() => onResolve(null)}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   ModalAddContrato
   ============================================================ */
import { useState as useStateLocal } from 'react';
import { COMBO_COMPONENTES } from '../lib/constants';
import { fmtBRLCompleto } from '../lib/formatters';

function ModalAddContrato({
  opts, onResolve,
}: { opts: AddContratoOpts; onResolve: (v: Contrato | null) => void }) {
  const { produto, mes } = opts;
  const isCombo = produto.id === 'combo';

  const [tipo, setTipo] = useStateLocal<'tcv' | 'mrr'>('tcv');
  const [valor, setValor] = useStateLocal('');
  const [autoFilled, setAutoFilled] = useStateLocal(true);
  const [mesesContrato, setMesesContrato] = useStateLocal(
    ('mesesMRR' in produto ? produto.mesesMRR : 6) || 6
  );
  const [comboItens, setComboItens] = useStateLocal<string[]>([]);
  const [cliente, setCliente] = useStateLocal('');
  const [formaPagamento, setFormaPagamento] = useStateLocal<FormaPagamento | null>(null);
  const [parcelas, setParcelas] = useStateLocal<string>('1');

  const exigeParcelas = formaPagamento === 'cartao' || formaPagamento === 'parcelado';

  const ticketSug = tipo === 'mrr'
    ? (('ticketMRR' in produto ? produto.ticketMRR : 0) || ('ticketDefaultMRR' in produto ? produto.ticketDefaultMRR : 0) || 0)
    : (('ticketTCV' in produto ? produto.ticketTCV : 0) || ('ticketDefaultTCV' in produto ? produto.ticketDefaultTCV : 0) || 0);

  const displayValor = autoFilled ? String(ticketSug) : valor;

  const toggleTipo = (t: 'tcv' | 'mrr') => {
    setTipo(t);
    setAutoFilled(true);
    setValor('');
  };

  const toggleCombo = (id: string) => {
    setComboItens(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const ok = async () => {
    const v = parseFloat(displayValor) || 0;
    if (v <= 0) return;
    if (isCombo && comboItens.length < 2) return;
    if (!cliente.trim()) return;
    if (!formaPagamento) return;
    const nParcelas = exigeParcelas ? Math.max(1, parseInt(parcelas) || 1) : null;
    onResolve({
      valor: v,
      tipo,
      meses: tipo === 'mrr' ? mesesContrato : null,
      comboItens: isCombo ? [...comboItens] : null,
      cliente: cliente.trim(),
      formaPagamento,
      parcelas: nParcelas,
    });
  };

  const cancel = () => onResolve(null);

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11.5, fontWeight: 600,
    color: 'var(--txt-1)', marginBottom: 6, letterSpacing: 0.2,
    textTransform: 'uppercase',
  };
  const hintStyle: React.CSSProperties = {
    fontSize: 11, color: 'var(--txt-3)', marginTop: 6, lineHeight: 1.4,
  };
  const blockGap = 18;
  const sectionDivider: React.CSSProperties = {
    height: 1, background: 'var(--border)', margin: `${blockGap}px 0`,
    opacity: 0.6,
  };

  const fpOptions = [
    { id: 'cartao' as const,      label: 'Cartão' },
    { id: 'avista' as const,      label: 'À vista' },
    { id: 'mensalidade' as const, label: 'Mensalidade' },
    { id: 'parcelado' as const,   label: 'Parcelado' },
  ];

  const chipPgtoBase: React.CSSProperties = {
    flex: '1 1 0', minWidth: 0,
    padding: '10px 8px',
    background: 'var(--bg-2)',
    border: '1px solid var(--border)',
    borderRadius: 9,
    fontSize: 12.5, fontWeight: 700,
    color: 'var(--txt-2)',
    cursor: 'pointer', textAlign: 'center',
    transition: 'all 0.12s', fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  };
  const chipPgtoActive: React.CSSProperties = {
    ...chipPgtoBase,
    background: 'var(--silver-grad)',
    color: '#0a0a0c',
    borderColor: 'transparent',
  };

  return (
    <div className="modal-backdrop show" onClick={cancel}>
      <div
        className="modal modal-sm"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 540, padding: 28 }}
      >
        <div className="modal-head">
          <div>
            <div className="modal-title">Novo contrato</div>
            {mes && (
              <div className="modal-subtitle" style={{ marginBottom: 0, marginTop: 4, fontSize: 12.5, color: 'var(--txt-2)' }}>
                {mes} · {'icon' in produto ? produto.icon : ''} {produto.nome}
              </div>
            )}
          </div>
          <button className="modal-close" onClick={cancel}>×</button>
        </div>

        <div className="modal-body">
          {/* ── 1. Identificação ─────────────────────── */}
          <label style={{ display: 'block', marginBottom: blockGap }}>
            <span style={labelStyle}>Cliente / Empresa</span>
            <input
              type="text"
              className="form-input"
              placeholder="Nome do cliente ou empresa fechada"
              value={cliente}
              onChange={e => setCliente(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') ok(); if (e.key === 'Escape') cancel(); }}
            />
          </label>

          {/* ── 2. Tipo de contrato ──────────────────── */}
          <div style={{ marginBottom: blockGap }}>
            <span style={labelStyle}>Tipo de contrato</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['tcv', 'mrr'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  className={`contrato-tipo-chip${tipo === t ? ' active' : ''}`}
                  onClick={() => toggleTipo(t)}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {isCombo && (
            <div style={{ marginBottom: blockGap }}>
              <span style={labelStyle}>Produtos do combo (mínimo 2)</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {COMBO_COMPONENTES.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    className={`combo-comp-chip${comboItens.includes(c.id) ? ' selected' : ''}`}
                    onClick={() => toggleCombo(c.id)}
                  >
                    {c.icon} {c.nome}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── 3. Valor ─────────────────────────────── */}
          <label style={{ display: 'block', marginBottom: tipo === 'mrr' ? blockGap : 0 }}>
            <span style={labelStyle}>
              {tipo === 'mrr' ? 'Valor mensal (R$)' : 'Valor do contrato (R$)'}
            </span>
            <input
              autoFocus
              type="number"
              className="form-input"
              value={displayValor}
              onChange={e => { setAutoFilled(false); setValor(e.target.value); }}
              onKeyDown={e => { if (e.key === 'Enter') ok(); if (e.key === 'Escape') cancel(); }}
            />
            <div style={hintStyle}>
              Ticket sugerido: {fmtBRLCompleto(ticketSug)}{tipo === 'mrr' ? '/mês' : ''}
            </div>
          </label>

          {tipo === 'mrr' && (
            <label style={{ display: 'block' }}>
              <span style={labelStyle}>Duração do contrato (meses)</span>
              <input
                type="number"
                min={1}
                className="form-input"
                value={mesesContrato}
                onChange={e => setMesesContrato(parseInt(e.target.value) || 6)}
              />
            </label>
          )}

          <div style={sectionDivider} />

          {/* ── 4. Pagamento ─────────────────────────── */}
          <div style={{ marginBottom: exigeParcelas ? blockGap : 0 }}>
            <span style={labelStyle}>Forma de pagamento</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {fpOptions.map(fp => {
                const active = formaPagamento === fp.id;
                return (
                  <button
                    key={fp.id}
                    type="button"
                    style={active ? chipPgtoActive : chipPgtoBase}
                    onClick={() => setFormaPagamento(fp.id)}
                  >
                    {fp.label}
                  </button>
                );
              })}
            </div>
          </div>

          {exigeParcelas && (
            <label style={{ display: 'block' }}>
              <span style={labelStyle}>Quantidade de parcelas</span>
              <input
                type="number"
                min={1}
                className="form-input"
                value={parcelas}
                onChange={e => setParcelas(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') ok(); if (e.key === 'Escape') cancel(); }}
              />
              <div style={hintStyle}>
                Livre — ex: 1, 2, 3, 6, 12. Use <strong>Parcelado</strong> para divisões longas (ex: 50k em 3x de 16k a cada 4 meses).
              </div>
            </label>
          )}
        </div>

        <div
          className="modal-actions"
          style={{
            gap: 10,
            marginTop: 24,
            paddingTop: 18,
            borderTop: '1px solid var(--border)',
          }}
        >
          <button className="btn" onClick={cancel}>Cancelar</button>
          <button className="btn btn-primary" onClick={ok}>Adicionar contrato</button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   ModalDetalharContrato
   Ficha pós-fechamento para passar bastão pro Jurídico/Operacional.
   Abre automático após ModalAddContrato; usuário pode preencher ou Pular.
   ============================================================ */
function ModalDetalharContrato({
  opts, onResolve,
}: { opts: DetalharContratoOpts; onResolve: (v: ContratoFicha | null) => void }) {
  const { contrato, produto, mes, fichaAtual } = opts;
  const inicio0 = fichaAtual?.vigenciaInicio ?? new Date().toISOString().slice(0, 10);
  const meses0 = fichaAtual?.vigenciaMeses ?? (contrato.meses ?? 6);

  const [vigenciaInicio, setVigenciaInicio] = useStateLocal<string>(inicio0);
  const [vigenciaMeses, setVigenciaMeses]   = useStateLocal<number>(meses0);
  const [entregaveis, setEntregaveis]       = useStateLocal<string>(fichaAtual?.entregaveis ?? '');
  const [notasOperacional, setNotasOp]      = useStateLocal<string>(fichaAtual?.notasOperacional ?? '');
  const [notasJuridico, setNotasJur]        = useStateLocal<string>(fichaAtual?.notasJuridico ?? '');
  const [notasLivres, setNotasLivres]       = useStateLocal<string>(fichaAtual?.notasLivres ?? '');

  // Fase B — auto-preencher por transcrição Read AI
  const [transcriptOpen, setTranscriptOpen] = useStateLocal(false);
  const [transcriptText, setTranscriptText] = useStateLocal('');
  const [extracting, setExtracting]         = useStateLocal(false);
  const [extractError, setExtractError]     = useStateLocal<string | null>(null);
  // Marca quais campos foram preenchidos pela IA (pra mostrar badge ⭐)
  const [iaFilled, setIaFilled]             = useStateLocal<Set<string>>(new Set());

  const handleExtract = async () => {
    if (!transcriptText.trim() || extracting) return;
    setExtractError(null);
    setExtracting(true);
    try {
      const e = await callExtractFicha(transcriptText.trim());
      const filled = new Set<string>();
      if (e.vigenciaInicio)    { setVigenciaInicio(e.vigenciaInicio);   filled.add('vigenciaInicio'); }
      if (e.vigenciaMeses)     { setVigenciaMeses(e.vigenciaMeses);     filled.add('vigenciaMeses'); }
      if (e.entregaveis)       { setEntregaveis(e.entregaveis);         filled.add('entregaveis'); }
      if (e.notasOperacional)  { setNotasOp(e.notasOperacional);        filled.add('notasOperacional'); }
      if (e.notasJuridico)     { setNotasJur(e.notasJuridico);          filled.add('notasJuridico'); }
      if (e.notasLivres)       { setNotasLivres(e.notasLivres);         filled.add('notasLivres'); }
      setIaFilled(filled);
      setTranscriptOpen(false);
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setExtracting(false);
    }
  };

  const markEdited = (key: string) => {
    if (iaFilled.has(key)) {
      const next = new Set(iaFilled);
      next.delete(key);
      setIaFilled(next);
    }
  };

  const IaBadge = ({ k }: { k: string }) =>
    iaFilled.has(k) ? (
      <span style={{
        marginLeft: 6, fontSize: 9, padding: '2px 6px',
        background: 'rgba(96,165,250,.15)', color: '#60a5fa',
        borderRadius: 4, fontWeight: 700, letterSpacing: 0.3,
      }}>★ IA — REVISAR</span>
    ) : null;

  const dataFim = (() => {
    if (!vigenciaInicio || !vigenciaMeses) return '';
    const d = new Date(vigenciaInicio + 'T00:00:00');
    d.setMonth(d.getMonth() + vigenciaMeses);
    return d.toISOString().slice(0, 10);
  })();

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11.5, fontWeight: 600,
    color: 'var(--txt-1)', marginBottom: 6, letterSpacing: 0.2,
    textTransform: 'uppercase',
  };
  const hintStyle: React.CSSProperties = {
    fontSize: 11, color: 'var(--txt-3)', marginTop: 6, lineHeight: 1.4,
  };
  const blockGap = 18;
  const inputStyle: React.CSSProperties = { width: '100%' };

  const salvar = () => {
    onResolve({
      vigenciaInicio: vigenciaInicio || null,
      vigenciaMeses: vigenciaMeses || null,
      entregaveis: entregaveis.trim() || null,
      notasOperacional: notasOperacional.trim() || null,
      notasJuridico: notasJuridico.trim() || null,
      notasLivres: notasLivres.trim() || null,
      atualizadaEm: new Date().toISOString(),
    });
  };
  const pular = () => onResolve(null);

  const formatBRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });

  return (
    <div className="modal-backdrop show" onClick={pular}>
      <div
        className="modal modal-sm"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 620, padding: 28 }}
      >
        <div className="modal-head">
          <div>
            <div className="modal-title">Ficha do contrato — passagem de bastão</div>
            <div className="modal-subtitle" style={{ marginBottom: 0, marginTop: 4, fontSize: 12.5, color: 'var(--txt-2)' }}>
              {contrato.cliente ?? 'Cliente'} · {('icon' in produto ? produto.icon : '')} {produto.nome} · {formatBRL(contrato.valor)} {contrato.tipo.toUpperCase()}
              {mes ? ` · ${mes}` : ''}
            </div>
          </div>
          <button className="modal-close" onClick={pular}>×</button>
        </div>

        <div className="modal-body">
          {/* Banner Read AI */}
          {!transcriptOpen ? (
            <div style={{
              background: 'linear-gradient(135deg, rgba(96,165,250,.10), rgba(96,165,250,.04))',
              border: '1px solid rgba(96,165,250,.25)',
              borderRadius: 10, padding: '10px 12px', marginBottom: blockGap,
              fontSize: 12, color: 'var(--txt-1)', lineHeight: 1.5,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            }}>
              <div>
                <strong style={{ color: '#60a5fa' }}>⚡ Cola a transcrição do Read AI</strong>
                <div style={{ fontSize: 11, color: 'var(--txt-2)', marginTop: 2 }}>
                  A IA lê a transcrição e preenche os campos pra você revisar.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTranscriptOpen(true)}
                style={{
                  padding: '7px 12px', borderRadius: 8,
                  background: 'rgba(96,165,250,.15)',
                  border: '1px solid rgba(96,165,250,.35)',
                  color: '#60a5fa', fontWeight: 700, fontSize: 11.5,
                  cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
                }}
              >Colar transcrição</button>
            </div>
          ) : (
            <div style={{
              background: 'var(--bg-2)', border: '1px solid var(--border)',
              borderRadius: 10, padding: 12, marginBottom: blockGap,
            }}>
              <div style={{ fontSize: 11.5, color: 'var(--txt-2)', marginBottom: 6, fontWeight: 600 }}>
                Cola aqui a transcrição da reunião (Read AI, Google Meet, Zoom etc):
              </div>
              <textarea
                autoFocus
                rows={6}
                value={transcriptText}
                onChange={e => setTranscriptText(e.target.value)}
                placeholder="Cola o texto inteiro da reunião aqui — a IA extrai vigência, valor, entregáveis, notas pro time…"
                className="form-input"
                style={{ width: '100%', minHeight: 120, resize: 'vertical', fontFamily: 'inherit', fontSize: 12 }}
                disabled={extracting}
              />
              {extractError && (
                <div style={{ fontSize: 11, color: '#f87171', marginTop: 6 }}>⚠ {extractError}</div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => { setTranscriptOpen(false); setTranscriptText(''); setExtractError(null); }}
                  disabled={extracting}
                  style={{
                    padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)',
                    background: 'var(--bg-1)', color: 'var(--txt-1)', cursor: 'pointer',
                    fontFamily: 'inherit', fontSize: 11.5, fontWeight: 600,
                  }}
                >Cancelar</button>
                <button
                  type="button"
                  onClick={handleExtract}
                  disabled={!transcriptText.trim() || extracting}
                  style={{
                    padding: '7px 14px', borderRadius: 8, border: 'none',
                    background: extracting ? 'var(--bg-3)' : 'var(--silver-grad)',
                    color: '#0a0a0c', cursor: extracting ? 'wait' : 'pointer',
                    fontFamily: 'inherit', fontSize: 11.5, fontWeight: 700,
                  }}
                >{extracting ? 'Extraindo…' : 'Extrair e preencher'}</button>
              </div>
            </div>
          )}

          <div style={{
            background: 'var(--bg-2)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '10px 12px', marginBottom: blockGap,
            fontSize: 12, color: 'var(--txt-2)', lineHeight: 1.5,
          }}>
            Preenche pra ajudar o time operacional e jurídico. Se preferir, pula e completa depois pela aba <strong>Contratos</strong>.
          </div>

          {/* ── Vigência ─────────────────────────────── */}
          <div style={{ marginBottom: blockGap }}>
            <span style={labelStyle}>
              Vigência
              <IaBadge k="vigenciaInicio" />
              {!iaFilled.has('vigenciaInicio') && <IaBadge k="vigenciaMeses" />}
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <label>
                <span style={{ ...hintStyle, marginTop: 0, marginBottom: 4, display: 'block' }}>Início</span>
                <input
                  type="date"
                  className="form-input"
                  style={inputStyle}
                  value={vigenciaInicio}
                  onChange={e => { setVigenciaInicio(e.target.value); markEdited('vigenciaInicio'); }}
                />
              </label>
              <label>
                <span style={{ ...hintStyle, marginTop: 0, marginBottom: 4, display: 'block' }}>Duração (meses)</span>
                <input
                  type="number"
                  min={1}
                  className="form-input"
                  style={inputStyle}
                  value={vigenciaMeses}
                  onChange={e => { setVigenciaMeses(parseInt(e.target.value) || 0); markEdited('vigenciaMeses'); }}
                />
              </label>
            </div>
            {dataFim && (
              <div style={hintStyle}>Término previsto: <strong>{new Date(dataFim + 'T00:00:00').toLocaleDateString('pt-BR')}</strong></div>
            )}
          </div>

          {/* ── Entregáveis ──────────────────────────── */}
          <label style={{ display: 'block', marginBottom: blockGap }}>
            <span style={labelStyle}>Entregáveis prometidos ao cliente<IaBadge k="entregaveis" /></span>
            <textarea
              className="form-input"
              rows={3}
              placeholder="Ex: Posicionamento completo + 2 reuniões extras por mês + adaptação de criativos pro nicho"
              value={entregaveis}
              onChange={e => { setEntregaveis(e.target.value); markEdited('entregaveis'); }}
              style={{ ...inputStyle, resize: 'vertical', minHeight: 60, fontFamily: 'inherit' }}
            />
          </label>

          {/* ── Notas operacional ────────────────────── */}
          <label style={{ display: 'block', marginBottom: blockGap }}>
            <span style={labelStyle}>Notas pro time operacional<IaBadge k="notasOperacional" /></span>
            <textarea
              className="form-input"
              rows={3}
              placeholder="Preferências do cliente, sensibilidades, ponto focal. Ex: prefere WhatsApp a email; filho dele é o decisor real."
              value={notasOperacional}
              onChange={e => { setNotasOp(e.target.value); markEdited('notasOperacional'); }}
              style={{ ...inputStyle, resize: 'vertical', minHeight: 60, fontFamily: 'inherit' }}
            />
          </label>

          {/* ── Notas jurídico ───────────────────────── */}
          <label style={{ display: 'block', marginBottom: blockGap }}>
            <span style={labelStyle}>Notas pro jurídico<IaBadge k="notasJuridico" /></span>
            <textarea
              className="form-input"
              rows={3}
              placeholder="Cláusulas especiais, multas, exclusividade, condições atípicas a colocar no contrato."
              value={notasJuridico}
              onChange={e => { setNotasJur(e.target.value); markEdited('notasJuridico'); }}
              style={{ ...inputStyle, resize: 'vertical', minHeight: 60, fontFamily: 'inherit' }}
            />
          </label>

          {/* ── Notas livres ─────────────────────────── */}
          <label style={{ display: 'block' }}>
            <span style={labelStyle}>Notas livres<IaBadge k="notasLivres" /></span>
            <textarea
              className="form-input"
              rows={2}
              placeholder="Qualquer coisa que não couber nos campos acima."
              value={notasLivres}
              onChange={e => { setNotasLivres(e.target.value); markEdited('notasLivres'); }}
              style={{ ...inputStyle, resize: 'vertical', minHeight: 48, fontFamily: 'inherit' }}
            />
          </label>
        </div>

        <div
          className="modal-actions"
          style={{
            gap: 10, marginTop: 24, paddingTop: 18,
            borderTop: '1px solid var(--border)',
          }}
        >
          <button className="btn" onClick={pular}>Pular (preencher depois)</button>
          <button className="btn btn-primary" onClick={salvar}>Salvar ficha</button>
        </div>
      </div>
    </div>
  );
}
