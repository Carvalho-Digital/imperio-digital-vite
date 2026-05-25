import { useMemo, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { useModal } from '../../context/ModalContext';
import { getContratos } from '../../lib/calculations';
import { fmtBRLCompleto } from '../../lib/formatters';
import ShareDialog from '../ShareDialog';
import type { Contrato, ProdutoState } from '../../types';

type StatusFicha = 'completa' | 'incompleta' | 'sem';

interface ContratoRow {
  idx: number;            // 0-11 (mês)
  mesNome: string;
  pid: string;
  produto: ProdutoState;
  ci: number;             // índice no array de contratos do mês/produto
  contrato: Contrato;
  status: StatusFicha;
}

function classificarFicha(c: Contrato): StatusFicha {
  if (!c.ficha) return 'sem';
  const f = c.ficha;
  const camposRelevantes = [
    f.vigenciaInicio,
    f.vigenciaMeses,
    f.entregaveis,
    f.notasOperacional,
    f.notasJuridico,
    f.notasLivres,
  ];
  const preenchidos = camposRelevantes.filter(v => v != null && v !== '' && v !== 0).length;
  if (preenchidos === 0) return 'sem';
  if (preenchidos >= 3) return 'completa';
  return 'incompleta';
}

const STATUS_META: Record<StatusFicha, { label: string; icon: string; color: string; bg: string }> = {
  completa:   { label: 'Ficha completa',   icon: '✓', color: '#34d399', bg: 'rgba(52,211,153,.12)' },
  incompleta: { label: 'Ficha incompleta', icon: '⚠', color: '#fbbf24', bg: 'rgba(251,191,36,.12)' },
  sem:        { label: 'Sem ficha',        icon: '○', color: 'var(--txt-3)', bg: 'rgba(255,255,255,.04)' },
};

export default function ContratosPanel() {
  const { state, dispatch } = useAppContext();
  const { showDetalharContrato, showConfirm } = useModal();

  const [filtroMes, setFiltroMes] = useState<number | 'all'>('all');
  const [filtroStatus, setFiltroStatus] = useState<StatusFicha | 'all'>('all');
  const [filtroProduto, setFiltroProduto] = useState<string | 'all'>('all');
  const [busca, setBusca] = useState('');
  const [shareRow, setShareRow] = useState<ContratoRow | null>(null);

  // Constrói o array flat de todos os contratos do workspace
  const rows: ContratoRow[] = useMemo(() => {
    const produtos = state.produtosState?.items ?? [];
    const out: ContratoRow[] = [];
    state.meses.forEach((mes, idx) => {
      produtos.forEach(p => {
        const cs = getContratos(mes, p.id);
        cs.forEach((c, ci) => {
          out.push({
            idx, mesNome: mes.mes,
            pid: p.id, produto: p,
            ci, contrato: c,
            status: classificarFicha(c),
          });
        });
      });
    });
    // Ordena: mês asc, depois produto, depois valor desc
    out.sort((a, b) => a.idx - b.idx || a.pid.localeCompare(b.pid) || b.contrato.valor - a.contrato.valor);
    return out;
  }, [state.meses, state.produtosState]);

  // Aplica filtros
  const filteredRows = useMemo(() => {
    const buscaLower = busca.trim().toLowerCase();
    return rows.filter(r => {
      if (filtroMes !== 'all' && r.idx !== filtroMes) return false;
      if (filtroStatus !== 'all' && r.status !== filtroStatus) return false;
      if (filtroProduto !== 'all' && r.pid !== filtroProduto) return false;
      if (buscaLower) {
        const cliente = (r.contrato.cliente ?? '').toLowerCase();
        const produto = r.produto.nome.toLowerCase();
        if (!cliente.includes(buscaLower) && !produto.includes(buscaLower)) return false;
      }
      return true;
    });
  }, [rows, filtroMes, filtroStatus, filtroProduto, busca]);

  // Contadores pros chips de filtro
  const counts = useMemo(() => ({
    total: rows.length,
    completa: rows.filter(r => r.status === 'completa').length,
    incompleta: rows.filter(r => r.status === 'incompleta').length,
    sem: rows.filter(r => r.status === 'sem').length,
  }), [rows]);

  const editarFicha = async (row: ContratoRow) => {
    const ficha = await showDetalharContrato({
      contrato: row.contrato,
      produto: row.produto,
      mes: row.mesNome,
      fichaAtual: row.contrato.ficha,
    });
    if (!ficha) return; // user cancelou
    dispatch({ type: 'UPDATE_CONTRATO_FICHA', idx: row.idx, pid: row.pid, ci: row.ci, ficha });
  };

  const compartilhar = (row: ContratoRow) => setShareRow(row);

  const removerContrato = async (row: ContratoRow) => {
    const ok = await showConfirm({
      title: 'Remover contrato?',
      message: `Contrato de <strong>${row.contrato.cliente ?? 'cliente'}</strong> em ${row.produto.nome} no valor de <strong>${fmtBRLCompleto(row.contrato.valor)}</strong> será removido permanentemente.`,
      kind: 'danger',
      okText: 'Sim, remover',
      cancelText: 'Cancelar',
    });
    if (!ok) return;
    dispatch({ type: 'REMOVE_CONTRATO', idx: row.idx, pid: row.pid, ci: row.ci });
  };

  return (
    <div style={{ padding: 24, maxWidth: 1280, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--txt-0)', letterSpacing: -0.3, fontFamily: 'var(--font-display)' }}>
          Contratos
        </h1>
        <div style={{ fontSize: 12.5, color: 'var(--txt-2)', marginTop: 4, lineHeight: 1.4 }}>
          Todos os contratos do ano em um só lugar. Clique em um contrato para editar a ficha de passagem de bastão.
        </div>
      </div>

      {/* Stats — chips clicáveis que viram filtro de status */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <StatChip active={filtroStatus === 'all'} onClick={() => setFiltroStatus('all')}>
          Todos ({counts.total})
        </StatChip>
        <StatChip
          active={filtroStatus === 'completa'}
          onClick={() => setFiltroStatus('completa')}
          color={STATUS_META.completa.color}
        >
          ✓ Completas ({counts.completa})
        </StatChip>
        <StatChip
          active={filtroStatus === 'incompleta'}
          onClick={() => setFiltroStatus('incompleta')}
          color={STATUS_META.incompleta.color}
        >
          ⚠ Incompletas ({counts.incompleta})
        </StatChip>
        <StatChip
          active={filtroStatus === 'sem'}
          onClick={() => setFiltroStatus('sem')}
          color={STATUS_META.sem.color}
        >
          ○ Sem ficha ({counts.sem})
        </StatChip>
      </div>

      {/* Filtros + busca */}
      <div style={{
        display: 'flex', gap: 8, flexWrap: 'wrap',
        background: 'var(--bg-1)', border: '1px solid var(--border)',
        borderRadius: 11, padding: 12, marginBottom: 14,
      }}>
        <input
          type="text"
          className="form-input"
          placeholder="Buscar por cliente ou produto…"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          style={{ flex: 1, minWidth: 200 }}
        />
        <select
          className="form-input"
          value={filtroMes}
          onChange={e => setFiltroMes(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          style={{ minWidth: 130 }}
        >
          <option value="all">Todos os meses</option>
          {state.meses.map((m, i) => <option key={i} value={i}>{m.mes}</option>)}
        </select>
        <select
          className="form-input"
          value={filtroProduto}
          onChange={e => setFiltroProduto(e.target.value)}
          style={{ minWidth: 160 }}
        >
          <option value="all">Todos os produtos</option>
          {(state.produtosState?.items ?? []).map(p => (
            <option key={p.id} value={p.id}>{p.icon} {p.nome}</option>
          ))}
        </select>
      </div>

      {/* Dialog de compartilhamento */}
      {shareRow && (
        <ShareDialog
          contrato={shareRow.contrato}
          contratoLabel={`${shareRow.contrato.cliente ?? 'Sem cliente'} · ${shareRow.produto.icon} ${shareRow.produto.nome}`}
          onClose={() => setShareRow(null)}
        />
      )}

      {/* Lista */}
      {filteredRows.length === 0 ? (
        <EmptyState hasContracts={rows.length > 0} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filteredRows.map(row => (
            <ContractCard
              key={`${row.idx}-${row.pid}-${row.ci}`}
              row={row}
              onEdit={() => editarFicha(row)}
              onCopyLink={() => compartilhar(row)}
              onRemove={() => removerContrato(row)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────── */

function StatChip({
  active, onClick, children, color,
}: { active: boolean; onClick: () => void; children: React.ReactNode; color?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '7px 13px', borderRadius: 999,
        background: active ? 'var(--silver-grad)' : 'var(--bg-2)',
        border: active ? 'none' : '1px solid var(--border)',
        color: active ? '#0a0a0c' : (color ?? 'var(--txt-2)'),
        fontWeight: 600, fontSize: 12,
        cursor: 'pointer', fontFamily: 'inherit',
      }}
    >{children}</button>
  );
}

function ContractCard({
  row, onEdit, onCopyLink, onRemove,
}: { row: ContratoRow; onEdit: () => void; onCopyLink: () => void; onRemove: () => void }) {
  const meta = STATUS_META[row.status];
  const fpLabel = row.contrato.formaPagamento
    ? { cartao: 'Cartão', avista: 'À vista', mensalidade: 'Mensalidade', parcelado: 'Parcelado' }[row.contrato.formaPagamento]
    : null;

  return (
    <div
      onClick={onEdit}
      style={{
        padding: 14, borderRadius: 11,
        background: 'var(--bg-1)', border: '1px solid var(--border)',
        cursor: 'pointer', transition: 'background .12s',
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto', gap: 14,
        alignItems: 'center',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-1)')}
    >
      {/* Badge de status */}
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: meta.bg, color: meta.color,
        display: 'grid', placeItems: 'center',
        fontSize: 16, fontWeight: 700, fontFamily: 'inherit',
        flexShrink: 0,
      }} title={meta.label}>{meta.icon}</div>

      {/* Conteúdo */}
      <div style={{ minWidth: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--txt-0)' }}>
            {row.contrato.cliente ?? <em style={{ color: 'var(--txt-3)', fontWeight: 400 }}>Sem cliente</em>}
          </span>
          <span style={{
            fontSize: 10.5, padding: '2px 7px', borderRadius: 5,
            background: 'var(--bg-3)', color: 'var(--txt-2)',
            fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase',
          }}>{row.contrato.tipo.toUpperCase()}</span>
          <span style={{ fontSize: 11, color: 'var(--txt-3)' }}>· {row.mesNome}</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--txt-2)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span>{row.produto.icon} {row.produto.nome}</span>
          <span>·</span>
          <span style={{ color: 'var(--txt-0)', fontWeight: 600 }}>{fmtBRLCompleto(row.contrato.valor)}</span>
          {fpLabel && <><span>·</span><span>{fpLabel}{row.contrato.parcelas ? ` ${row.contrato.parcelas}x` : ''}</span></>}
        </div>
      </div>

      {/* Ações */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
        <ActionButton title="Copiar link público" onClick={onCopyLink}>🔗</ActionButton>
        <ActionButton title="Editar ficha" onClick={onEdit}>✎</ActionButton>
        <ActionButton title="Remover contrato" onClick={onRemove} danger>×</ActionButton>
      </div>
    </div>
  );
}

function ActionButton({
  children, title, onClick, danger,
}: { children: React.ReactNode; title: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        width: 32, height: 32, borderRadius: 8,
        background: 'var(--bg-2)', border: '1px solid var(--border)',
        color: danger ? '#f87171' : 'var(--txt-1)',
        cursor: 'pointer', fontSize: 14, fontFamily: 'inherit',
        display: 'grid', placeItems: 'center',
      }}
    >{children}</button>
  );
}

function EmptyState({ hasContracts }: { hasContracts: boolean }) {
  return (
    <div style={{
      padding: 40, textAlign: 'center', borderRadius: 12,
      background: 'var(--bg-1)', border: '1px dashed var(--border)',
    }}>
      <div style={{ fontSize: 14, color: 'var(--txt-1)', marginBottom: 6, fontWeight: 600 }}>
        {hasContracts ? 'Nenhum contrato encontrado com esses filtros' : 'Nenhum contrato registrado ainda'}
      </div>
      <div style={{ fontSize: 12, color: 'var(--txt-3)', maxWidth: 480, margin: '0 auto' }}>
        {hasContracts
          ? 'Ajuste ou limpe os filtros pra ver mais resultados.'
          : 'Vai em Plano Anual, abre um mês e adicione um contrato. Ele vai aparecer aqui automaticamente.'}
      </div>
    </div>
  );
}

