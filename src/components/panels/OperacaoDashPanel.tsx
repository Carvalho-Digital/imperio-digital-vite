import { useState, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import { fmtBRL } from '../../lib/formatters';
import type { Vendedor, Tarefa, Compromisso, EstudoDia } from '../../types';

/* ── localStorage helpers ─────────────────────────────────── */
const LS_TAREFAS = 'tarefas_v1';
const LS_COMPROMISSOS = 'compromissos_v1';
const LS_ESTUDO = 'estudo_v1';

function loadJson<T>(key: string, def: T): T {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? def; } catch { return def; }
}
function saveJson(key: string, val: unknown) { localStorage.setItem(key, JSON.stringify(val)); }
function uid() { return Math.random().toString(36).slice(2, 10); }

/* ── Date helpers ─────────────────────────────────────────── */
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MESES_CURTOS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function toYYYYMM(year: number, month: number) { return `${year}-${String(month + 1).padStart(2, '0')}`; }
function todayStr() { return new Date().toISOString().slice(0, 10); }
function hojeMMDD() { const d = new Date(); return `${String(d.getMonth() + 1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`; }
function greeting() { const h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; }

/* ── Metrics calc ─────────────────────────────────────────── */
function calcSDRMetrics(v: Vendedor, mesKey: string | null) {
  const lncs = mesKey
    ? v.lancamentos.filter(l => l.data.startsWith(mesKey))
    : v.lancamentos;

  return {
    leadsCaptados: lncs.reduce((a, l) => a + l.ligacoes, 0),
    qualificados: lncs.reduce((a, l) => a + (l.qualificados ?? l.propostas ?? 0), 0),
    desqualificados: lncs.reduce((a, l) => a + (l.leads_desqualificados ?? 0), 0),
    agendados: lncs.reduce((a, l) => a + l.reuniones_agendadas, 0),
    realizados: lncs.reduce((a, l) => a + l.reunioes_realizadas, 0),
    contratos: lncs.reduce((a, l) => a + l.contratos, 0),
    followups: lncs.reduce((a, l) => a + (l.followups_enviados ?? 0), 0),
    retornos: lncs.reduce((a, l) => a + (l.retornos_followup ?? 0), 0),
    receita: lncs.reduce((a, l) => a + l.receita, 0),
  };
}

function pct(num: number, den: number) {
  if (!den) return '—';
  return (num / den * 100).toFixed(1) + '%';
}

type ViewTab = 'geral' | 'meu-painel';
type RankingTipo = 'sdr' | 'closer';

/* ── LOAD COLAB PROFILES ──────────────────────────────────── */
function getColabTipo(id: string): 'sdr' | 'closer' {
  try {
    const profiles = JSON.parse(localStorage.getItem('colab_profiles_v1') || '{}');
    return profiles[id]?.tipo ?? 'sdr';
  } catch { return 'sdr'; }
}

/* ════════════════════════════════════════════════════════════ */
export default function OperacaoDashPanel() {
  const { state } = useAppContext();
  const { vendedores } = state.appState;

  const today = new Date();
  const [activeTab, setActiveTab] = useState<ViewTab>('geral');
  const [selectedSDRId, setSelectedSDRId] = useState<string>('');
  const [selectedMes, setSelectedMes] = useState(() => toYYYYMM(today.getFullYear(), today.getMonth()));
  const [rankTipo, setRankTipo] = useState<RankingTipo>('sdr');
  const [rankDropOpen, setRankDropOpen] = useState(false);

  // Meu Painel state
  const [meuPainelId, setMeuPainelId] = useState<string>(() => vendedores[0]?.id ?? '');
  const [tarefas, setTarefas] = useState<Tarefa[]>(() => loadJson(LS_TAREFAS, []));
  const [compromissos, setCompromissos] = useState<Compromisso[]>(() => loadJson(LS_COMPROMISSOS, []));
  const [estudo, setEstudo] = useState<EstudoDia | null>(() => loadJson(LS_ESTUDO, null));
  const [novaTarefa, setNovaTarefa] = useState('');
  const [novaTarefaPrazo, setNovaTarefaPrazo] = useState('');
  const [showNovoComp, setShowNovoComp] = useState(false);
  const [compForm, setCompForm] = useState({ titulo: '', data: todayStr(), hora: '09:00' });
  const [showEstudoForm, setShowEstudoForm] = useState(false);
  const [estudoTexto, setEstudoTexto] = useState('');

  /* ── GERAL: aggregate metrics ───────────────────────────── */
  const aggMetrics = useMemo(() => {
    const sdrs = selectedSDRId
      ? vendedores.filter(v => v.id === selectedSDRId)
      : vendedores;
    const all = sdrs.map(v => calcSDRMetrics(v, selectedMes));
    return all.reduce((acc, m) => ({
      leadsCaptados: acc.leadsCaptados + m.leadsCaptados,
      qualificados: acc.qualificados + m.qualificados,
      desqualificados: acc.desqualificados + m.desqualificados,
      agendados: acc.agendados + m.agendados,
      realizados: acc.realizados + m.realizados,
      contratos: acc.contratos + m.contratos,
      followups: acc.followups + m.followups,
      retornos: acc.retornos + m.retornos,
      receita: acc.receita + m.receita,
    }), { leadsCaptados: 0, qualificados: 0, desqualificados: 0, agendados: 0, realizados: 0, contratos: 0, followups: 0, retornos: 0, receita: 0 });
  }, [vendedores, selectedSDRId, selectedMes]);

  /* ── Ranking ────────────────────────────────────────────── */
  const rankVendedores = useMemo(() => {
    const filtered = vendedores.filter(v => getColabTipo(v.id) === rankTipo);
    return [...filtered]
      .map(v => ({ v, m: calcSDRMetrics(v, selectedMes) }))
      .sort((a, b) => b.m.realizados - a.m.realizados);
  }, [vendedores, selectedMes, rankTipo]);

  /* ── Meu Painel SDR metrics ─────────────────────────────── */
  const meuVendedor = vendedores.find(v => v.id === meuPainelId);
  const meuMetrics = meuVendedor ? calcSDRMetrics(meuVendedor, selectedMes) : null;

  /* ── Tasks for current user ─────────────────────────────── */
  const minhasTarefas = tarefas.filter(t => t.vendedorId === meuPainelId);
  const atrasadas = minhasTarefas.filter(t => !t.concluida && t.prazo && t.prazo < todayStr());
  const pendentes = minhasTarefas.filter(t => !t.concluida);
  const meusComps = compromissos
    .filter(c => c.vendedorId === meuPainelId && c.data >= todayStr())
    .sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));
  const estudoHoje = estudo?.vendedorId === meuPainelId && estudo.data === todayStr() ? estudo : null;

  function addTarefa() {
    if (!novaTarefa.trim()) return;
    const t: Tarefa = { id: uid(), texto: novaTarefa.trim(), prazo: novaTarefaPrazo || undefined, concluida: false, vendedorId: meuPainelId };
    const next = [...tarefas, t];
    setTarefas(next); saveJson(LS_TAREFAS, next);
    setNovaTarefa(''); setNovaTarefaPrazo('');
  }

  function toggleTarefa(id: string) {
    const next = tarefas.map(t => t.id === id ? { ...t, concluida: !t.concluida } : t);
    setTarefas(next); saveJson(LS_TAREFAS, next);
  }

  function addCompromisso() {
    if (!compForm.titulo.trim()) return;
    const c: Compromisso = { id: uid(), ...compForm, titulo: compForm.titulo.trim(), vendedorId: meuPainelId };
    const next = [...compromissos, c];
    setCompromissos(next); saveJson(LS_COMPROMISSOS, next);
    setShowNovoComp(false); setCompForm({ titulo: '', data: todayStr(), hora: '09:00' });
  }

  function saveEstudo() {
    const e: EstudoDia = { vendedorId: meuPainelId, texto: estudoTexto.trim(), data: todayStr() };
    setEstudo(e); saveJson(LS_ESTUDO, e);
    setShowEstudoForm(false);
  }

  /* ── Funil steps ────────────────────────────────────────── */
  const funil = [
    { roman: 'I', label: 'LEADS CAPTADOS', valor: aggMetrics.leadsCaptados, pctStr: null },
    { roman: 'II', label: 'QUALIFICADOS', valor: aggMetrics.qualificados, pctStr: pct(aggMetrics.qualificados, aggMetrics.leadsCaptados) },
    { roman: 'III', label: 'AGENDAMENTOS', valor: aggMetrics.agendados, pctStr: pct(aggMetrics.agendados, aggMetrics.qualificados) },
    { roman: 'IV', label: 'REUNIÕES REALIZADAS', valor: aggMetrics.realizados, pctStr: pct(aggMetrics.realizados, aggMetrics.agendados) },
    { roman: 'V', label: 'CONTRATOS FECHADOS', valor: aggMetrics.contratos, pctStr: pct(aggMetrics.contratos, aggMetrics.realizados) },
  ];

  const mesDisplay = (() => {
    const [y, m] = selectedMes.split('-').map(Number);
    return `${MESES[m - 1]} ${y}`;
  })();

  return (
    <div className="panel-root">
      <div className="panel-header">
        <div className="panel-header-meta">OPERAÇÃO</div>
        <h1 className="panel-title">Dashboard Comercial</h1>
        <div className="panel-header-actions" style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Notificações placeholder */}
        </div>
      </div>

      {/* Tabs */}
      <div className="op-tabs">
        <button className={`op-tab${activeTab === 'geral' ? ' active' : ''}`} onClick={() => setActiveTab('geral')}>
          📊 Visão Geral
        </button>
        <button className={`op-tab${activeTab === 'meu-painel' ? ' active' : ''}`} onClick={() => setActiveTab('meu-painel')}>
          🎯 Meu Painel (SDR)
        </button>
      </div>

      {/* ═══════════════════ VISÃO GERAL — repaginada ═══════════════════ */}
      {activeTab === 'geral' && (
        <div style={{ padding: '4px 0 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Filtros */}
          <div style={{
            padding: '14px 18px', borderRadius: 16,
            background: 'var(--bg-1)', border: '1px solid var(--border)',
            display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
          }}>
            <div style={{ fontSize: 10, color: 'var(--txt-3)', letterSpacing: 1.2, fontWeight: 700 }}>FILTROS</div>
            <select className="op-select" value={selectedSDRId} onChange={e => setSelectedSDRId(e.target.value)}
              style={{ borderRadius: 10, padding: '8px 12px' }}>
              <option value="">Todos os SDRs</option>
              {vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
            </select>
            <select className="op-select" value={selectedMes} onChange={e => setSelectedMes(e.target.value)}
              style={{ borderRadius: 10, padding: '8px 12px' }}>
              {Array.from({ length: 12 }, (_, i) => {
                const key = toYYYYMM(today.getFullYear(), i);
                return <option key={key} value={key}>{MESES_CURTOS[i]} {today.getFullYear()}</option>;
              })}
            </select>
            <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--txt-2)', fontWeight: 600 }}>
              {mesDisplay}
            </div>
          </div>

          {/* HERO ROW — 4 cards grandes destacados */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 14,
          }}>
            {/* Faturamento — azul hero */}
            <HeroKpi
              label="FATURAMENTO DO MÊS"
              value={fmtBRL(aggMetrics.receita)}
              sub={aggMetrics.contratos > 0 ? `${aggMetrics.contratos} contratos fechados` : 'nenhum contrato ainda'}
              variant="primary"
            />
            {/* Contratos fechados — branco/silver */}
            <HeroKpi
              label="CONTRATOS FECHADOS"
              value={aggMetrics.contratos.toString()}
              sub={pct(aggMetrics.contratos, aggMetrics.realizados) + ' das reuniões realizadas'}
              variant="silver"
            />
            {/* Reuniões realizadas — escuro com pct */}
            <HeroKpi
              label="REUNIÕES REALIZADAS"
              value={aggMetrics.realizados.toString()}
              sub={`de ${aggMetrics.agendados} agendadas · presença ${pct(aggMetrics.realizados, aggMetrics.agendados)}`}
              variant="dark"
            />
            {/* Leads Qualificados — azul gradient */}
            <HeroKpi
              label="LEADS QUALIFICADOS"
              value={aggMetrics.qualificados.toString()}
              sub={`${pct(aggMetrics.qualificados, aggMetrics.leadsCaptados)} de ${aggMetrics.leadsCaptados} captados`}
              variant="gradient"
            />
          </div>

          {/* SECONDARY ROW — 3 KPIs menores estilo barra colorida */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 14,
          }}>
            <MiniKpi
              label="LEADS CAPTADOS"
              value={aggMetrics.leadsCaptados}
              sub="total do mês"
              accent="var(--blue)"
            />
            <MiniKpi
              label="REUNIÕES AGENDADAS"
              value={aggMetrics.agendados}
              sub={`${pct(aggMetrics.agendados, aggMetrics.qualificados)} dos qualificados`}
              accent="var(--amber)"
            />
            <MiniKpi
              label="LEADS DESQUALIFICADOS"
              value={aggMetrics.desqualificados}
              sub={`${pct(aggMetrics.desqualificados, aggMetrics.leadsCaptados)} do captado`}
              accent="var(--red)"
            />
          </div>

          {/* Funil + Ranking */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1.1fr 1fr',
            gap: 14,
          }}
          className="op-dash-grid-2col">
            {/* Funil */}
            <div style={{
              padding: 22, borderRadius: 18,
              background: 'var(--bg-1)', border: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 10, color: 'var(--txt-3)', letterSpacing: 1.2, fontWeight: 700, marginBottom: 4 }}>ESTRUTURA</div>
              <h3 style={{ margin: '0 0 16px', fontSize: 17, fontWeight: 700, color: 'var(--txt-0)' }}>Funil de Vendas</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {funil.map((step, i) => {
                  const maxVal = funil[0].valor || 1;
                  const width = Math.max(36, Math.round((step.valor / maxVal) * 100));
                  return (
                    <div key={i} style={{
                      padding: '14px 18px', borderRadius: 12,
                      background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                      color: '#fff', width: `${width}%`, transition: 'width .3s',
                      display: 'flex', alignItems: 'center', gap: 12,
                      boxShadow: '0 4px 12px rgba(59,130,246,.18)',
                    }}>
                      <span style={{
                        width: 26, height: 26, borderRadius: '50%',
                        background: 'rgba(255,255,255,.22)', display: 'grid', placeItems: 'center',
                        fontSize: 10, fontWeight: 800, flexShrink: 0,
                      }}>{step.roman}</span>
                      <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: .5, flex: 1, minWidth: 0 }}>{step.label}</span>
                      <span style={{ fontSize: 18, fontWeight: 800 }}>{step.valor}</span>
                      {step.pctStr && (
                        <span style={{
                          fontSize: 10.5, fontWeight: 700, opacity: .85,
                          padding: '2px 7px', borderRadius: 5, background: 'rgba(255,255,255,.16)',
                        }}>{step.pctStr}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Ranking */}
            <div style={{
              padding: 22, borderRadius: 18,
              background: 'var(--bg-1)', border: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--txt-3)', letterSpacing: 1.2, fontWeight: 700, marginBottom: 4 }}>PERFORMANCE</div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--txt-0)' }}>
                    Ranking de {rankTipo === 'sdr' ? 'SDRs' : 'Closers'}
                  </h3>
                </div>
                <div style={{ position: 'relative', marginLeft: 'auto' }}>
                  <button onClick={() => setRankDropOpen(o => !o)}
                    style={{
                      padding: '6px 12px', borderRadius: 8,
                      background: 'var(--bg-2)', border: '1px solid var(--border)',
                      color: 'var(--txt-1)', cursor: 'pointer', fontFamily: 'inherit',
                      fontSize: 12, fontWeight: 600,
                    }}>
                    {rankTipo === 'sdr' ? 'SDRs' : 'Closers'} ▾
                  </button>
                  {rankDropOpen && (
                    <div onClick={() => setRankDropOpen(false)}
                      style={{
                        position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 10,
                        background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8,
                        padding: 4, minWidth: 120, boxShadow: '0 8px 24px rgba(0,0,0,.4)',
                      }}>
                      <div onClick={() => setRankTipo('sdr')}
                        style={{ padding: '6px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12, color: 'var(--txt-1)' }}>SDRs</div>
                      <div onClick={() => setRankTipo('closer')}
                        style={{ padding: '6px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12, color: 'var(--txt-1)' }}>Closers</div>
                    </div>
                  )}
                </div>
              </div>

              {rankVendedores.length === 0 ? (
                <div style={{ color: 'var(--txt-3)', fontSize: 13, padding: '24px 0', textAlign: 'center', lineHeight: 1.55 }}>
                  Sem dados de performance ainda.<br/>
                  <span style={{ fontSize: 11.5 }}>Preencha as planilhas dos vendedores pra alimentar o ranking.</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {rankVendedores.map(({ v, m }, i) => {
                    const maxRealiz = rankVendedores[0]?.m.realizados || 1;
                    const medals = ['🥇', '🥈', '🥉'];
                    return (
                      <div key={v.id} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: 10, borderRadius: 12,
                        background: 'var(--bg-2)', border: '1px solid var(--border)',
                      }}>
                        <span style={{ fontSize: 18, width: 24 }}>{medals[i] ?? ''}</span>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%',
                          background: 'var(--silver-grad)', color: '#0a0a0c',
                          display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 13,
                        }}>{v.nome.charAt(0).toUpperCase()}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt-0)' }}>{v.nome}</div>
                          <div style={{ fontSize: 11, color: 'var(--txt-3)', marginTop: 1 }}>
                            {m.qualificados} qualif · {m.agendados} agend · {m.realizados} realiz
                          </div>
                          <div style={{
                            marginTop: 5, height: 4, borderRadius: 2,
                            background: 'rgba(255,255,255,.06)', overflow: 'hidden',
                          }}>
                            <div style={{
                              height: '100%',
                              width: `${Math.round(m.realizados / maxRealiz * 100)}%`,
                              background: 'linear-gradient(90deg, #3b82f6, #60a5fa)',
                            }} />
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--txt-0)' }}>{m.realizados}</div>
                          <div style={{ fontSize: 9, color: 'var(--txt-3)', letterSpacing: .5, fontWeight: 600 }}>REUN. REAL.</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Tempo médio de resposta — destaque */}
          <div style={{
            padding: 22, borderRadius: 18,
            background: 'linear-gradient(135deg, rgba(59,130,246,.18) 0%, rgba(37,99,235,.08) 100%)',
            border: '1px solid rgba(59,130,246,.25)',
            display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap',
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: 'rgba(59,130,246,.22)', color: '#60a5fa',
              display: 'grid', placeItems: 'center', fontSize: 22, flexShrink: 0,
            }}>⏱</div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 10, color: '#60a5fa', letterSpacing: 1.2, fontWeight: 700, marginBottom: 4 }}>
                VELOCIDADE
              </div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--txt-0)' }}>
                Tempo médio de resposta
              </h3>
              <div style={{ fontSize: 12, color: 'var(--txt-2)', marginTop: 4, lineHeight: 1.5 }}>
                Tempo entre lead entrar e primeiro contato do SDR. Métrica direta de qualidade do atendimento.
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--txt-3)' }}>—</div>
              <div style={{
                fontSize: 10, color: 'var(--amber)', fontWeight: 700, marginTop: 2,
                letterSpacing: .5, textTransform: 'uppercase',
              }}>Aguardando integração</div>
              <div style={{ fontSize: 10.5, color: 'var(--txt-3)', marginTop: 4, maxWidth: 240 }}>
                Conecte WhatsApp/ZapSign pra ativar.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════ MEU PAINEL ═══════════════════ */}
      {activeTab === 'meu-painel' && (
        <div className="op-meu-painel">
          {/* Selector */}
          <div className="op-filters">
            <div className="op-filter-label">VISUALIZANDO COMO</div>
            <select className="op-select" value={meuPainelId}
              onChange={e => setMeuPainelId(e.target.value)}>
              {vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
            </select>
            {meuVendedor && (
              <div className="op-greeting">
                {greeting()}, <strong>{meuVendedor.nome}</strong>! Aqui está o seu dia.
              </div>
            )}
          </div>

          {!meuVendedor ? (
            <div className="empty-state">
              <div className="empty-state-title">Nenhum SDR cadastrado</div>
              <div className="empty-state-sub">Adicione vendedores na aba "Time de Vendas".</div>
            </div>
          ) : (
            <>
              {/* KPIs do SDR */}
              {meuMetrics && (
                <div className="op-meu-kpis">
                  {[
                    { label: 'QUALIFICADOS (MÊS)', val: meuMetrics.qualificados, color: 'var(--green)' },
                    { label: 'AGENDAMENTOS (MÊS)', val: meuMetrics.agendados, color: 'var(--blue)' },
                    { label: 'REUNIÕES REALIZADAS', val: meuMetrics.realizados, color: 'var(--silver-1)' },
                    { label: 'FOLLOW-UPS ENVIADOS', val: meuMetrics.followups, color: 'var(--amber)' },
                  ].map(k => (
                    <div key={k.label} className="op-meu-kpi"
                      style={{ borderTop: `3px solid ${k.color}` }}>
                      <div className="op-meu-kpi-val" style={{ color: k.color }}>{k.val}</div>
                      <div className="op-meu-kpi-label">{k.label}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Grid 2x2 */}
              <div className="op-meu-grid">
                {/* Tarefas */}
                <div className="op-meu-card">
                  <div className="op-meu-card-header">
                    📋 Tarefas pendentes
                    <span className="op-badge-num">{pendentes.length}</span>
                  </div>
                  {atrasadas.length > 0 && (
                    <div className="op-atrasadas-badge">🔴 ATRASADAS ({atrasadas.length})</div>
                  )}
                  <div className="op-tarefa-list">
                    {pendentes.length === 0 && <div className="op-empty-sub">✓ Nenhuma tarefa pendente</div>}
                    {pendentes.map(t => (
                      <div key={t.id} className={`op-tarefa-item${t.prazo && t.prazo < todayStr() ? ' atrasada' : ''}`}>
                        <input type="checkbox" checked={t.concluida} onChange={() => toggleTarefa(t.id)} />
                        <span>{t.texto}</span>
                        {t.prazo && <span className="op-tarefa-prazo">{t.prazo.slice(5).replace('-', '/')}</span>}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <input className="field-input" style={{ flex: 1, fontSize: 12, padding: '6px 8px' }}
                      placeholder="Nova tarefa..." value={novaTarefa} onChange={e => setNovaTarefa(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addTarefa()} />
                    <input className="field-input" type="date" style={{ width: 120, fontSize: 12, padding: '6px 8px' }}
                      value={novaTarefaPrazo} onChange={e => setNovaTarefaPrazo(e.target.value)} />
                    <button className="btn-primary" style={{ padding: '0 10px', fontSize: 13 }} onClick={addTarefa}>+</button>
                  </div>
                </div>

                {/* Contratos pendentes */}
                <div className="op-meu-card">
                  <div className="op-meu-card-header">
                    📄 Contratos pendentes
                    <span className="op-badge-num">0</span>
                  </div>
                  <div className="op-empty-sub">✓ Nenhum contrato pendente</div>
                </div>

                {/* Próximos compromissos */}
                <div className="op-meu-card">
                  <div className="op-meu-card-header">
                    🗓 Próximos compromissos
                    <span className="op-badge-num">{meusComps.length}</span>
                    {meusComps.length > 0 && <button className="btn-ghost op-ver-agenda">Ver agenda →</button>}
                  </div>
                  {meusComps.length === 0 && <div className="op-empty-sub">Nenhum compromisso agendado.</div>}
                  {meusComps.slice(0, 3).map(c => (
                    <div key={c.id} className="op-comp-item">
                      <span>{c.titulo}</span>
                      <span className="op-comp-data">{c.data.slice(5).replace('-','/')} {c.hora}</span>
                    </div>
                  ))}
                  {!showNovoComp ? (
                    <button className="btn-ghost op-add-comp" onClick={() => setShowNovoComp(true)}>+ Novo compromisso</button>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                      <input className="field-input" placeholder="Título" style={{ fontSize: 12 }}
                        value={compForm.titulo} onChange={e => setCompForm(f => ({ ...f, titulo: e.target.value }))} />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input className="field-input" type="date" style={{ flex: 1, fontSize: 12 }}
                          value={compForm.data} onChange={e => setCompForm(f => ({ ...f, data: e.target.value }))} />
                        <input className="field-input" type="time" style={{ width: 90, fontSize: 12 }}
                          value={compForm.hora} onChange={e => setCompForm(f => ({ ...f, hora: e.target.value }))} />
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setShowNovoComp(false)}>Cancelar</button>
                        <button className="btn-primary" style={{ flex: 1 }} onClick={addCompromisso}>Salvar</button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Estudo do dia */}
                <div className="op-meu-card">
                  <div className="op-meu-card-header">📚 Estudo do dia</div>
                  {estudoHoje ? (
                    <div>
                      <div className="op-estudo-texto">{estudoHoje.texto}</div>
                      <div className="op-estudo-reset">Reseta às 18h · {hojeMMDD()}</div>
                    </div>
                  ) : (
                    <>
                      {!showEstudoForm ? (
                        <>
                          <div className="op-empty-sub" style={{ fontStyle: 'italic' }}>
                            Você ainda não tem a tarefa "Estudo do dia" — ela é repetível e reseta às 18h.
                          </div>
                          <button className="btn-ghost op-add-comp" onClick={() => setShowEstudoForm(true)}>
                            + Criar tarefa de estudo diário
                          </button>
                        </>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <textarea className="field-input" rows={3}
                            placeholder="O que você vai estudar hoje?"
                            value={estudoTexto} onChange={e => setEstudoTexto(e.target.value)} />
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setShowEstudoForm(false)}>Cancelar</button>
                            <button className="btn-primary" style={{ flex: 1 }} onClick={saveEstudo}>Salvar</button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════ */
/* KPI components — visual hero (print 2) com substância (print 1) */

type HeroVariant = 'primary' | 'silver' | 'dark' | 'gradient';

function HeroKpi({
  label, value, sub, variant,
}: { label: string; value: string; sub: string; variant: HeroVariant }) {
  const styles: Record<HeroVariant, React.CSSProperties> = {
    primary: {
      background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
      color: '#fff',
      boxShadow: '0 8px 28px rgba(37,99,235,.32)',
    },
    silver: {
      background: 'linear-gradient(135deg, #f5f5f7 0%, #c4c4cc 100%)',
      color: '#0a0a0c',
      boxShadow: '0 8px 28px rgba(196,196,204,.20)',
    },
    dark: {
      background: 'linear-gradient(135deg, #1c1c22 0%, #16161a 100%)',
      color: 'var(--txt-0)',
      border: '1px solid var(--border)',
    },
    gradient: {
      background: 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)',
      color: '#fff',
      boxShadow: '0 8px 28px rgba(59,130,246,.28)',
    },
  };
  const onLight = variant === 'silver';
  return (
    <div style={{
      padding: '20px 22px', borderRadius: 18, minHeight: 130,
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      transition: 'transform .2s',
      ...styles[variant],
    }}>
      <div style={{
        fontSize: 10.5, fontWeight: 700, letterSpacing: 1.2,
        opacity: onLight ? .6 : .85,
      }}>{label}</div>
      <div style={{
        fontSize: 34, fontWeight: 800, lineHeight: 1.1,
        fontFamily: 'var(--font-display)', marginTop: 4,
        letterSpacing: -0.5,
      }}>{value}</div>
      <div style={{
        fontSize: 12, fontWeight: 500,
        opacity: onLight ? .65 : .8, marginTop: 6,
      }}>{sub}</div>
    </div>
  );
}

function MiniKpi({
  label, value, sub, accent,
}: { label: string; value: number; sub: string; accent: string }) {
  return (
    <div style={{
      padding: '18px 20px', borderRadius: 16,
      background: 'var(--bg-1)', border: '1px solid var(--border)',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: accent,
      }} />
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: 1.2,
        color: 'var(--txt-3)',
      }}>{label}</div>
      <div style={{
        fontSize: 28, fontWeight: 800, lineHeight: 1.1,
        color: 'var(--txt-0)', fontFamily: 'var(--font-display)',
        marginTop: 6, letterSpacing: -0.3,
      }}>{value}</div>
      <div style={{ fontSize: 11.5, color: 'var(--txt-2)', marginTop: 4 }}>{sub}</div>
    </div>
  );
}
