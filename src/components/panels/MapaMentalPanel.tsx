import { useState, useRef, useCallback, useEffect } from 'react';
import type { MindMapNode, MindMapEdge } from '../../types';

/* ── localStorage ─────────────────────────────────────────── */
const LS_NODES = 'mapa_nodes_v1';
const LS_EDGES = 'mapa_edges_v1';
function loadNodes(): MindMapNode[] { try { return JSON.parse(localStorage.getItem(LS_NODES) || '[]'); } catch { return []; } }
function loadEdges(): MindMapEdge[] { try { return JSON.parse(localStorage.getItem(LS_EDGES) || '[]'); } catch { return []; } }
function uid() { return Math.random().toString(36).slice(2, 10); }

const NODE_COLORS = ['var(--silver-1)', 'var(--blue)', 'var(--green)', 'var(--amber)', 'var(--red)'];
const NODE_W = 140;
const NODE_H = 48;

export default function MapaMentalPanel() {
  const [nodes, setNodes] = useState<MindMapNode[]>(loadNodes);
  const [edges, setEdges] = useState<MindMapEdge[]>(loadEdges);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [dragging, setDragging] = useState<{ id: string; ox: number; oy: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  function persist(n: MindMapNode[], e: MindMapEdge[]) {
    setNodes(n); setEdges(e);
    localStorage.setItem(LS_NODES, JSON.stringify(n));
    localStorage.setItem(LS_EDGES, JSON.stringify(e));
  }

  function addNode() {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(20, Math.min(rect.width - NODE_W - 20, 80 + Math.random() * (rect.width - 300)));
    const y = Math.max(20, Math.min(rect.height - NODE_H - 20, 80 + Math.random() * (rect.height - 200)));
    const n: MindMapNode = { id: uid(), x, y, texto: 'Novo nó', cor: NODE_COLORS[nodes.length % NODE_COLORS.length] };
    persist([...nodes, n], edges);
  }

  function deleteSelected() {
    if (!selectedId) return;
    persist(
      nodes.filter(n => n.id !== selectedId),
      edges.filter(e => e.from !== selectedId && e.to !== selectedId),
    );
    setSelectedId(null);
    setConnectingFrom(null);
  }

  function clearAll() {
    if (!confirm('Apagar todo o mapa?')) return;
    persist([], []);
    setSelectedId(null); setConnectingFrom(null);
  }

  function startEdit(n: MindMapNode) {
    setEditingId(n.id); setEditText(n.texto);
  }

  function commitEdit() {
    if (!editingId) return;
    const next = nodes.map(n => n.id === editingId ? { ...n, texto: editText.trim() || n.texto } : n);
    persist(next, edges); setEditingId(null);
  }

  function changeColor(id: string, cor: string) {
    const next = nodes.map(n => n.id === id ? { ...n, cor } : n);
    persist(next, edges);
  }

  function handleNodeClick(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (connectingFrom) {
      if (connectingFrom !== id) {
        const exists = edges.some(ed => (ed.from === connectingFrom && ed.to === id) || (ed.from === id && ed.to === connectingFrom));
        if (!exists) {
          persist(nodes, [...edges, { id: uid(), from: connectingFrom, to: id }]);
        }
      }
      setConnectingFrom(null);
    } else {
      setSelectedId(id);
    }
  }

  const handleMouseDown = useCallback((id: string, e: React.MouseEvent) => {
    e.preventDefault();
    const node = nodes.find(n => n.id === id)!;
    setDragging({ id, ox: e.clientX - node.x, oy: e.clientY - node.y });
    setSelectedId(id);
  }, [nodes]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width - NODE_W, e.clientX - dragging.ox));
    const y = Math.max(0, Math.min(rect.height - NODE_H, e.clientY - dragging.oy));
    setNodes(prev => prev.map(n => n.id === dragging.id ? { ...n, x, y } : n));
  }, [dragging]);

  const handleMouseUp = useCallback(() => {
    if (dragging) {
      setNodes(prev => { localStorage.setItem(LS_NODES, JSON.stringify(prev)); return prev; });
      setDragging(null);
    }
  }, [dragging]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  function removeEdge(id: string) {
    persist(nodes, edges.filter(e => e.id !== id));
  }

  return (
    <div className="panel-root" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div className="panel-header">
        <div className="panel-header-meta">ESTRATÉGIA</div>
        <h1 className="panel-title">Mapa Mental</h1>
        <div className="panel-header-actions" style={{ display: 'flex', gap: 8 }}>
          <button className="btn-primary" onClick={addNode}>+ Novo nó</button>
          {selectedId && (
            <>
              <button className="btn-ghost" onClick={() => setConnectingFrom(connectingFrom === selectedId ? null : selectedId)}
                style={{ color: connectingFrom === selectedId ? 'var(--amber)' : '' }}>
                {connectingFrom === selectedId ? '⊗ Cancelar conexão' : '⊕ Conectar'}
              </button>
              <button className="btn-ghost" onClick={deleteSelected} style={{ color: 'var(--red)' }}>✕ Apagar</button>
            </>
          )}
          {nodes.length > 0 && <button className="btn-ghost" onClick={clearAll} style={{ color: 'var(--txt-3)' }}>Limpar tudo</button>}
        </div>
      </div>

      {connectingFrom && (
        <div className="mapa-connecting-hint">
          Clique em outro nó para criar a conexão, ou clique em "Cancelar"
        </div>
      )}

      {nodes.length === 0 && (
        <div className="empty-state" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 2 }}>
          <div className="empty-state-icon">🗺</div>
          <div className="empty-state-title">Mapa vazio</div>
          <div className="empty-state-sub">Clique em "+ Novo nó" para começar a construir seu fluxo de vendas.</div>
        </div>
      )}

      {/* Canvas */}
      <div ref={canvasRef}
        className="mapa-canvas"
        onClick={() => { setSelectedId(null); setConnectingFrom(null); }}
        style={{ flex: 1, position: 'relative', overflow: 'hidden', cursor: connectingFrom ? 'crosshair' : 'default' }}>

        {/* SVG para conexões */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          {edges.map(e => {
            const from = nodes.find(n => n.id === e.from);
            const to = nodes.find(n => n.id === e.to);
            if (!from || !to) return null;
            const x1 = from.x + NODE_W / 2, y1 = from.y + NODE_H / 2;
            const x2 = to.x + NODE_W / 2, y2 = to.y + NODE_H / 2;
            return (
              <g key={e.id} style={{ pointerEvents: 'all', cursor: 'pointer' }} onClick={() => removeEdge(e.id)}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--border-strong)" strokeWidth={2} />
                <circle cx={(x1 + x2) / 2} cy={(y1 + y2) / 2} r={6} fill="var(--bg-3)" stroke="var(--border-strong)" />
                <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 + 4} textAnchor="middle" fill="var(--txt-3)" fontSize={9}>✕</text>
              </g>
            );
          })}
        </svg>

        {/* Nós */}
        {nodes.map(n => (
          <div key={n.id}
            className={`mapa-node${selectedId === n.id ? ' selected' : ''}${connectingFrom === n.id ? ' connecting' : ''}`}
            style={{ left: n.x, top: n.y, borderColor: n.cor ?? 'var(--border-strong)' }}
            onClick={e => handleNodeClick(n.id, e)}
            onMouseDown={e => handleMouseDown(n.id, e)}>

            {editingId === n.id ? (
              <input autoFocus className="mapa-node-input"
                value={editText}
                onChange={e => setEditText(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingId(null); }}
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <span className="mapa-node-text" onDoubleClick={() => startEdit(n)}>{n.texto}</span>
            )}

            {selectedId === n.id && !editingId && (
              <div className="mapa-color-bar" onClick={e => e.stopPropagation()}>
                {NODE_COLORS.map(c => (
                  <div key={c} className="mapa-color-dot" style={{ background: c, outline: n.cor === c ? '2px solid white' : 'none' }}
                    onClick={() => changeColor(n.id, c)} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {nodes.length > 0 && (
        <div className="mapa-footer">
          {nodes.length} nós · {edges.length} conexões · Dique duplo para renomear · Clique na conexão para remover
        </div>
      )}
    </div>
  );
}
