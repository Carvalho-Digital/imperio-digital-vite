import React, { createContext, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  PromptOpts, ConfirmOpts, AlertOpts, ChoiceOpts,
  AddContratoOpts, Contrato, ModalContextValue, FormaPagamento,
} from '../types';

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
};

const ModalCtx = createContext<ModalContextValue | null>(null);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [ms, setMs] = useState<ModalState>(defaultState);

  const promptResolveRef      = useRef<((v: string | null) => void) | null>(null);
  const confirmResolveRef     = useRef<((v: boolean) => void) | null>(null);
  const alertResolveRef       = useRef<(() => void) | null>(null);
  const choiceResolveRef      = useRef<((v: string | null) => void) | null>(null);
  const contratoResolveRef    = useRef<((v: Contrato | null) => void) | null>(null);

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

  return (
    <ModalCtx.Provider value={{ showPrompt, showConfirm, showAlert, showChoice, showAddContrato }}>
      {children}
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

  return (
    <div className="modal-backdrop show" onClick={cancel}>
      <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-title">Novo contrato · {produto.nome}</div>
            {mes && <div className="modal-subtitle" style={{ marginBottom: 0, marginTop: 4, fontSize: 12.5, color: "var(--txt-2)" }}>{mes} · {'icon' in produto ? produto.icon : ''} {produto.nome}</div>}
          </div>
          <button className="modal-close" onClick={cancel}>×</button>
        </div>
        <div className="modal-body">
          <label style={{ display: 'block', marginBottom: 12 }}>
            <span style={{ fontSize: 11.5, color: 'var(--txt-2)', display: 'block', marginBottom: 4 }}>
              Cliente / Empresa
            </span>
            <input
              type="text"
              className="form-input"
              placeholder="Ex: Dr. João Silva – Advocacia Silva &amp; Associados"
              value={cliente}
              onChange={e => setCliente(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') ok(); if (e.key === 'Escape') cancel(); }}
            />
          </label>

          <div id="m-contrato-tipos" style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
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

          {isCombo && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11.5, color: 'var(--txt-2)', marginBottom: 6 }}>
                Selecione 2+ produtos do combo:
              </div>
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

          <label style={{ display: 'block', marginBottom: 8 }}>
            <span style={{ fontSize: 11.5, color: 'var(--txt-2)', display: 'block', marginBottom: 4 }}>
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
            <div style={{ fontSize: 11, color: 'var(--txt-3)', marginTop: 4 }}>
              Ticket sugerido: {fmtBRLCompleto(ticketSug)}{tipo === 'mrr' ? '/mês' : ''}
            </div>
          </label>

          {tipo === 'mrr' && (
            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={{ fontSize: 11.5, color: 'var(--txt-2)', display: 'block', marginBottom: 4 }}>
                Duração do contrato (meses)
              </span>
              <input
                type="number"
                min={1}
                className="form-input"
                value={mesesContrato}
                onChange={e => setMesesContrato(parseInt(e.target.value) || 6)}
              />
            </label>
          )}

          <div style={{ marginBottom: exigeParcelas ? 12 : 0 }}>
            <span style={{ fontSize: 11.5, color: 'var(--txt-2)', display: 'block', marginBottom: 6 }}>
              Forma de pagamento
            </span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {([
                { id: 'cartao' as const, label: 'Cartão' },
                { id: 'avista' as const, label: 'À vista' },
                { id: 'mensalidade' as const, label: 'Mensalidade' },
                { id: 'parcelado' as const, label: 'Parcelado' },
              ]).map(fp => (
                <button
                  key={fp.id}
                  type="button"
                  className={`contrato-tipo-chip${formaPagamento === fp.id ? ' active' : ''}`}
                  onClick={() => setFormaPagamento(fp.id)}
                >
                  {fp.label}
                </button>
              ))}
            </div>
          </div>

          {exigeParcelas && (
            <label style={{ display: 'block' }}>
              <span style={{ fontSize: 11.5, color: 'var(--txt-2)', display: 'block', marginBottom: 4 }}>
                Quantidade de parcelas
              </span>
              <input
                type="number"
                min={1}
                className="form-input"
                value={parcelas}
                onChange={e => setParcelas(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') ok(); if (e.key === 'Escape') cancel(); }}
              />
              <div style={{ fontSize: 11, color: 'var(--txt-3)', marginTop: 4 }}>
                Livre. Ex: 1, 2, 3, 6, 12. Use Parcelado para divisões longas (ex: 50k em 3x de 16k a cada 4 meses).
              </div>
            </label>
          )}
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={cancel}>Cancelar</button>
          <button className="btn btn-primary" onClick={ok}>Adicionar contrato</button>
        </div>
      </div>
    </div>
  );
}
