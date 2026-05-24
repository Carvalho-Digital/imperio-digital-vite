import { useState } from 'react';
import type { ScriptModule, Script } from '../../types';

/* ── localStorage ─────────────────────────────────────────── */
const LS_KEY = 'scripts_v1';
function load(): ScriptModule[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
}
function save(m: ScriptModule[]) { localStorage.setItem(LS_KEY, JSON.stringify(m)); }
function uid() { return Math.random().toString(36).slice(2, 10); }
function now() { return new Date().toISOString(); }

type ModalMode = 'none' | 'new-module' | 'new-script' | 'edit-script';

export default function ScriptsPanel() {
  const [modules, setModules] = useState<ScriptModule[]>(load);
  const [activeModId, setActiveModId] = useState<string | null>(() => load()[0]?.id ?? null);
  const [modal, setModal] = useState<ModalMode>('none');
  const [moduleName, setModuleName] = useState('');
  const [scriptForm, setScriptForm] = useState<{ titulo: string; conteudo: string; id: string }>({ titulo: '', conteudo: '', id: '' });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const activeMod = modules.find(m => m.id === activeModId) ?? null;

  function persist(next: ScriptModule[]) { setModules(next); save(next); }

  function addModule() {
    const name = moduleName.trim();
    if (!name) return;
    const m: ScriptModule = { id: uid(), nome: name.toUpperCase(), scripts: [] };
    const next = [...modules, m];
    persist(next);
    setActiveModId(m.id);
    setModuleName('');
    setModal('none');
  }

  function deleteModule(id: string) {
    if (!confirm('Excluir módulo e todos os scripts?')) return;
    const next = modules.filter(m => m.id !== id);
    persist(next);
    if (activeModId === id) setActiveModId(next[0]?.id ?? null);
  }

  function openNewScript() {
    setScriptForm({ titulo: '', conteudo: '', id: '' });
    setModal('new-script');
  }

  function openEditScript(s: Script) {
    setScriptForm({ titulo: s.titulo, conteudo: s.conteudo, id: s.id });
    setModal('edit-script');
  }

  function saveScript() {
    if (!activeMod || !scriptForm.titulo.trim()) return;
    const next = modules.map(m => {
      if (m.id !== activeMod.id) return m;
      if (modal === 'new-script') {
        const s: Script = { id: uid(), titulo: scriptForm.titulo.trim(), conteudo: scriptForm.conteudo, criadoEm: now() };
        return { ...m, scripts: [...m.scripts, s] };
      } else {
        return { ...m, scripts: m.scripts.map(s => s.id === scriptForm.id ? { ...s, titulo: scriptForm.titulo.trim(), conteudo: scriptForm.conteudo } : s) };
      }
    });
    persist(next);
    setModal('none');
  }

  function deleteScript(scriptId: string) {
    if (!activeMod) return;
    const next = modules.map(m =>
      m.id !== activeMod.id ? m : { ...m, scripts: m.scripts.filter(s => s.id !== scriptId) }
    );
    persist(next);
    if (expandedId === scriptId) setExpandedId(null);
  }

  return (
    <div className="panel-root">
      <div className="panel-header">
        <div className="panel-header-meta">INTELIGÊNCIA</div>
        <h1 className="panel-title">Biblioteca de Scripts</h1>
        <div className="panel-header-actions">
          <button className="btn-primary" onClick={openNewScript} disabled={!activeMod}>+ Novo Script</button>
        </div>
      </div>

      <div className="scripts-layout">
        {/* Sidebar de módulos */}
        <div className="scripts-modules-col">
          <div className="scripts-modules-header">
            <span>MÓDULOS</span>
            <button className="icon-btn" title="Novo módulo" onClick={() => { setModuleName(''); setModal('new-module'); }}>+</button>
          </div>
          {modules.length === 0 ? (
            <div style={{ padding: '16px 12px', color: 'var(--txt-3)', fontSize: 13 }}>
              Nenhum módulo ainda.
            </div>
          ) : (
            modules.map(m => (
              <div key={m.id}
                className={`scripts-module-item${activeModId === m.id ? ' active' : ''}`}
                onClick={() => setActiveModId(m.id)}>
                <span className="scripts-module-name">{m.nome}</span>
                <span className="scripts-module-count">{m.scripts.length}</span>
                <button className="icon-btn scripts-module-del" title="Excluir módulo"
                  onClick={e => { e.stopPropagation(); deleteModule(m.id); }}>✕</button>
              </div>
            ))
          )}
        </div>

        {/* Área de scripts */}
        <div className="scripts-content-col">
          {!activeMod ? (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-title">Nenhum módulo selecionado</div>
              <div className="empty-state-sub">Crie um módulo à esquerda para começar.</div>
              <button className="btn-primary" style={{ marginTop: 12 }} onClick={() => { setModuleName(''); setModal('new-module'); }}>
                + Criar módulo
              </button>
            </div>
          ) : activeMod.scripts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-title">Nenhum script cadastrado</div>
              <button className="btn-primary" style={{ marginTop: 12 }} onClick={openNewScript}>+ Cadastrar</button>
            </div>
          ) : (
            <div className="scripts-list">
              <div className="scripts-list-header">
                <span>{activeMod.nome} — {activeMod.scripts.length} script{activeMod.scripts.length !== 1 ? 's' : ''}</span>
              </div>
              {activeMod.scripts.map((s, i) => (
                <div key={s.id} className="script-card">
                  <div className="script-card-top" onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}>
                    <span className="script-number">SCRIPT {i + 1}</span>
                    <span className="script-titulo">{s.titulo}</span>
                    <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                      <button className="icon-btn" onClick={e => { e.stopPropagation(); openEditScript(s); }} title="Editar">✎</button>
                      <button className="icon-btn" style={{ color: 'var(--red)' }}
                        onClick={e => { e.stopPropagation(); deleteScript(s.id); }} title="Excluir">✕</button>
                      <span className="script-chevron">{expandedId === s.id ? '▲' : '▼'}</span>
                    </div>
                  </div>
                  {expandedId === s.id && (
                    <div className="script-card-body">
                      <pre className="script-conteudo">{s.conteudo || <em style={{ color: 'var(--txt-3)' }}>Sem conteúdo</em>}</pre>
                      <button className="btn-ghost script-copy-btn"
                        onClick={() => navigator.clipboard.writeText(s.conteudo)}>
                        Copiar script
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal novo módulo */}
      {modal === 'new-module' && (
        <div className="modal-overlay" onClick={() => setModal('none')}>
          <div className="modal-box" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Novo Módulo</div>
              <button className="modal-close" onClick={() => setModal('none')}>✕</button>
            </div>
            <div className="modal-body">
              <div className="field-label">Nome do módulo</div>
              <input className="field-input" autoFocus placeholder="Ex: SOCIAL SELLING"
                value={moduleName} onChange={e => setModuleName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addModule()} />
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setModal('none')}>Cancelar</button>
              <button className="btn-primary" onClick={addModule}>Criar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal novo/editar script */}
      {(modal === 'new-script' || modal === 'edit-script') && (
        <div className="modal-overlay" onClick={() => setModal('none')}>
          <div className="modal-box" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{modal === 'new-script' ? 'Novo Script' : 'Editar Script'}</div>
              <button className="modal-close" onClick={() => setModal('none')}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div className="field-label">Título</div>
                <input className="field-input" autoFocus placeholder="Ex: Abertura de chamada fria"
                  value={scriptForm.titulo} onChange={e => setScriptForm(f => ({ ...f, titulo: e.target.value }))} />
              </div>
              <div>
                <div className="field-label">Conteúdo</div>
                <textarea className="field-input" rows={10}
                  style={{ resize: 'vertical', fontFamily: 'var(--font-body)', lineHeight: 1.6 }}
                  placeholder="Escreva o script aqui..."
                  value={scriptForm.conteudo}
                  onChange={e => setScriptForm(f => ({ ...f, conteudo: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setModal('none')}>Cancelar</button>
              <button className="btn-primary" onClick={saveScript}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
