import { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { calcReceitaProduto, calcProdutosTotais, dashSomarMeses } from '../../lib/calculations';
import { fmtBRL } from '../../lib/formatters';
import type { ProdutoState } from '../../types';

export default function ProdutosMixPanel() {
  const { state } = useAppContext();
  const { produtosState, meses, premissas } = state;
  const [editingProd, setEditingProd] = useState<string | null>(null);

  const totais = calcProdutosTotais(produtosState);
  const planoTotal = meses.reduce((s, m) => s + m.receita, 0);

  const total = totais.totaisPorTipo.mrr + totais.totaisPorTipo.tcv;
  const pctMrr = total > 0 ? (totais.totaisPorTipo.mrr / total) * 100 : 0;
  const pctTcv = total > 0 ? (totais.totaisPorTipo.tcv / total) * 100 : 0;

  const diff = planoTotal - total;
  const hasGap = planoTotal > 0 && Math.abs(diff) > 50000;

  const trimestres = [
    { titulo: 'Q1 — Capitalizar',          periodo: 'Janeiro–Março',    foco: 'TCV para gerar caixa' },
    { titulo: 'Q2 — Equilibrar & Renovar', periodo: 'Abril–Junho',      foco: 'Renovações começam' },
    { titulo: 'Q3 — Acelerar MRR',         periodo: 'Julho–Setembro',   foco: 'MRR forte + Upsells' },
    { titulo: 'Q4 — Consolidar',           periodo: 'Outubro–Dezembro', foco: 'MRR > R$ 250.000 + 2027' },
  ];
  const trimAtual = Math.floor(new Date().getMonth() / 3);

  return (
    <>
      <div className="topbar">
        <div>
          <h1 className="page-title">Produtos &amp; Mix de Receita</h1>
          <div className="page-subtitle">
            {totais.totalContratosNovos} contratos novos previstos · receita total: {fmtBRL(totais.totalReceita)} · plano anual: {fmtBRL(planoTotal)}
          </div>
        </div>
      </div>

      <div className="section" style={{ marginTop: 0 }}>
        <div className="section-eyebrow">Composição</div>
        <div className="section-title">Produtos do Portfólio</div>
        <div className="section-desc">Edite quantidade, ticket ou % do mix · receita recalcula automaticamente · todos vinculados ao plano anual</div>
      </div>

      <div className="grid-3">
        {produtosState.items.map(p => {
          const rec = calcReceitaProduto(p);
          const totalContratos = (p.metaTCV || 0) + (p.metaMRR || 0);
          const pctReceita = totais.totalReceita > 0 ? (rec.total / totais.totalReceita) * 100 : 0;

          return (
            <div key={p.id} className="product-card clickable" onClick={() => setEditingProd(p.id)}>
              <div className="product-head">
                <div className="product-icon">{p.icon}</div>
                <div>
                  <div className="product-name">{p.nome}</div>
                  <div className="product-tag">{p.tag}</div>
                </div>
              </div>
              <div className="product-row">
                <span className="product-label">Total contratos</span>
                <span className="product-value">
                  {totalContratos}
                  {(p.metaTCV || 0) > 0 && (p.metaMRR || 0) > 0 ? ` (${p.metaTCV} TCV + ${p.metaMRR} MRR)` : ''}
                </span>
              </div>
              {(p.metaTCV || 0) > 0 && (
                <div className="product-row">
                  <span className="product-label">Meta TCV</span>
                  <span className="product-value">
                    {p.metaTCV} × {fmtBRL(p.ticketTCV)} = <strong style={{ color: 'var(--silver-1)' }}>{fmtBRL(rec.tcv)}</strong>
                  </span>
                </div>
              )}
              {(p.metaMRR || 0) > 0 && (
                <div className="product-row">
                  <span className="product-label">Meta MRR</span>
                  <span className="product-value">
                    {p.metaMRR} × {fmtBRL(p.ticketMRR)}/mês × {p.isRenov ? 12 : (p.mesesMRR || 6)}m = <strong style={{ color: 'var(--silver-1)' }}>{fmtBRL(rec.mrr)}</strong>
                  </span>
                </div>
              )}
              {(p.metaTCV || 0) === 0 && (p.metaMRR || 0) === 0 && (
                <div className="product-row">
                  <span className="product-label">Sem meta</span>
                  <span className="product-value" style={{ color: 'var(--txt-3)' }}>defina TCV/MRR</span>
                </div>
              )}
              <div className="product-row">
                <span className="product-label">Receita anual</span>
                <span className="product-value" style={{ color: 'var(--silver-0)' }}>{fmtBRL(rec.total)}</span>
              </div>
              <div className="product-row" style={{ borderTop: '1px dashed var(--border)', marginTop: 4, paddingTop: 8 }}>
                <span className="product-label">% receita total</span>
                <span className="product-value" style={{ color: 'var(--silver-1)', fontSize: 12 }}>{pctReceita.toFixed(1)}%</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="section">
        <div className="section-eyebrow">Mix de Receita</div>
        <div className="section-title">MRR vs TCV — Distribuição Anual</div>
        <div className="section-desc">Equilíbrio entre receita recorrente (MRR) e à vista (TCV) com base nos produtos editados acima</div>
      </div>

      <div className="card">
        <div className="mix-bar-wrap">
          <div className="mix-bar-header">
            <span className="mix-bar-label">MRR (Recorrente)</span>
            <span className="mix-bar-value">{pctMrr.toFixed(0)}% — {fmtBRL(totais.totaisPorTipo.mrr)}</span>
          </div>
          <div className="mix-bar-track"><div className="mix-bar-fill" style={{ width: `${pctMrr}%` }} /></div>
        </div>
        <div className="mix-bar-wrap">
          <div className="mix-bar-header">
            <span className="mix-bar-label">TCV (À Vista)</span>
            <span className="mix-bar-value">{pctTcv.toFixed(0)}% — {fmtBRL(totais.totaisPorTipo.tcv)}</span>
          </div>
          <div className="mix-bar-track"><div className="mix-bar-fill" style={{ width: `${pctTcv}%` }} /></div>
        </div>
        <div className="note-box">
          💡 <strong>Estratégia:</strong> Q1/Q2 foco em TCV para gerar caixa imediato. Q3/Q4 foco em MRR para construir base recorrente sólida e aumentar valuation da empresa.
        </div>
        {hasGap && (
          <div className="note-box" style={{ borderLeftColor: 'var(--amber)', marginTop: 14 }}>
            ⚠ <strong>Atenção:</strong> a soma das receitas dos produtos ({fmtBRL(total)}) está{' '}
            {diff > 0 ? 'abaixo' : 'acima'} do plano anual ({fmtBRL(planoTotal)}) por{' '}
            <strong>{fmtBRL(Math.abs(diff))}</strong>.{' '}
            {diff > 0 ? 'Considere aumentar quantidade ou ticket de algum produto.' : 'Considere reduzir quantidade ou rever ticket.'}
          </div>
        )}
      </div>

      <div className="section">
        <div className="section-eyebrow">Trimestres</div>
        <div className="section-title">Estratégia Trimestral 2026</div>
        <div className="section-desc">Receita, contratos e leads de cada trimestre vêm direto do plano anual · alterações no plano refletem aqui</div>
      </div>

      <div className="grid-2">
        {trimestres.map((t, qi) => {
          const indices = [qi * 3, qi * 3 + 1, qi * 3 + 2];
          const dados = dashSomarMeses(indices, meses, premissas);
          const isCurrent = qi === trimAtual;
          return (
            <div key={qi} className={`trim-card${isCurrent ? ' current' : ''}`}>
              <div className="trim-head">
                <div className="trim-title">{t.titulo}</div>
                <span className={`pill ${isCurrent ? 'pill-green' : 'pill-silver'}`}>
                  {isCurrent ? 'Em curso' : t.periodo}
                </span>
              </div>
              <div className="trim-row"><span className="trim-label">Receita</span><span className="trim-value">{fmtBRL(dados.receitaTotal)}</span></div>
              <div className="trim-row">
                <span className="trim-label">Contratos</span>
                <span className="trim-value">
                  {dados.contratos} novos{dados.renov > 0 ? ` + ${dados.renov} renov.` : ''}
                </span>
              </div>
              <div className="trim-row"><span className="trim-label">Reuniões</span><span className="trim-value">{dados.reun}</span></div>
              <div className="trim-row"><span className="trim-label">Leads</span><span className="trim-value">{dados.leads}</span></div>
              <div className="trim-row"><span className="trim-label">Foco</span><span className="trim-value">{t.foco}</span></div>
            </div>
          );
        })}
      </div>

      {editingProd && (
        <ModalEditProduto
          prodId={editingProd}
          onClose={() => setEditingProd(null)}
        />
      )}
    </>
  );
}

function ModalEditProduto({ prodId, onClose }: { prodId: string; onClose: () => void }) {
  const { state, dispatch } = useAppContext();
  const { produtosState } = state;
  const p = produtosState.items.find(x => x.id === prodId);
  if (!p) return null;

  const [metaTCV, setMetaTCV] = useState(p.metaTCV || 0);
  const [metaMRR, setMetaMRR] = useState(p.metaMRR || 0);
  const [ticketTCV, setTicketTCV] = useState(p.ticketTCV || 0);
  const [ticketMRR, setTicketMRR] = useState(p.ticketMRR || 0);
  const [mesesMRR, setMesesMRR] = useState(p.mesesMRR || 6);

  const tmpProd: ProdutoState = { ...p, metaTCV, metaMRR, ticketTCV, ticketMRR, mesesMRR };
  const rec = calcReceitaProduto(tmpProd);

  let totalReceitaSim = 0;
  produtosState.items.forEach(x => {
    totalReceitaSim += x.id === prodId ? rec.total : calcReceitaProduto(x).total;
  });
  const pctReceita = totalReceitaSim > 0 ? (rec.total / totalReceitaSim) * 100 : 0;

  const handleSalvar = () => {
    dispatch({
      type: 'SAVE_PRODUTO',
      pid: prodId,
      campos: {
        metaTCV: Math.max(0, metaTCV),
        metaMRR: Math.max(0, metaMRR),
        ticketTCV: Math.max(0, ticketTCV),
        ticketMRR: Math.max(0, ticketMRR),
        mesesMRR: Math.max(1, mesesMRR),
      },
    });
    onClose();
  };

  return (
    <div className="modal-backdrop show" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-sm" style={{ maxWidth: 540 }}>
        <div className="modal-head">
          <div>
            <div className="modal-title">{p.icon} {p.nome}</div>
            <div className="modal-prompt-msg" style={{ marginBottom: 0, marginTop: 4, fontSize: 12.5, color: 'var(--txt-2)' }}>
              {p.tag}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-section" style={{ padding: 0, margin: 0 }}>
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 9, padding: 14, marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--silver-1)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
              TCV — À vista
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-field">
                <label className="form-label">Meta de contratos</label>
                <input type="number" min={0} step={1} className="form-input" value={metaTCV}
                  onChange={e => setMetaTCV(parseFloat(e.target.value) || 0)} />
              </div>
              <div className="form-field">
                <label className="form-label">Ticket (R$)</label>
                <input type="number" min={0} step={100} className="form-input" value={ticketTCV}
                  onChange={e => setTicketTCV(parseFloat(e.target.value) || 0)} />
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 9, padding: 14, marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--blue, #60a5fa)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
              MRR — Recorrente
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: 12 }}>
              <div className="form-field">
                <label className="form-label">Meta de contratos</label>
                <input type="number" min={0} step={1} className="form-input" value={metaMRR}
                  onChange={e => setMetaMRR(parseFloat(e.target.value) || 0)} />
              </div>
              <div className="form-field">
                <label className="form-label">Ticket (R$/mês)</label>
                <input type="number" min={0} step={100} className="form-input" value={ticketMRR}
                  onChange={e => setTicketMRR(parseFloat(e.target.value) || 0)} />
              </div>
              <div className="form-field">
                <label className="form-label">Meses</label>
                <input type="number" min={1} max={36} step={1} className="form-input" value={mesesMRR}
                  onChange={e => setMesesMRR(parseFloat(e.target.value) || 6)} />
              </div>
            </div>
          </div>

          <div style={{ background: 'linear-gradient(180deg, var(--bg-2), var(--bg-3))', border: '1px solid var(--silver-2)', borderRadius: 9, padding: '12px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: 12 }}>
              <span style={{ color: 'var(--txt-2)' }}>Receita TCV</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--silver-1)' }}>{fmtBRL(rec.tcv)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: 12 }}>
              <span style={{ color: 'var(--txt-2)' }}>Receita MRR</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--blue, #60a5fa)' }}>{fmtBRL(rec.mrr)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0 4px 0', fontSize: 13, borderTop: '1px dashed var(--border)', marginTop: 6 }}>
              <span style={{ color: 'var(--txt-1)', fontWeight: 700 }}>Receita anual total</span>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--silver-0)', fontSize: 16 }}>{fmtBRL(rec.total)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: 11.5 }}>
              <span style={{ color: 'var(--txt-3)' }}>% receita total</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--silver-1)' }}>{pctReceita.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSalvar}>Salvar</button>
        </div>
      </div>
    </div>
  );
}
