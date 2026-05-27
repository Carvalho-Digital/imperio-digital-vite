import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppContext } from '../../context/AppContext';
import { useModal } from '../../context/ModalContext';
import {
  listProcessos, createProcesso, updateProcesso, deleteProcesso,
  uploadProcessoPdf, getProcessoPdfSignedUrl, deleteProcessoPdf,
} from '../../lib/processos';
import {
  PROCESSO_STATUS_META,
  type Processo, type ProcessoStatus, type ProcessoSecao, type SecaoChecklistItem,
} from '../../types';
import { uuid } from '../../lib/uuid';
import {
  PlusIcon, EditIcon, TrashIcon, CloseIcon, CheckIcon,
} from '../icons/Icons';

/* ════════════════════════════════════════════════════════════ */

export default function ProcessosPanel() {
  const { workspaceId } = useAppContext();
  const { showConfirm } = useModal();

  const [processos, setProcessos] = useState<Processo[]>([]);
  const [activeId, setActiveId]   = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [showNovo, setShowNovo]   = useState(false);
  const [showRename, setShowRename] = useState<Processo | null>(null);

  const reload = async (preferId?: string) => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const list = await listProcessos(workspaceId);
      setProcessos(list);
      if (preferId) setActiveId(preferId);
      else if (!activeId && list.length > 0) setActiveId(list[0].id);
      else if (activeId && !list.find(p => p.id === activeId)) {
        setActiveId(list[0]?.id ?? null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [workspaceId]);

  const ativo = useMemo(
    () => processos.find(p => p.id === activeId) ?? null,
    [processos, activeId]
  );

  /* ── Operações de processo ─────────────────────────────────── */
  const criar = async (titulo: string) => {
    if (!workspaceId || !titulo.trim()) return;
    const novo = await createProcesso(workspaceId, {
      titulo: titulo.trim(),
      status: 'rascunho',
      ordem: processos.length,
    });
    await reload(novo.id);
  };

  const renomear = async (id: string, titulo: string) => {
    if (!titulo.trim()) return;
    await updateProcesso(id, { titulo: titulo.trim() });
    await reload();
  };

  const remover = async (proc: Processo) => {
    const ok = await showConfirm({
      title: 'Apagar processo?',
      message: `<strong>${proc.titulo}</strong> e todas as suas seções serão removidos. Esta ação não pode ser desfeita.`,
      kind: 'danger', okText: 'Apagar', cancelText: 'Cancelar',
    });
    if (!ok) return;
    if (proc.pdfPath) {
      try { await deleteProcessoPdf(proc.pdfPath); } catch { /* ignora — força delete do registro */ }
    }
    await deleteProcesso(proc.id);
    await reload();
  };

  const mudarStatus = async (id: string, status: ProcessoStatus) => {
    await updateProcesso(id, { status });
    await reload();
  };

  /* ── PDF upload / link ─────────────────────────────────────── */
  const subirPdf = async (proc: Processo, file: File) => {
    if (!workspaceId) return;
    try {
      // se já tinha pdf, apaga o antigo pra não acumular
      if (proc.pdfPath) {
        try { await deleteProcessoPdf(proc.pdfPath); } catch { /* noop */ }
      }
      const path = await uploadProcessoPdf(workspaceId, proc.id, file);
      await updateProcesso(proc.id, { pdfPath: path, pdfLink: null });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const removerPdf = async (proc: Processo) => {
    if (proc.pdfPath) {
      try { await deleteProcessoPdf(proc.pdfPath); } catch { /* noop */ }
    }
    await updateProcesso(proc.id, { pdfPath: null });
    await reload();
  };

  const salvarLink = async (proc: Processo, link: string) => {
    await updateProcesso(proc.id, { pdfLink: link.trim() || null });
    await reload();
  };

  /* ── Seções ────────────────────────────────────────────────── */
  const atualizarEstrutura = async (proc: Processo, estrutura: ProcessoSecao[]) => {
    await updateProcesso(proc.id, { estrutura });
    setProcessos(prev => prev.map(p => p.id === proc.id ? { ...p, estrutura } : p));
  };

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--txt-3)', letterSpacing: 1.2, fontWeight: 700, marginBottom: 4 }}>
            DOCUMENTAÇÃO
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--txt-0)', letterSpacing: -0.3, fontFamily: 'var(--font-display)' }}>
            Processos
          </h1>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowNovo(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <PlusIcon size={13} /> Novo Processo
        </button>
      </div>

      {/* Erro / Loading */}
      {error && (
        <div style={{
          padding: 12, borderRadius: 8, marginBottom: 12,
          background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)',
          color: '#f87171', fontSize: 12.5,
        }}>⚠ {error}</div>
      )}

      {loading && (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--txt-3)' }}>Carregando…</div>
      )}

      {!loading && processos.length === 0 && (
        <EmptyState onCreate={() => setShowNovo(true)} />
      )}

      {/* Sub-abas + conteúdo */}
      {!loading && processos.length > 0 && (
        <>
          <div style={{
            display: 'flex', gap: 4, marginBottom: 18, paddingBottom: 12,
            borderBottom: '1px solid var(--border)', overflowX: 'auto',
          }}>
            {processos.map(p => {
              const isActive = p.id === activeId;
              return (
                <button
                  key={p.id}
                  onClick={() => setActiveId(p.id)}
                  style={{
                    padding: '10px 16px', borderRadius: '8px 8px 0 0',
                    border: 'none', borderBottom: isActive ? '2px solid var(--silver-1)' : '2px solid transparent',
                    background: isActive ? 'var(--bg-2)' : 'transparent',
                    color: isActive ? 'var(--txt-0)' : 'var(--txt-2)',
                    cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
                    fontWeight: isActive ? 700 : 500,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {p.titulo}
                </button>
              );
            })}
          </div>

          {ativo && (
            <ProcessoView
              proc={ativo}
              onRename={() => setShowRename(ativo)}
              onDelete={() => remover(ativo)}
              onChangeStatus={s => mudarStatus(ativo.id, s)}
              onUploadPdf={f => subirPdf(ativo, f)}
              onRemovePdf={() => removerPdf(ativo)}
              onSaveLink={l => salvarLink(ativo, l)}
              onUpdateEstrutura={e => atualizarEstrutura(ativo, e)}
            />
          )}
        </>
      )}

      {/* Modal Novo Processo */}
      {showNovo && (
        <NomeModal
          title="Novo Processo"
          placeholder="Ex: Onboarding de Cliente, Playbook do SDR"
          onClose={() => setShowNovo(false)}
          onSave={async (titulo) => { await criar(titulo); setShowNovo(false); }}
        />
      )}

      {/* Modal Renomear */}
      {showRename && (
        <NomeModal
          title="Renomear processo"
          initial={showRename.titulo}
          placeholder="Nome do processo"
          onClose={() => setShowRename(null)}
          onSave={async (titulo) => {
            await renomear(showRename.id, titulo);
            setShowRename(null);
          }}
        />
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════ */
/* Empty state */

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div style={{
      padding: 60, textAlign: 'center', borderRadius: 14,
      background: 'var(--bg-1)', border: '1px dashed var(--border)',
    }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>📄</div>
      <div style={{ fontSize: 16, color: 'var(--txt-0)', fontWeight: 700, marginBottom: 6 }}>
        Nenhum processo cadastrado
      </div>
      <div style={{ fontSize: 13, color: 'var(--txt-2)', marginBottom: 20, maxWidth: 460, margin: '0 auto 20px' }}>
        Crie boards de documentação (Onboarding de Cliente, Playbook do SDR, ebooks, etc.) com
        upload de PDF ou link externo e seções editáveis.
      </div>
      <button
        className="btn btn-primary"
        onClick={onCreate}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
      >
        <PlusIcon size={13} /> Criar primeiro processo
      </button>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════ */
/* Tela de um processo (status, PDF, seções) */

function ProcessoView({
  proc, onRename, onDelete, onChangeStatus, onUploadPdf, onRemovePdf, onSaveLink, onUpdateEstrutura,
}: {
  proc: Processo;
  onRename: () => void;
  onDelete: () => void;
  onChangeStatus: (s: ProcessoStatus) => void;
  onUploadPdf: (f: File) => Promise<void>;
  onRemovePdf: () => Promise<void>;
  onSaveLink: (link: string) => Promise<void>;
  onUpdateEstrutura: (e: ProcessoSecao[]) => Promise<void>;
}) {
  const [linkInput, setLinkInput] = useState(proc.pdfLink ?? '');
  const [linkEditing, setLinkEditing] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setLinkInput(proc.pdfLink ?? '');
    setLinkEditing(false);
  }, [proc.id, proc.pdfLink]);

  useEffect(() => {
    let active = true;
    if (proc.pdfPath) {
      getProcessoPdfSignedUrl(proc.pdfPath, 60 * 30)
        .then(url => { if (active) setSignedUrl(url); })
        .catch(() => { if (active) setSignedUrl(null); });
    } else {
      setSignedUrl(null);
    }
    return () => { active = false; };
  }, [proc.pdfPath, proc.id]);

  return (
    <div>
      {/* Linha de cabeçalho do processo */}
      <div style={{
        padding: 18, borderRadius: 12,
        background: 'var(--bg-1)', border: '1px solid var(--border)',
        marginBottom: 18,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--txt-0)' }}>
            {proc.titulo}
          </h2>
          <StatusBadge status={proc.status} onChange={onChangeStatus} />
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <IconBtn onClick={onRename} title="Renomear"><EditIcon size={13} /></IconBtn>
            <IconBtn onClick={onDelete} title="Apagar processo" danger><TrashIcon size={13} /></IconBtn>
          </div>
        </div>
        {proc.descricao && (
          <div style={{ fontSize: 13, color: 'var(--txt-2)', marginTop: 8, lineHeight: 1.55 }}>
            {proc.descricao}
          </div>
        )}

        {/* PDF: upload OU link externo */}
        <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {!proc.pdfPath && (
            <label style={{
              padding: '8px 14px', borderRadius: 8, background: 'var(--bg-2)',
              border: '1px solid var(--border)', color: 'var(--txt-1)',
              fontSize: 12.5, fontWeight: 600, cursor: uploading ? 'wait' : 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              opacity: uploading ? 0.6 : 1,
            }}>
              {uploading ? '⏳ Enviando…' : '📎 Subir PDF Oficial'}
              <input type="file" accept="application/pdf" hidden disabled={uploading}
                onChange={async e => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setUploading(true);
                  try { await onUploadPdf(f); } finally { setUploading(false); e.target.value = ''; }
                }}
              />
            </label>
          )}
          {proc.pdfPath && signedUrl && (
            <a href={signedUrl} target="_blank" rel="noreferrer"
              style={{
                padding: '8px 14px', borderRadius: 8,
                background: 'rgba(96,165,250,.12)', border: '1px solid rgba(96,165,250,.3)',
                color: '#60a5fa', fontSize: 12.5, fontWeight: 600,
                textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >📄 Ver PDF Oficial</a>
          )}
          {proc.pdfPath && (
            <button onClick={onRemovePdf} title="Remover PDF"
              style={{
                padding: '8px 10px', borderRadius: 8,
                background: 'var(--bg-2)', border: '1px solid var(--border)',
                color: '#f87171', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5,
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}
            ><TrashIcon size={12} /></button>
          )}

          {/* Link externo */}
          {!linkEditing && proc.pdfLink && (
            <>
              <a href={proc.pdfLink} target="_blank" rel="noreferrer"
                style={{
                  padding: '8px 14px', borderRadius: 8,
                  background: 'rgba(52,211,153,.10)', border: '1px solid rgba(52,211,153,.3)',
                  color: '#34d399', fontSize: 12.5, fontWeight: 600,
                  textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6,
                  maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >🔗 {proc.pdfLink}</a>
              <button onClick={() => setLinkEditing(true)}
                style={{
                  padding: '8px 10px', borderRadius: 8,
                  background: 'var(--bg-2)', border: '1px solid var(--border)',
                  color: 'var(--txt-1)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5,
                }}><EditIcon size={12} /></button>
            </>
          )}
          {!linkEditing && !proc.pdfLink && (
            <button onClick={() => setLinkEditing(true)}
              style={{
                padding: '8px 14px', borderRadius: 8, background: 'transparent',
                border: '1px dashed var(--border)', color: 'var(--txt-2)',
                cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5,
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>🔗 Adicionar link externo</button>
          )}
          {linkEditing && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1, minWidth: 280 }}>
              <input
                autoFocus
                value={linkInput}
                onChange={e => setLinkInput(e.target.value)}
                placeholder="https://drive.google.com/... ou Notion/Confluence"
                className="form-input"
                style={{ flex: 1, fontSize: 12.5 }}
                onKeyDown={e => {
                  if (e.key === 'Enter') { onSaveLink(linkInput); setLinkEditing(false); }
                  if (e.key === 'Escape') { setLinkInput(proc.pdfLink ?? ''); setLinkEditing(false); }
                }}
              />
              <IconBtn onClick={() => { onSaveLink(linkInput); setLinkEditing(false); }} title="Salvar"><CheckIcon size={13} /></IconBtn>
              <IconBtn onClick={() => { setLinkInput(proc.pdfLink ?? ''); setLinkEditing(false); }} title="Cancelar"><CloseIcon size={13} /></IconBtn>
            </div>
          )}
        </div>
      </div>

      {/* Seções editáveis */}
      <SecoesEditor
        secoes={proc.estrutura}
        onChange={onUpdateEstrutura}
      />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════ */
/* Editor de seções (texto livre + checklist) */

function SecoesEditor({
  secoes, onChange,
}: { secoes: ProcessoSecao[]; onChange: (s: ProcessoSecao[]) => Promise<void> }) {

  const addSecao = (tipo: 'texto' | 'checklist') => {
    const nova: ProcessoSecao = tipo === 'texto'
      ? { id: uuid(), tipo: 'texto', titulo: 'Nova seção', conteudo: '', responsavel: null }
      : { id: uuid(), tipo: 'checklist', titulo: 'Novo checklist', itens: [] };
    onChange([...secoes, nova]);
  };

  const updateSec = (id: string, patch: Partial<ProcessoSecao>) => {
    onChange(secoes.map(s => s.id === id ? { ...s, ...patch } as ProcessoSecao : s));
  };

  const removeSec = (id: string) => {
    onChange(secoes.filter(s => s.id !== id));
  };

  const moveSec = (id: string, dir: -1 | 1) => {
    const idx = secoes.findIndex(s => s.id === id);
    if (idx < 0) return;
    const target = idx + dir;
    if (target < 0 || target >= secoes.length) return;
    const next = [...secoes];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {secoes.map((sec, i) => (
        <SecaoCard
          key={sec.id}
          secao={sec}
          first={i === 0}
          last={i === secoes.length - 1}
          onUpdate={patch => updateSec(sec.id, patch)}
          onRemove={() => removeSec(sec.id)}
          onMove={dir => moveSec(sec.id, dir)}
        />
      ))}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', padding: '10px 0' }}>
        <button onClick={() => addSecao('texto')}
          style={addBtn}>
          <PlusIcon size={12} /> Seção de texto
        </button>
        <button onClick={() => addSecao('checklist')}
          style={addBtn}>
          <PlusIcon size={12} /> Seção de checklist
        </button>
      </div>
    </div>
  );
}

const addBtn: React.CSSProperties = {
  padding: '8px 14px', borderRadius: 8, background: 'var(--bg-2)',
  border: '1px dashed var(--border)', color: 'var(--txt-2)',
  cursor: 'pointer', fontFamily: 'inherit', fontSize: 12,
  display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600,
};

function SecaoCard({
  secao, first, last, onUpdate, onRemove, onMove,
}: {
  secao: ProcessoSecao;
  first: boolean; last: boolean;
  onUpdate: (p: Partial<ProcessoSecao>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  return (
    <div style={{
      padding: 16, borderRadius: 12,
      background: 'var(--bg-1)', border: '1px solid var(--border)',
    }}>
      {/* Header da seção */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
        <span style={{
          fontSize: 10, padding: '2px 7px', borderRadius: 4,
          background: 'rgba(255,255,255,.06)', color: 'var(--txt-3)',
          fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase',
        }}>{secao.tipo === 'checklist' ? '☑ Checklist' : '¶ Texto'}</span>
        <input
          value={secao.titulo}
          onChange={e => onUpdate({ titulo: e.target.value })}
          className="form-input"
          style={{ flex: 1, fontSize: 14, fontWeight: 600, padding: '6px 10px' }}
        />
        <div style={{ display: 'flex', gap: 4 }}>
          <IconBtn onClick={() => onMove(-1)} disabled={first} title="Subir">↑</IconBtn>
          <IconBtn onClick={() => onMove(1)} disabled={last} title="Descer">↓</IconBtn>
          <IconBtn onClick={onRemove} danger title="Remover seção"><TrashIcon size={12} /></IconBtn>
        </div>
      </div>

      {/* Corpo conforme tipo */}
      {secao.tipo === 'texto' && (
        <>
          <textarea
            value={secao.conteudo ?? ''}
            onChange={e => onUpdate({ conteudo: e.target.value })}
            className="form-input"
            placeholder="Texto da seção (ex: objetivo, instruções, contexto)…"
            rows={4}
            style={{ width: '100%', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.5, resize: 'vertical' }}
          />
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--txt-3)' }}>
            <span>Responsável: </span>
            <input
              value={secao.responsavel ?? ''}
              onChange={e => onUpdate({ responsavel: e.target.value || null })}
              placeholder="ex: SDR atribuído ao cliente"
              style={{
                background: 'transparent', border: 'none', borderBottom: '1px dotted var(--border)',
                color: 'var(--txt-1)', fontSize: 11, fontFamily: 'inherit',
                outline: 'none', padding: '2px 4px', minWidth: 240,
              }}
            />
          </div>
        </>
      )}

      {secao.tipo === 'checklist' && (
        <ChecklistEditor
          itens={secao.itens ?? []}
          onChange={itens => onUpdate({ itens })}
        />
      )}
    </div>
  );
}

function ChecklistEditor({
  itens, onChange,
}: { itens: SecaoChecklistItem[]; onChange: (i: SecaoChecklistItem[]) => void }) {
  const [novoTexto, setNovoTexto] = useState('');

  const add = () => {
    if (!novoTexto.trim()) return;
    onChange([...itens, { id: uuid(), texto: novoTexto.trim(), concluido: false }]);
    setNovoTexto('');
  };

  const toggle = (id: string) => {
    onChange(itens.map(i => i.id === id ? { ...i, concluido: !i.concluido } : i));
  };

  const editar = (id: string, texto: string) => {
    onChange(itens.map(i => i.id === id ? { ...i, texto } : i));
  };

  const remover = (id: string) => {
    onChange(itens.filter(i => i.id !== id));
  };

  return (
    <div>
      {itens.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--txt-3)', fontStyle: 'italic', padding: '8px 0' }}>
          Nenhum item ainda.
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {itens.map(it => (
          <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={it.concluido} onChange={() => toggle(it.id)}
              style={{ width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }} />
            <input
              value={it.texto}
              onChange={e => editar(it.id, e.target.value)}
              className="form-input"
              style={{
                flex: 1, fontSize: 13, padding: '6px 10px',
                textDecoration: it.concluido ? 'line-through' : 'none',
                color: it.concluido ? 'var(--txt-3)' : 'var(--txt-1)',
              }}
            />
            <IconBtn onClick={() => remover(it.id)} title="Remover" danger><TrashIcon size={11} /></IconBtn>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <input
          value={novoTexto}
          onChange={e => setNovoTexto(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') add(); }}
          placeholder="+ Novo item (Enter pra adicionar)"
          className="form-input"
          style={{ flex: 1, fontSize: 12.5, padding: '6px 10px' }}
        />
        <button onClick={add}
          style={{
            padding: '6px 12px', borderRadius: 8, background: 'var(--bg-2)',
            border: '1px solid var(--border)', color: 'var(--txt-1)',
            cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
          }}><PlusIcon size={11} /></button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════ */
/* Auxiliares de UI */

function StatusBadge({ status, onChange }: { status: ProcessoStatus; onChange: (s: ProcessoStatus) => void }) {
  const [open, setOpen] = useState(false);
  const meta = PROCESSO_STATUS_META[status];
  const opts: ProcessoStatus[] = ['rascunho', 'aguardando', 'publicado', 'revisao'];
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{
          padding: '4px 10px', borderRadius: 6,
          background: `${meta.color}22`, border: `1px solid ${meta.color}55`,
          color: meta.color, fontSize: 11, fontWeight: 700,
          letterSpacing: 0.5, textTransform: 'uppercase',
          cursor: 'pointer', fontFamily: 'inherit',
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>● {meta.label} ▾</button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 10,
          background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8,
          padding: 4, minWidth: 160,
          boxShadow: '0 8px 24px rgba(0,0,0,.4)',
        }} onMouseLeave={() => setOpen(false)}>
          {opts.map(o => {
            const m = PROCESSO_STATUS_META[o];
            return (
              <button key={o} onClick={() => { onChange(o); setOpen(false); }}
                style={{
                  display: 'block', width: '100%', padding: '6px 10px', borderRadius: 4,
                  background: status === o ? 'rgba(255,255,255,.06)' : 'transparent',
                  border: 'none', color: m.color, fontSize: 11.5, fontWeight: 600,
                  textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                }}>● {m.label}</button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function IconBtn({
  children, onClick, title, disabled, danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button onClick={onClick} title={title} disabled={disabled}
      style={{
        width: 28, height: 28, borderRadius: 6,
        background: 'var(--bg-2)', border: '1px solid var(--border)',
        color: danger ? '#f87171' : 'var(--txt-1)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'grid', placeItems: 'center', fontFamily: 'inherit',
        opacity: disabled ? 0.4 : 1, fontSize: 12,
      }}>{children}</button>
  );
}

/* ════════════════════════════════════════════════════════════ */
/* Modal pra criar / renomear processo */

function NomeModal({
  title, initial, placeholder, onClose, onSave,
}: {
  title: string;
  initial?: string;
  placeholder: string;
  onClose: () => void;
  onSave: (titulo: string) => Promise<void>;
}) {
  const [val, setVal] = useState(initial ?? '');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!val.trim() || saving) return;
    setSaving(true);
    try { await onSave(val); } finally { setSaving(false); }
  };

  return createPortal(
    <div className="modal-backdrop show" onClick={onClose}>
      <div className="modal modal-sm" onClick={e => e.stopPropagation()}
        style={{ maxWidth: 480, padding: 28 }}>
        <div className="modal-head">
          <div className="modal-title">{title}</div>
          <button className="modal-close" onClick={onClose}><CloseIcon size={14} /></button>
        </div>
        <div className="modal-body" style={{ paddingTop: 14 }}>
          <input
            autoFocus
            value={val}
            onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); }}
            placeholder={placeholder}
            className="form-input"
            style={{ width: '100%', fontSize: 14, padding: '10px 12px' }}
          />
        </div>
        <div className="modal-actions" style={{ gap: 10, marginTop: 18, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={submit} disabled={!val.trim() || saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
