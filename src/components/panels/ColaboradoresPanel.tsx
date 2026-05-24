import { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import type { ColaboradorProfile, ColaboradorNivel, ColaboradorTipo } from '../../types';

/* ── localStorage helpers ─────────────────────────────────── */
const LS_KEY = 'colab_profiles_v1';

function loadProfiles(): Record<string, ColaboradorProfile> {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; }
}
function saveProfiles(p: Record<string, ColaboradorProfile>) {
  localStorage.setItem(LS_KEY, JSON.stringify(p));
}

const NIVEL_LABEL: Record<ColaboradorNivel, string> = {
  junior: 'SDR JÚNIOR',
  pleno: 'SDR PLENO',
  senior: 'SDR SÊNIOR',
};
const NIVEL_COLOR: Record<ColaboradorNivel, string> = {
  junior: 'var(--blue)',
  pleno: 'var(--amber)',
  senior: 'var(--green)',
};
const NIVEL_BG: Record<ColaboradorNivel, string> = {
  junior: 'var(--blue-soft)',
  pleno: 'var(--amber-soft)',
  senior: 'var(--green-soft)',
};
const TIPO_LABEL: Record<ColaboradorTipo, string> = { sdr: 'SDR', closer: 'CLOSER' };

export default function ColaboradoresPanel() {
  const { state } = useAppContext();
  const { vendedores } = state.appState;
  const [profiles, setProfiles] = useState<Record<string, ColaboradorProfile>>(loadProfiles);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ColaboradorProfile & { clienteInput: string }>({
    nivel: 'pleno', tipo: 'sdr', clientes: [], clienteInput: '',
  });

  function getProfile(id: string): ColaboradorProfile {
    return profiles[id] ?? { nivel: 'pleno', tipo: 'sdr', clientes: [] };
  }

  function openEdit(id: string) {
    const p = getProfile(id);
    setEditForm({ nivel: p.nivel ?? 'pleno', tipo: p.tipo ?? 'sdr', clientes: p.clientes ?? [], clienteInput: '' });
    setEditingId(id);
  }

  function saveEdit(id: string) {
    const next = { ...profiles, [id]: { nivel: editForm.nivel, tipo: editForm.tipo, clientes: editForm.clientes } };
    setProfiles(next);
    saveProfiles(next);
    setEditingId(null);
  }

  function addCliente() {
    const v = editForm.clienteInput.trim();
    if (!v) return;
    setEditForm(f => ({ ...f, clientes: [...(f.clientes ?? []), v], clienteInput: '' }));
  }

  function removeCliente(i: number) {
    setEditForm(f => ({ ...f, clientes: f.clientes?.filter((_, j) => j !== i) ?? [] }));
  }

  // Métricas acumuladas totais (all-time)
  function calcMetricas(vendedorId: string) {
    const v = vendedores.find(x => x.id === vendedorId);
    if (!v) return { qualificados: 0, agendados: 0, realizados: 0 };
    return v.lancamentos.reduce((acc, l) => ({
      qualificados: acc.qualificados + (l.qualificados ?? l.propostas ?? 0),
      agendados: acc.agendados + l.reuniones_agendadas,
      realizados: acc.realizados + l.reunioes_realizadas,
    }), { qualificados: 0, agendados: 0, realizados: 0 });
  }

  const totalVendedores = vendedores.length;

  return (
    <div className="panel-root">
      <div className="panel-header">
        <div className="panel-header-meta">EQUIPE</div>
        <h1 className="panel-title">Colaboradores</h1>
      </div>

      {totalVendedores === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">◉</div>
          <div className="empty-state-title">Nenhum colaborador cadastrado</div>
          <div className="empty-state-sub">Adicione vendedores na aba "Time de Vendas" para vê-los aqui.</div>
        </div>
      ) : (
        <>
          <div className="colab-count-bar">
            <span>{totalVendedores} COLABORADOR{totalVendedores !== 1 ? 'ES' : ''} NA EQUIPE</span>
          </div>

          <div className="colab-grid">
            {vendedores.map(v => {
              const profile = getProfile(v.id);
              const nivel = profile.nivel ?? 'pleno';
              const tipo = profile.tipo ?? 'sdr';
              const clientes = profile.clientes ?? [];
              const m = calcMetricas(v.id);

              return (
                <div key={v.id} className="colab-card">
                  <div className="colab-card-header">
                    <div className="colab-avatar" style={{ background: 'var(--bg-4)' }}>
                      {v.nome.charAt(0).toUpperCase()}
                    </div>
                    <div className="colab-card-info">
                      <div className="colab-nome">{v.nome}</div>
                      <div className="colab-badges">
                        <span className="colab-nivel-badge"
                          style={{ color: NIVEL_COLOR[nivel], background: NIVEL_BG[nivel] }}>
                          {tipo === 'closer' ? `CLOSER ${nivel.toUpperCase()}` : NIVEL_LABEL[nivel]}
                        </span>
                      </div>
                    </div>
                    <button className="icon-btn colab-edit-btn" onClick={() => openEdit(v.id)} title="Editar perfil">✎</button>
                  </div>

                  <div className="colab-clientes-section">
                    <span className="colab-clientes-count">
                      <strong>{clientes.length}</strong> cliente{clientes.length !== 1 ? 's' : ''} sob responsabilidade
                    </span>
                    {clientes.length > 0 && (
                      <div className="colab-clientes-list">
                        {clientes.map((c, i) => <span key={i} className="colab-cliente-tag">{c}</span>)}
                      </div>
                    )}
                  </div>

                  <div className="colab-divider" />

                  <div className="colab-metrics">
                    <div className="colab-metric">
                      <div className="colab-metric-val">{m.qualificados}</div>
                      <div className="colab-metric-label">QUALIFICADOS</div>
                    </div>
                    <div className="colab-metric">
                      <div className="colab-metric-val">{m.agendados}</div>
                      <div className="colab-metric-label">AGENDADOS</div>
                    </div>
                    <div className="colab-metric">
                      <div className="colab-metric-val">{m.realizados}</div>
                      <div className="colab-metric-label">REALIZADOS</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Modal de edição de perfil */}
      {editingId && (() => {
        const v = vendedores.find(x => x.id === editingId)!;
        return (
          <div className="modal-overlay" onClick={() => setEditingId(null)}>
            <div className="modal-box" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-title">Perfil — {v.nome}</div>
                <button className="modal-close" onClick={() => setEditingId(null)}>✕</button>
              </div>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                <div>
                  <div className="field-label">Tipo</div>
                  <div className="seg-group">
                    {(['sdr', 'closer'] as ColaboradorTipo[]).map(t => (
                      <button key={t} className={`seg-btn${editForm.tipo === t ? ' active' : ''}`}
                        onClick={() => setEditForm(f => ({ ...f, tipo: t }))}>
                        {TIPO_LABEL[t]}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="field-label">Nível</div>
                  <div className="seg-group">
                    {(['junior', 'pleno', 'senior'] as ColaboradorNivel[]).map(n => (
                      <button key={n} className={`seg-btn${editForm.nivel === n ? ' active' : ''}`}
                        onClick={() => setEditForm(f => ({ ...f, nivel: n }))}>
                        {n.charAt(0).toUpperCase() + n.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="field-label">Clientes sob responsabilidade</div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <input className="field-input" style={{ flex: 1 }}
                      placeholder="Nome do cliente..."
                      value={editForm.clienteInput}
                      onChange={e => setEditForm(f => ({ ...f, clienteInput: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && addCliente()} />
                    <button className="btn-primary" style={{ padding: '0 14px' }} onClick={addCliente}>+</button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {editForm.clientes?.map((c, i) => (
                      <span key={i} className="colab-cliente-tag" style={{ cursor: 'pointer' }}
                        onClick={() => removeCliente(i)}>
                        {c} ✕
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn-ghost" onClick={() => setEditingId(null)}>Cancelar</button>
                <button className="btn-primary" onClick={() => saveEdit(editingId)}>Salvar</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
