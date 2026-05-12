import { useState, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import { useModal } from '../../context/ModalContext';
import {
  garantirBreakdownV2, getContratos, getMetaMensal, getReceitaTotalMes, normContrato,
} from '../../lib/calculations';
import { fmtBRL, fmtBRLCompleto } from '../../lib/formatters';
import { PROD_PRINCIPAIS, COMBO_COMPONENTES } from '../../lib/constants';

type Tab = 'novos' | 'avulsos' | 'mrr';

interface Props { idx: number; onClose: () => void }

export default function ModalFinalizarMes({ idx, onClose }: Props) {
  const { state, dispatch } = useAppContext();
  const { showConfirm, showAddContrato } = useModal();
  const { meses, produtosState } = state;
  const m = meses[idx];

  const [activeTab, setActiveTab] = useState<Tab>('novos');
  const [mrrAtivoVal, setMrrAtivoVal] = useState<number>(
    () => garantirBreakdownV2(m).mrrAtivo ?? 0
  );

  const principais = produtosState.items.filter(p => PROD_PRINCIPAIS.includes(p.id));
  const outros = m.detalhe?.outros ?? [];

  // totals
  let totalNovos = 0;
  let qtdNovos = 0;
  principais.forEach(p => {
    const cs = getContratos(m, p.id);
    cs.forEach(c => { totalNovos += c.valor; });
    qtdNovos += cs.length;
  });
  const totalAvulsos = outros.reduce((s, o) => s + (o.receita || 0), 0);
  const qtdAvulsos = outros.length;
  const grand = totalNovos + totalAvulsos + mrrAtivoVal;

  // MRR suggestion
  const { mrrSugerido, mrrDetalhes } = useMemo(() => {
    let sug = 0;
    const dets: string[] = [];
    for (let i = 0; i < idx; i++) {
      const prev = meses[i];
      if (!prev.breakdown || prev.breakdown.versao !== 2) continue;
      const dados = prev.breakdown.dados;
      principais.forEach(p => {
        if (!p.mesesMRR) return;
        const mesesContrato = p.mesesMRR;
        const mesesPassados = idx - i;
        if (mesesPassados >= 1 && mesesPassados <= mesesContrato) {
          type CEntry = number | { valor: number; tipo?: string };
          const cs = (dados.novos?.[p.id] || []) as Array<CEntry>;
          const mrrCs = cs.filter((c): c is { valor: number; tipo?: string } => typeof c === 'object' && c.tipo === 'mrr');
          const soma = mrrCs.reduce<number>((s, c) => s + c.valor, 0);
          if (soma > 0) {
            sug += soma;
            dets.push(`${mrrCs.length}× ${p.nome} de ${prev.mes} (mês ${mesesPassados + 1}/${mesesContrato + 1})`);
          }
        }
      });
    }
    return { mrrSugerido: sug, mrrDetalhes: dets };
  }, [idx, meses, principais]);

  const handleAddContrato = async (pid: string) => {
    const p = principais.find(x => x.id === pid);
    if (!p) return;
    const novo = await showAddContrato({ produto: p, mes: m.mes });
    if (!novo) return;
    dispatch({ type: 'ADD_CONTRATO', idx, pid, contrato: novo });
  };

  const handleRemoveContrato = async (pid: string, ci: number) => {
    const cs = getContratos(m, pid);
    const c = cs[ci];
    const ok = await showConfirm({
      title: 'Remover contrato?',
      message: `Contrato <strong>${(c.tipo ?? 'TCV').toUpperCase()}</strong> de <strong>${fmtBRLCompleto(c.valor)}</strong> será removido.`,
      kind: 'danger',
      okText: 'Sim, remover',
      cancelText: 'Cancelar',
    });
    if (!ok) return;
    dispatch({ type: 'REMOVE_CONTRATO', idx, pid, ci });
  };

  const handleSalvar = () => {
    dispatch({ type: 'FINALIZAR_MES', idx, mrrAtivo: mrrAtivoVal });
    onClose();
  };

  const renovEmModal = getContratos(m, 'renov').length;
  const novosNaoRenov = qtdNovos - renovEmModal;

  const badgeNovos = qtdNovos;
  const badgeAvulsos = qtdAvulsos;
  const badgeMrr = mrrAtivoVal > 0 ? fmtBRL(mrrAtivoVal) : 'R$ 0';

  return (
    <div className="modal-backdrop show" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-head">
          <div>
            <div className="modal-title">Finalizar {m.mes}</div>
            <div style={{ color: 'var(--txt-2)', fontSize: 13, marginTop: 4 }}>
              Lance contrato por contrato — cada um com seu valor real
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-tabs">
          <button className={`modal-tab${activeTab === 'novos' ? ' active' : ''}`} onClick={() => setActiveTab('novos')}>
            Novos contratos
            <span className="modal-tab-badge">{badgeNovos}</span>
          </button>
          <button className={`modal-tab${activeTab === 'avulsos' ? ' active' : ''}`} onClick={() => setActiveTab('avulsos')}>
            Avulsos
            <span className="modal-tab-badge">{badgeAvulsos}</span>
          </button>
          <button className={`modal-tab${activeTab === 'mrr' ? ' active' : ''}`} onClick={() => setActiveTab('mrr')}>
            MRR Ativo da Base
            <span className="modal-tab-badge">{badgeMrr}</span>
          </button>
        </div>

        {/* Painel: Novos Contratos */}
        <div className={`modal-panel${activeTab === 'novos' ? ' active' : ''}`}>
          <div style={{ fontSize: 12, color: 'var(--txt-2)', marginBottom: 14, lineHeight: 1.5 }}>
            Adicione cada contrato fechado no mês individualmente — incluindo{' '}
            <strong style={{ color: 'var(--silver-0)' }}>renovações</strong>, que agora têm seus próprios
            produtos. Use o botão <strong style={{ color: 'var(--silver-0)' }}>+ Adicionar contrato</strong>{' '}
            abaixo de cada produto.
          </div>
          <div id="modal-products-list">
            {principais.map(p => {
              const cs = getContratos(m, p.id);
              const sub = cs.reduce((s, c) => s + c.valor, 0);
              const metaTCV = getMetaMensal(m, p.id, 'tcv', produtosState);
              const metaMRR = getMetaMensal(m, p.id, 'mrr', produtosState);
              const tagParts: string[] = [];
              if (metaTCV > 0 || p.metaTCV > 0) tagParts.push(`TCV: meta ${metaTCV}/mês`);
              if (metaMRR > 0 || p.metaMRR > 0) tagParts.push(`MRR: meta ${metaMRR}/mês`);
              const tag = tagParts.length > 0 ? tagParts.join(' · ') : 'TCV ou MRR';

              return (
                <div key={p.id} className="modal-product-card">
                  <div className="modal-product-head">
                    <div>
                      <div className="modal-product-name">{p.icon} {p.nome}</div>
                      <div className="modal-product-tag">{tag}</div>
                    </div>
                    <button className="btn-add-contract" onClick={() => handleAddContrato(p.id)}>
                      + Adicionar contrato
                    </button>
                  </div>
                  <div className="modal-contracts-list">
                    {cs.map((c, ci) => {
                      const contrato = normContrato(c);
                      const mesesText = contrato.tipo === 'mrr' && contrato.meses ? ` · ${contrato.meses} meses` : '';
                      const comboText = contrato.comboItens?.length
                        ? ` · ${contrato.comboItens.map(id => COMBO_COMPONENTES.find(x => x.id === id)?.nome).filter(Boolean).join(' + ')}`
                        : '';
                      return (
                        <div key={ci} className="contract-row v16">
                          <span className="contract-pos">#{ci + 1}</span>
                          <span className="contract-info">
                            <span className={`mp-tipo-badge ${contrato.tipo}`}>
                              {contrato.tipo === 'mrr' ? 'MRR' : 'TCV'}
                            </span>
                            {' '}
                            <strong style={{ color: 'var(--silver-0)', fontFamily: 'var(--font-mono)' }}>
                              {fmtBRLCompleto(contrato.valor)}
                            </strong>
                            {mesesText}{comboText}
                          </span>
                          <button
                            className="contract-rm-btn"
                            onClick={() => handleRemoveContrato(p.id, ci)}
                            title="Remover"
                          >×</button>
                        </div>
                      );
                    })}
                  </div>
                  <div className="modal-product-foot">
                    <span><span>{cs.length}</span> contratos</span>
                    <span className="modal-product-subtotal">{fmtBRLCompleto(sub)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Painel: Avulsos */}
        <div className={`modal-panel${activeTab === 'avulsos' ? ' active' : ''}`}>
          <div style={{ fontSize: 12, color: 'var(--txt-2)', marginBottom: 14, lineHeight: 1.5 }}>
            Lance aqui serviços avulsos vendidos no mês — coisas pontuais que{' '}
            <strong style={{ color: 'var(--silver-0)' }}>não fazem parte dos produtos principais</strong>{' '}
            (Consultoria pontual, Google Meu Negócio, Mentoria, etc.).
          </div>
          <div className="modal-product-card">
            <div className="modal-product-head">
              <div>
                <div className="modal-product-name">✚ Serviços avulsos</div>
                <div className="modal-product-tag">Receita pontual · livre</div>
              </div>
              <button className="btn btn-sm" onClick={() => dispatch({ type: 'ADD_AVULSO', idx })}>
                + Adicionar avulso
              </button>
            </div>
            <div style={{ marginTop: 12 }}>
              {outros.length === 0 ? (
                <div style={{
                  padding: 14, background: 'var(--bg-1)', border: '1px dashed var(--border)',
                  borderRadius: 8, color: 'var(--txt-3)', fontSize: 12, fontStyle: 'italic', textAlign: 'center',
                }}>
                  Nenhum serviço avulso lançado · clique em "+ Adicionar avulso"
                </div>
              ) : (
                outros.map((o, oi) => (
                  <AvulsoRow key={oi} idx={idx} oi={oi} o={o} />
                ))
              )}
            </div>
            <div className="modal-product-foot">
              <span><span>{qtdAvulsos}</span> serviços</span>
              <span className="modal-product-subtotal">{fmtBRLCompleto(totalAvulsos)}</span>
            </div>
          </div>
        </div>

        {/* Painel: MRR Ativo */}
        <div className={`modal-panel${activeTab === 'mrr' ? ' active' : ''}`}>
          <div style={{ fontSize: 12, color: 'var(--txt-2)', marginBottom: 14, lineHeight: 1.5 }}>
            MRR ativo é a recorrência que entrou de clientes{' '}
            <strong style={{ color: 'var(--silver-0)' }}>já existentes</strong> (que assinaram em meses
            anteriores e ainda estão dentro do contrato). Não conte aqui os novos contratos do próprio mês.
          </div>
          <div className="mrr-suggestion-box">
            <div className="mrr-suggestion-head">
              <div>
                <div className="mrr-suggestion-label">Sugestão automática do sistema</div>
                <div className="mrr-suggestion-desc">
                  {mrrSugerido > 0
                    ? (mrrDetalhes.slice(0, 3).join(' · ') + (mrrDetalhes.length > 3 ? ` · +${mrrDetalhes.length - 3} outras fontes` : ''))
                    : 'Nenhum contrato MRR ativo de meses anteriores. Sugestão zerada — comece a finalizar os meses anteriores.'}
                </div>
              </div>
              <button
                className="btn btn-sm"
                disabled={mrrSugerido === 0}
                onClick={() => setMrrAtivoVal(mrrSugerido)}
              >
                Usar sugestão
              </button>
            </div>
            <div className="mrr-suggestion-value">{fmtBRLCompleto(mrrSugerido)}</div>
          </div>
          <div className="form-field" style={{ marginTop: 18 }}>
            <label className="form-label">MRR Ativo do Mês — valor manual (R$)</label>
            <input
              type="number"
              className="form-input"
              min={0}
              step={100}
              value={mrrAtivoVal}
              onChange={e => setMrrAtivoVal(parseFloat(e.target.value) || 0)}
            />
            <span className="form-help">
              Pode usar o botão "Usar sugestão" acima ou lançar manualmente. Esse valor entra no
              faturamento total do mês mas <strong>não</strong> conta como contrato novo.
            </span>
          </div>
        </div>

        {/* Totais consolidados */}
        <div className="modal-totals">
          <div className="modal-totals-grid" style={{ gridTemplateColumns: '1.1fr 1fr 1fr 1.4fr' }}>
            <div className="modal-totals-item">
              <div className="modal-totals-item-label">Contratos lançados</div>
              <div className="modal-totals-item-value">{fmtBRLCompleto(totalNovos)}</div>
              <div className="modal-totals-item-sub">
                {renovEmModal > 0
                  ? `${novosNaoRenov} novo${novosNaoRenov === 1 ? '' : 's'} + ${renovEmModal} renovaç${renovEmModal === 1 ? 'ão' : 'ões'}`
                  : `${qtdNovos} contrato${qtdNovos === 1 ? '' : 's'}`}
              </div>
            </div>
            <div className="modal-totals-item">
              <div className="modal-totals-item-label">Avulsos</div>
              <div className="modal-totals-item-value">{fmtBRLCompleto(totalAvulsos)}</div>
              <div className="modal-totals-item-sub">{qtdAvulsos} serviç{qtdAvulsos === 1 ? 'o' : 'os'}</div>
            </div>
            <div className="modal-totals-item">
              <div className="modal-totals-item-label">MRR ativo</div>
              <div className="modal-totals-item-value">{fmtBRLCompleto(mrrAtivoVal)}</div>
              <div className="modal-totals-item-sub">recorrência da base</div>
            </div>
            <div className="modal-totals-item modal-totals-grand">
              <div className="modal-totals-item-label">FATURAMENTO TOTAL</div>
              <div className="modal-totals-item-value gradient">{fmtBRLCompleto(grand)}</div>
              <div className="modal-totals-item-sub">
                {[
                  qtdNovos > 0 && `${qtdNovos} contratos`,
                  qtdAvulsos > 0 && `${qtdAvulsos} avulso${qtdAvulsos === 1 ? '' : 's'}`,
                  mrrAtivoVal > 0 && 'MRR ativo',
                ].filter(Boolean).join(' + ') || '0 lançamentos'}
              </div>
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSalvar}>Salvar &amp; Finalizar Mês</button>
        </div>
      </div>
    </div>
  );
}

function AvulsoRow({ idx, oi, o }: { idx: number; oi: number; o: { nome: string; qtd: number; receita: number } }) {
  const { dispatch } = useAppContext();
  const [editingReceita, setEditingReceita] = useState(false);
  const [receitaVal, setReceitaVal] = useState('');

  return (
    <div className="avulso-row">
      <span className="contract-pos">#{oi + 1}</span>
      <input
        type="text"
        className="av-nome"
        value={o.nome}
        placeholder="Ex: Google Meu Negócio"
        onChange={e => dispatch({ type: 'UPDATE_AVULSO', idx, oi, field: 'nome', valor: e.target.value })}
      />
      <input
        type="number"
        min={0}
        className="av-qtd"
        value={o.qtd}
        placeholder="Qtd"
        onChange={e => dispatch({ type: 'UPDATE_AVULSO', idx, oi, field: 'qtd', valor: e.target.value })}
      />
      <input
        type="text"
        inputMode="numeric"
        className="av-receita"
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
      <button className="av-rm" onClick={() => dispatch({ type: 'REMOVE_AVULSO', idx, oi })} title="Remover">×</button>
    </div>
  );
}
