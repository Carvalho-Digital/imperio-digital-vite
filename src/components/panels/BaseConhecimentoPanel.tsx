import { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { useModal } from '../../context/ModalContext';
import {
  listKnowledge, createKnowledge, updateKnowledge, deleteKnowledge,
  totalKnowledgeChars, KNOWLEDGE_MAX_CHARS,
} from '../../lib/agentKnowledge';
import { KNOWLEDGE_CATEGORIES, type KnowledgeEntry, type KnowledgeCategory } from '../../types';
import AgenteLogo from '../AgenteLogo';

type FormState = {
  id?: string;
  title: string;
  content: string;
  category: KnowledgeCategory;
  isActive: boolean;
};

const EMPTY_FORM: FormState = { title: '', content: '', category: 'script', isActive: true };

export default function BaseConhecimentoPanel() {
  const { workspaceId } = useAppContext();
  const { showConfirm } = useModal();

  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | KnowledgeCategory>('all');
  const [editing, setEditing] = useState<FormState | null>(null);

  const reload = async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const list = await listKnowledge(workspaceId);
      setEntries(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [workspaceId]);

  const filteredEntries = useMemo(
    () => filter === 'all' ? entries : entries.filter(e => e.category === filter),
    [entries, filter]
  );

  const totalChars = totalKnowledgeChars(entries);
  const pctUsado = Math.round((totalChars / KNOWLEDGE_MAX_CHARS) * 100);

  const save = async () => {
    if (!editing || !workspaceId) return;
    if (!editing.title.trim() || !editing.content.trim()) return;
    try {
      if (editing.id) {
        await updateKnowledge(editing.id, {
          title: editing.title.trim(), content: editing.content.trim(),
          category: editing.category, isActive: editing.isActive,
        });
      } else {
        await createKnowledge(workspaceId, {
          title: editing.title.trim(), content: editing.content.trim(),
          category: editing.category, isActive: editing.isActive,
        });
      }
      setEditing(null);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const toggleActive = async (entry: KnowledgeEntry) => {
    try {
      await updateKnowledge(entry.id, { isActive: !entry.isActive });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const remove = async (entry: KnowledgeEntry) => {
    const ok = await showConfirm({
      title: 'Apagar entrada?',
      message: `<strong>${entry.title}</strong> será removida da base do agente. Esta ação não pode ser desfeita.`,
      kind: 'danger',
      okText: 'Sim, apagar', cancelText: 'Cancelar',
    });
    if (!ok) return;
    try {
      await deleteKnowledge(entry.id);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'var(--silver-grad)', color: '#0a0a0c',
            display: 'grid', placeItems: 'center',
          }}>
            <AgenteLogo size={24} color="#0a0a0c" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--txt-0)', letterSpacing: -0.3, fontFamily: 'var(--font-display)' }}>
              Base do Agente
            </h1>
            <div style={{ fontSize: 12.5, color: 'var(--txt-2)', marginTop: 4, lineHeight: 1.4 }}>
              Tudo que você adicionar aqui o Agente passa a saber. Scripts, playbook, tratativas de objeção,
              FAQ, regras internas. Quanto mais específico do seu negócio, melhor a resposta.
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEditing({ ...EMPTY_FORM })}
          style={{
            padding: '9px 14px', borderRadius: 9, border: 'none',
            background: 'var(--silver-grad)', color: '#0a0a0c',
            fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
            fontFamily: 'inherit', whiteSpace: 'nowrap',
          }}
        >+ Nova entrada</button>
      </div>

      {/* Barra de uso de tokens */}
      <div style={{
        marginBottom: 16, padding: '10px 14px',
        background: 'var(--bg-2)', border: '1px solid var(--border)',
        borderRadius: 10, fontSize: 11.5, color: 'var(--txt-2)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
      }}>
        <div>
          Uso da base: <strong style={{ color: 'var(--txt-0)' }}>{totalChars.toLocaleString('pt-BR')}</strong> / {KNOWLEDGE_MAX_CHARS.toLocaleString('pt-BR')} caracteres
          ({pctUsado}%)
        </div>
        <div style={{ width: 200, height: 6, background: 'var(--bg-3)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{
            width: `${Math.min(100, pctUsado)}%`, height: '100%',
            background: pctUsado > 90 ? '#ef4444' : pctUsado > 70 ? '#fbbf24' : 'var(--silver-grad)',
            transition: 'width .3s',
          }} />
        </div>
      </div>

      {/* Filtro de categorias */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
          Todas ({entries.length})
        </FilterChip>
        {KNOWLEDGE_CATEGORIES.map(cat => {
          const count = entries.filter(e => e.category === cat.id).length;
          if (count === 0 && filter !== cat.id) return null;
          return (
            <FilterChip key={cat.id} active={filter === cat.id} onClick={() => setFilter(cat.id)}>
              {cat.icon} {cat.label} ({count})
            </FilterChip>
          );
        })}
      </div>

      {/* Erro */}
      {error && (
        <div style={{
          padding: 12, borderRadius: 8, marginBottom: 12,
          background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)',
          color: '#f87171', fontSize: 12.5,
        }}>⚠ {error}</div>
      )}

      {/* Lista */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--txt-3)' }}>Carregando…</div>
      ) : filteredEntries.length === 0 ? (
        <EmptyState onCreate={() => setEditing({ ...EMPTY_FORM })} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredEntries.map(entry => (
            <EntryCard
              key={entry.id}
              entry={entry}
              onEdit={() => setEditing({
                id: entry.id, title: entry.title, content: entry.content,
                category: entry.category, isActive: entry.isActive,
              })}
              onToggle={() => toggleActive(entry)}
              onDelete={() => remove(entry)}
            />
          ))}
        </div>
      )}

      {/* Modal de criação/edição */}
      {editing && (
        <EditorModal
          form={editing}
          onChange={setEditing}
          onCancel={() => setEditing(null)}
          onSave={save}
        />
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────── */

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '6px 12px', borderRadius: 999,
        background: active ? 'var(--silver-grad)' : 'var(--bg-2)',
        border: active ? 'none' : '1px solid var(--border)',
        color: active ? '#0a0a0c' : 'var(--txt-2)',
        fontWeight: 600, fontSize: 11.5,
        cursor: 'pointer', fontFamily: 'inherit',
      }}
    >{children}</button>
  );
}

function EntryCard({ entry, onEdit, onToggle, onDelete }: {
  entry: KnowledgeEntry; onEdit: () => void; onToggle: () => void; onDelete: () => void;
}) {
  const cat = KNOWLEDGE_CATEGORIES.find(c => c.id === entry.category);
  return (
    <div style={{
      padding: 14, borderRadius: 11,
      background: 'var(--bg-1)', border: '1px solid var(--border)',
      opacity: entry.isActive ? 1 : 0.55,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{
              fontSize: 10.5, padding: '2px 8px', borderRadius: 4,
              background: 'var(--bg-3)', color: 'var(--txt-2)',
              fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase',
            }}>{cat?.icon} {cat?.label}</span>
            {!entry.isActive && (
              <span style={{ fontSize: 10, color: 'var(--txt-3)', fontStyle: 'italic' }}>(inativa)</span>
            )}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--txt-0)', marginBottom: 4 }}>
            {entry.title}
          </div>
          <div style={{
            fontSize: 12, color: 'var(--txt-2)', lineHeight: 1.5,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            overflow: 'hidden', whiteSpace: 'pre-wrap',
          }}>
            {entry.content}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <IconButton title={entry.isActive ? 'Desativar' : 'Ativar'} onClick={onToggle}>
            {entry.isActive ? '◉' : '◯'}
          </IconButton>
          <IconButton title="Editar" onClick={onEdit}>✎</IconButton>
          <IconButton title="Apagar" onClick={onDelete} danger>×</IconButton>
        </div>
      </div>
    </div>
  );
}

function IconButton({ children, title, onClick, danger }: {
  children: React.ReactNode; title: string; onClick: () => void; danger?: boolean;
}) {
  return (
    <button
      type="button" onClick={onClick} title={title}
      style={{
        width: 28, height: 28, borderRadius: 7,
        background: 'var(--bg-2)', border: '1px solid var(--border)',
        color: danger ? '#f87171' : 'var(--txt-1)',
        cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
        display: 'grid', placeItems: 'center',
      }}
    >{children}</button>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div style={{
      padding: 40, textAlign: 'center', borderRadius: 12,
      background: 'var(--bg-1)', border: '1px dashed var(--border)',
    }}>
      <div style={{ fontSize: 14, color: 'var(--txt-1)', marginBottom: 6, fontWeight: 600 }}>
        Nenhuma entrada ainda
      </div>
      <div style={{ fontSize: 12, color: 'var(--txt-3)', marginBottom: 14, maxWidth: 480, margin: '0 auto 14px' }}>
        Adicione o primeiro script, playbook ou tratativa de objeção pra o Agente começar a falar como
        a sua equipe fala.
      </div>
      <button
        type="button" onClick={onCreate}
        style={{
          padding: '8px 14px', borderRadius: 9, border: 'none',
          background: 'var(--silver-grad)', color: '#0a0a0c',
          fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit',
        }}
      >+ Criar primeira entrada</button>
    </div>
  );
}

function EditorModal({ form, onChange, onCancel, onSave }: {
  form: FormState; onChange: (f: FormState) => void; onCancel: () => void; onSave: () => void;
}) {
  const valid = form.title.trim().length > 0 && form.content.trim().length > 0;
  return (
    <div className="modal-backdrop show" onClick={onCancel}>
      <div className="modal modal-sm" onClick={e => e.stopPropagation()} style={{ maxWidth: 620, padding: 28 }}>
        <div className="modal-head">
          <div>
            <div className="modal-title">{form.id ? 'Editar entrada' : 'Nova entrada na base'}</div>
            <div className="modal-subtitle" style={{ marginTop: 4, fontSize: 12.5, color: 'var(--txt-2)' }}>
              O Agente vai ler isso e usar como referência.
            </div>
          </div>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>

        <div className="modal-body">
          {/* Categoria */}
          <div style={{ marginBottom: 16 }}>
            <span style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--txt-1)', marginBottom: 6, letterSpacing: 0.2, textTransform: 'uppercase' }}>Categoria</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {KNOWLEDGE_CATEGORIES.map(cat => (
                <button
                  key={cat.id} type="button"
                  onClick={() => onChange({ ...form, category: cat.id })}
                  style={{
                    padding: '7px 11px', borderRadius: 8,
                    background: form.category === cat.id ? 'var(--silver-grad)' : 'var(--bg-2)',
                    border: form.category === cat.id ? 'none' : '1px solid var(--border)',
                    color: form.category === cat.id ? '#0a0a0c' : 'var(--txt-2)',
                    fontWeight: 600, fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >{cat.icon} {cat.label}</button>
              ))}
            </div>
          </div>

          {/* Título */}
          <label style={{ display: 'block', marginBottom: 16 }}>
            <span style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--txt-1)', marginBottom: 6, letterSpacing: 0.2, textTransform: 'uppercase' }}>Título</span>
            <input
              autoFocus type="text" className="form-input" style={{ width: '100%' }}
              placeholder="Ex: Quebra de objeção 'está caro'"
              value={form.title}
              onChange={e => onChange({ ...form, title: e.target.value })}
            />
          </label>

          {/* Conteúdo */}
          <label style={{ display: 'block', marginBottom: 16 }}>
            <span style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--txt-1)', marginBottom: 6, letterSpacing: 0.2, textTransform: 'uppercase' }}>Conteúdo</span>
            <textarea
              className="form-input" rows={10}
              style={{ width: '100%', resize: 'vertical', minHeight: 180, fontFamily: 'inherit', fontSize: 13, lineHeight: 1.5 }}
              placeholder={`Escreve do jeito que voce/o time fala.\n\nExemplo:\n\nQuando o cliente diz que esta caro, primeiro isole: "alem do investimento, tem mais algum ponto que ta freando?"\n\nDepois quebra por mes: R$ 10.800 / 6 meses = R$ 1.800/mes. Compara com o ROI esperado: 3 contratos novos pagam 6 meses do servico.\n\nCase: Dr. Joao Silva, advocacia previdenciaria, fechou em 2024 e fez 8x o investimento em 4 meses.`}
              value={form.content}
              onChange={e => onChange({ ...form, content: e.target.value })}
            />
            <div style={{ fontSize: 11, color: 'var(--txt-3)', marginTop: 4 }}>
              {form.content.length.toLocaleString('pt-BR')} caracteres. Quanto mais especifico (cases reais,
              numeros, exemplos), melhor o agente responde.
            </div>
          </label>

          {/* Ativo */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12.5, color: 'var(--txt-1)' }}>
            <input
              type="checkbox" checked={form.isActive}
              onChange={e => onChange({ ...form, isActive: e.target.checked })}
              style={{ accentColor: 'var(--silver-2)' }}
            />
            Ativa — agente usa essa entrada nas respostas
          </label>
        </div>

        <div className="modal-actions" style={{
          gap: 10, marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--border)',
        }}>
          <button className="btn" onClick={onCancel}>Cancelar</button>
          <button
            className="btn btn-primary"
            disabled={!valid}
            onClick={onSave}
            style={{ opacity: valid ? 1 : 0.5, cursor: valid ? 'pointer' : 'not-allowed' }}
          >{form.id ? 'Salvar alterações' : 'Adicionar'}</button>
        </div>
      </div>
    </div>
  );
}
