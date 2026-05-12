import { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { useModal } from '../../context/ModalContext';
import {
  getContratos, getQtdRealizada, getReceitaRealizada,
  getMetaMensal, getReceitaTotalMes,
} from '../../lib/calculations';
import { fmtBRL, fmtBRLCompleto } from '../../lib/formatters';
import { PROD_PRINCIPAIS, COMBO_COMPONENTES } from '../../lib/constants';

interface Props { idx: number }

export default function ModalDetalheMes({ idx }: Props) {
  const { state, dispatch } = useAppContext();
  const { showConfirm, showPrompt, showAddContrato } = useModal();
  const { meses, produtosState } = state;
  const m = meses[idx];

  const principais = produtosState.items.filter(p => PROD_PRINCIPAIS.includes(p.id));
  let totalReceitaProd = 0;
  let totalContratosVendidos = 0;

  const outros = m.detalhe?.outros ?? [];
  const totalOutros = outros.reduce((s, o) => s + (o.receita || 0), 0);

  return (
    <div className="month-detail-wrap">
      <div className="month-detail-grid">
        <div>
          <div className="month-detail-section-title">📦 Produtos · TCV / MRR vs metas</div>
          {principais.map(p => {
            const realTCV = getQtdRealizada(m, p.id, 'tcv');
            const realMRR = getQtdRealizada(m, p.id, 'mrr');
            const recTCV   = getReceitaRealizada(m, p.id, 'tcv');
            const recMRR   = getReceitaRealizada(m, p.id, 'mrr');
            const receitaReal = recTCV + recMRR;
            const totalReal = realTCV + realMRR;
            totalReceitaProd += receitaReal;
            totalContratosVendidos += totalReal;

            const metaTCV = getMetaMensal(m, p.id, 'tcv', produtosState);
            const metaMRR = getMetaMensal(m, p.id, 'mrr', produtosState);
            const contratos = getContratos(m, p.id);

            const handleAddContrato = async () => {
              const novo = await showAddContrato({ produto: p, mes: m.mes });
              if (!novo) return;
              dispatch({ type: 'ADD_CONTRATO', idx, pid: p.id, contrato: novo });
            };

            const handleEditMeta = async (tipo: 'tcv' | 'mrr') => {
              const atual = getMetaMensal(m, p.id, tipo, produtosState);
              const metaAnual = tipo === 'tcv' ? p.metaTCV : p.metaMRR;
              const sugestao = Math.round(metaAnual / 12);
              const novo = await showPrompt({
                title: `Meta de ${tipo.toUpperCase()} · ${p.nome}`,
                subtitle: `${m.mes} 2026`,
                message: `Quantos contratos <strong>${tipo.toUpperCase()}</strong> de ${p.nome} fechar neste mês?`,
                defaultValue: atual,
                type: 'number',
                placeholder: 'Ex: 5',
                help: `Meta anual: ${metaAnual} ${tipo.toUpperCase()} · Sugestão: ${sugestao}/mês`,
                okText: 'Salvar meta',
              });
              if (novo === null || novo.trim() === '') return;
              const n = Math.max(0, parseInt(novo) || 0);
              dispatch({ type: 'SET_META_MENSAL', idx, pid: p.id, tipo, valor: n });
            };

            const handleRmContrato = async (ci: number) => {
              const c = contratos[ci];
              const ok = await showConfirm({
                title: 'Remover contrato?',
                message: `Contrato <strong>${(c.tipo ?? 'TCV').toUpperCase()}</strong> de <strong>${fmtBRLCompleto(c.valor)}</strong> será removido.`,
                kind: 'danger',
                okText: 'Sim, remover',
                cancelText: 'Cancelar',
              });
              if (!ok) return;
              dispatch({ type: 'REMOVE_CONTRATO', idx, pid: p.id, ci });
            };

            const indTCV = (metaTCV > 0 || p.metaTCV > 0)
              ? (
                <button
                  type="button"
                  className={`mp-tipo-ind tcv${realTCV >= metaTCV && metaTCV > 0 ? ' ok' : ''}`}
                  onClick={() => handleEditMeta('tcv')}
                >
                  TCV: {realTCV}/{metaTCV}{realTCV >= metaTCV && metaTCV > 0 ? ' ✓' : ''}
                </button>
              ) : realTCV > 0 ? (
                <button type="button" className="mp-tipo-ind tcv" onClick={() => handleEditMeta('tcv')}>
                  TCV: {realTCV}
                </button>
              ) : null;

            const indMRR = (metaMRR > 0 || p.metaMRR > 0)
              ? (
                <button
                  type="button"
                  className={`mp-tipo-ind mrr${realMRR >= metaMRR && metaMRR > 0 ? ' ok' : ''}`}
                  onClick={() => handleEditMeta('mrr')}
                >
                  MRR: {realMRR}/{metaMRR}{realMRR >= metaMRR && metaMRR > 0 ? ' ✓' : ''}
                </button>
              ) : realMRR > 0 ? (
                <button type="button" className="mp-tipo-ind mrr" onClick={() => handleEditMeta('mrr')}>
                  MRR: {realMRR}
                </button>
              ) : null;

            return (
              <div key={p.id}>
                <div className="month-product-row v16">
                  <div className="mp-info">
                    <div className="mp-head-line">
                      <span className="mp-icon">{p.icon}</span>
                      <span className="mp-name">{p.nome}</span>
                    </div>
                    <div className="mp-indicadores">
                      {indTCV} {indMRR}
                      {!indTCV && !indMRR && (
                        <span style={{ color: 'var(--txt-3)', fontSize: 10.5 }}>sem meta definida</span>
                      )}
                    </div>
                  </div>
                  <div className="mp-receita-col">
                    <div className="mp-receita-val">{fmtBRL(receitaReal)}</div>
                    <div className="mp-receita-detail">{totalReal} contrato{totalReal === 1 ? '' : 's'}</div>
                  </div>
                  <button className="btn-add-contrato-mp" onClick={handleAddContrato}>+ contrato</button>
                </div>

                {contratos.length > 0 && (
                  <div className="mp-contratos-lista">
                    {contratos.map((c, ci) => {
                      const mesesText = c.tipo === 'mrr' && c.meses ? ` · ${c.meses} meses` : '';
                      const comboText = c.comboItens?.length
                        ? ` · ${c.comboItens.map(id => COMBO_COMPONENTES.find(x => x.id === id)?.nome).filter(Boolean).join(' + ')}`
                        : '';
                      return (
                        <div key={ci} className="mp-contrato-row">
                          <span className="mp-contrato-num">#{ci + 1}</span>
                          <span className={`mp-tipo-badge ${c.tipo}`}>{c.tipo === 'mrr' ? 'MRR' : 'TCV'}</span>
                          <span className="mp-contrato-detail">
                            {fmtBRLCompleto(c.valor)}{mesesText}{comboText}
                          </span>
                          <button className="mp-contrato-rm" onClick={() => handleRmContrato(ci)} title="Remover">×</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div>
          <div className="month-detail-section-title">✚ Outros (serviços avulsos)</div>
          {outros.length === 0
            ? <div style={{ fontSize: 11.5, color: 'var(--txt-3)', fontStyle: 'italic', padding: '8px 0' }}>Nenhum serviço avulso lançado.</div>
            : outros.map((o, oi) => (
              <OutroRow key={oi} idx={idx} oi={oi} o={o} />
            ))
          }
          <button
            className="btn btn-sm"
            style={{ marginTop: 8 }}
            onClick={() => dispatch({ type: 'ADD_AVULSO', idx })}
          >
            + Adicionar serviço avulso
          </button>
        </div>
      </div>

      <div className="month-detail-foot">
        <span className="month-detail-foot-label">
          {totalContratosVendidos} contrato{totalContratosVendidos === 1 ? '' : 's'} principais
          {outros.length > 0 ? ` + ${outros.length} avuls${outros.length === 1 ? 'o' : 'os'}` : ''}
          {' '}· receita total: <strong style={{ color: 'var(--silver-1)' }}>{fmtBRL(totalReceitaProd + totalOutros)}</strong>
        </span>
        <span className="month-detail-foot-value">vs {fmtBRL(m.receita)} no plano</span>
      </div>
    </div>
  );
}

function OutroRow({ idx, oi, o }: { idx: number; oi: number; o: { nome: string; qtd: number; receita: number } }) {
  const { dispatch } = useAppContext();
  const [editingReceita, setEditingReceita] = useState(false);
  const [receitaVal, setReceitaVal] = useState('');

  return (
    <div className="outros-row">
      <input
        type="text"
        value={o.nome}
        placeholder="Nome do serviço (ex: Consultoria pontual)"
        onChange={e => dispatch({ type: 'UPDATE_AVULSO', idx, oi, field: 'nome', valor: e.target.value })}
      />
      <input
        type="number"
        min={0}
        value={o.qtd}
        placeholder="Qtd"
        onChange={e => dispatch({ type: 'UPDATE_AVULSO', idx, oi, field: 'qtd', valor: e.target.value })}
      />
      <input
        type="text"
        inputMode="numeric"
        className="outros-receita"
        value={editingReceita ? receitaVal : fmtBRLCompleto(o.receita)}
        placeholder="R$ 0"
        onFocus={() => { setEditingReceita(true); setReceitaVal(o.receita === 0 ? '' : String(o.receita)); }}
        onChange={e => setReceitaVal(e.target.value)}
        onBlur={() => {
          setEditingReceita(false);
          const limpo = receitaVal.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
          const val = Math.max(0, parseFloat(limpo) || 0);
          dispatch({ type: 'UPDATE_AVULSO', idx, oi, field: 'receita', valor: val });
        }}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      />
      <button className="outros-rm" onClick={() => dispatch({ type: 'REMOVE_AVULSO', idx, oi })} title="Remover">×</button>
    </div>
  );
}
