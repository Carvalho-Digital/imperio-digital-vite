import { useMemo, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { fmtBRL } from '../../lib/formatters';
import type { Vendedor } from '../../types';

/* ── Date helpers ─────────────────────────────────────────── */
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MESES_CURTOS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
function toYYYYMM(year: number, month: number) { return `${year}-${String(month + 1).padStart(2, '0')}`; }

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
    receita: lncs.reduce((a, l) => a + l.receita, 0),
  };
}
type SDRMetrics = ReturnType<typeof calcSDRMetrics>;

function pct(num: number, den: number) {
  if (!den) return '—';
  return (num / den * 100).toFixed(1) + '%';
}

/* ── Perfis de colaborador (SDR vs Closer) ────────────────── */
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
  const [selectedSDRId, setSelectedSDRId] = useState<string>('');
  const [selectedMes, setSelectedMes] = useState(() => toYYYYMM(today.getFullYear(), today.getMonth()));

  /* ── Agregação para a Visão Geral ─────────────────────────── */
  const aggMetrics = useMemo(() => {
    const filtrados = selectedSDRId
      ? vendedores.filter(v => v.id === selectedSDRId)
      : vendedores;
    return filtrados.map(v => calcSDRMetrics(v, selectedMes))
      .reduce((acc, m) => ({
        leadsCaptados: acc.leadsCaptados + m.leadsCaptados,
        qualificados: acc.qualificados + m.qualificados,
        desqualificados: acc.desqualificados + m.desqualificados,
        agendados: acc.agendados + m.agendados,
        realizados: acc.realizados + m.realizados,
        contratos: acc.contratos + m.contratos,
        receita: acc.receita + m.receita,
      }), { leadsCaptados: 0, qualificados: 0, desqualificados: 0, agendados: 0, realizados: 0, contratos: 0, receita: 0 });
  }, [vendedores, selectedSDRId, selectedMes]);

  /* ── Rankings separados ───────────────────────────────────── */
  const rankingSDR = useMemo(
    () => buildRanking(vendedores.filter(v => getColabTipo(v.id) === 'sdr'), selectedMes),
    [vendedores, selectedMes]
  );
  const rankingCloser = useMemo(
    () => buildRanking(vendedores.filter(v => getColabTipo(v.id) === 'closer'), selectedMes),
    [vendedores, selectedMes]
  );

  /* ── Etapas do funil ──────────────────────────────────────── */
  const funil = [
    { roman: 'I',   label: 'Leads Captados',      valor: aggMetrics.leadsCaptados, pctStr: null                                                       },
    { roman: 'II',  label: 'Qualificados',         valor: aggMetrics.qualificados,   pctStr: pct(aggMetrics.qualificados, aggMetrics.leadsCaptados)   },
    { roman: 'III', label: 'Agendamentos',         valor: aggMetrics.agendados,      pctStr: pct(aggMetrics.agendados, aggMetrics.qualificados)       },
    { roman: 'IV',  label: 'Reuniões Realizadas',  valor: aggMetrics.realizados,     pctStr: pct(aggMetrics.realizados, aggMetrics.agendados)         },
    { roman: 'V',   label: 'Contratos Fechados',   valor: aggMetrics.contratos,      pctStr: pct(aggMetrics.contratos, aggMetrics.realizados)         },
  ];

  const mesDisplay = (() => {
    const [y, m] = selectedMes.split('-').map(Number);
    return `${MESES[m - 1]} ${y}`;
  })();

  /* ── 7 KPIs uniformes (Print 2 vibe — todos hero) ─────────── */
  const kpis: HeroKpiData[] = [
    { label: 'FATURAMENTO',          value: fmtBRL(aggMetrics.receita),         sub: `${aggMetrics.contratos} contratos no mês`,                                       variant: 'primary' },
    { label: 'CONTRATOS FECHADOS',   value: aggMetrics.contratos.toString(),    sub: `${pct(aggMetrics.contratos, aggMetrics.realizados)} das reuniões realizadas`,    variant: 'silver' },
    { label: 'REUNIÕES REALIZADAS',  value: aggMetrics.realizados.toString(),   sub: `de ${aggMetrics.agendados} agendadas · presença ${pct(aggMetrics.realizados, aggMetrics.agendados)}`, variant: 'gradient' },
    { label: 'REUNIÕES AGENDADAS',   value: aggMetrics.agendados.toString(),    sub: `${pct(aggMetrics.agendados, aggMetrics.qualificados)} dos qualificados`,         variant: 'dark' },
    { label: 'LEADS QUALIFICADOS',   value: aggMetrics.qualificados.toString(), sub: `${pct(aggMetrics.qualificados, aggMetrics.leadsCaptados)} do captado`,            variant: 'gradient' },
    { label: 'LEADS CAPTADOS',       value: aggMetrics.leadsCaptados.toString(), sub: 'total entrados no mês',                                                          variant: 'dark' },
    { label: 'LEADS DESQUALIFICADOS', value: aggMetrics.desqualificados.toString(), sub: `${pct(aggMetrics.desqualificados, aggMetrics.leadsCaptados)} do captado`,    variant: 'danger' },
  ];

  return (
    <div className="panel-root">
      <div className="panel-header">
        <div className="panel-header-meta">OPERAÇÃO</div>
        <h1 className="panel-title">Dashboard Comercial</h1>
      </div>

      <div style={{ padding: '4px 0 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* Filtros */}
        <div style={{
          padding: '14px 18px', borderRadius: 16,
          background: 'var(--bg-1)', border: '1px solid var(--border)',
          display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
        }}>
          <div style={{ fontSize: 10, color: 'var(--txt-3)', letterSpacing: 1.2, fontWeight: 700 }}>FILTROS</div>
          <select value={selectedSDRId} onChange={e => setSelectedSDRId(e.target.value)}
            style={selectStyle}>
            <option value="">Todos os SDRs</option>
            {vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
          </select>
          <select value={selectedMes} onChange={e => setSelectedMes(e.target.value)}
            style={selectStyle}>
            {Array.from({ length: 12 }, (_, i) => {
              const key = toYYYYMM(today.getFullYear(), i);
              return <option key={key} value={key}>{MESES_CURTOS[i]} {today.getFullYear()}</option>;
            })}
          </select>
          <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--txt-2)', fontWeight: 600 }}>
            {mesDisplay}
          </div>
        </div>

        {/* 7 KPIs uniformes em grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 14,
        }}>
          {kpis.map(k => <HeroKpi key={k.label} {...k} />)}
        </div>

        {/* Row: Funil + Ranking SDRs (estilo print 2) */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 14,
        }}
        className="op-dash-grid-2col">
          {/* Funil de Vendas */}
          <div style={{
            padding: 22, borderRadius: 18,
            background: 'var(--bg-1)', border: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: 10, color: 'var(--txt-3)', letterSpacing: 1.2, fontWeight: 700, marginBottom: 4 }}>ESTRUTURA</div>
            <h3 style={{ margin: '0 0 16px', fontSize: 17, fontWeight: 700, color: 'var(--txt-0)' }}>Funil de Vendas</h3>
            <FunnelChart steps={funil} />
          </div>

          <RankingCard title="Ranking de SDRs" tipo="sdr" data={rankingSDR} />
        </div>

        {/* Row: Ranking Closers + Tempo de Resposta */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 14,
        }}
        className="op-dash-grid-2col">
          <RankingCard title="Ranking de Closers" tipo="closer" data={rankingCloser} />

          {/* Tempo Médio de Resposta */}
          <div style={{
            padding: 22, borderRadius: 18,
            background: 'linear-gradient(135deg, rgba(59,130,246,.18) 0%, rgba(37,99,235,.08) 100%)',
            border: '1px solid rgba(59,130,246,.25)',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: 'rgba(59,130,246,.22)', color: '#60a5fa',
                display: 'grid', placeItems: 'center', fontSize: 18, flexShrink: 0,
              }}>⏱</div>
              <div>
                <div style={{ fontSize: 10, color: '#60a5fa', letterSpacing: 1.2, fontWeight: 700, marginBottom: 2 }}>
                  VELOCIDADE
                </div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--txt-0)' }}>
                  Tempo médio de resposta
                </h3>
              </div>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--txt-2)', lineHeight: 1.5, marginTop: 10 }}>
              Tempo entre lead entrar e primeiro contato do SDR.
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 14 }}>
              <div style={{
                fontSize: 10, color: 'var(--amber)', fontWeight: 700,
                letterSpacing: .5, textTransform: 'uppercase', maxWidth: 140,
              }}>Aguardando integração WhatsApp/ZapSign</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--txt-3)', lineHeight: 1 }}>—</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 10,
  background: 'var(--bg-2)', border: '1px solid var(--border)',
  color: 'var(--txt-1)', fontFamily: 'inherit', fontSize: 12.5, cursor: 'pointer',
};

/* ════════════════════════════════════════════════════════════ */
/* HeroKpi — todos os 7 cards no mesmo padrão */

type HeroVariant = 'primary' | 'silver' | 'dark' | 'gradient' | 'danger';
interface HeroKpiData {
  label: string;
  value: string;
  sub: string;
  variant: HeroVariant;
}

function HeroKpi({ label, value, sub, variant }: HeroKpiData) {
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
    danger: {
      background: 'linear-gradient(135deg, #b91c1c 0%, #7f1d1d 100%)',
      color: '#fff',
      boxShadow: '0 8px 28px rgba(185,28,28,.28)',
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
        fontSize: 32, fontWeight: 800, lineHeight: 1.1,
        fontFamily: 'var(--font-display)', marginTop: 8,
        letterSpacing: -0.5,
      }}>{value}</div>
      <div style={{
        fontSize: 12, fontWeight: 500,
        opacity: onLight ? .65 : .8, marginTop: 6,
      }}>{sub}</div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════ */
/* FunnelChart — barras decrescentes compactas (estilo Print 2) */

interface FunnelStep {
  roman: string;
  label: string;
  valor: number;
  pctStr: string | null;
}

function FunnelChart({ steps }: { steps: FunnelStep[] }) {
  // Larguras decrescentes — cada etapa "afunila" ~14% da anterior
  const widths = [100, 86, 72, 58, 44];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {steps.map((step, i) => {
        const w = widths[i] ?? widths[widths.length - 1];
        return (
          <div key={i} style={{
            width: `${w}%`,
            transition: 'width .3s',
            padding: '12px 16px', borderRadius: 12,
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            boxShadow: '0 4px 12px rgba(59,130,246,.18)',
            color: '#fff',
            display: 'flex', alignItems: 'center', gap: 12,
            minHeight: 48,
          }}>
            <span style={{
              width: 24, height: 24, borderRadius: '50%',
              background: 'rgba(255,255,255,.22)',
              display: 'grid', placeItems: 'center',
              fontSize: 10, fontWeight: 800, flexShrink: 0,
              letterSpacing: .3,
            }}>{step.roman}</span>
            <span style={{
              fontSize: 12, fontWeight: 700, letterSpacing: .8,
              textTransform: 'uppercase',
              flex: 1, minWidth: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{step.label}</span>
            <span style={{
              fontSize: 18, fontWeight: 800,
              fontFamily: 'var(--font-display)',
            }}>{step.valor}</span>
            {step.pctStr && (
              <span style={{
                fontSize: 10.5, fontWeight: 700,
                padding: '3px 8px', borderRadius: 5,
                background: 'rgba(255,255,255,.18)',
                whiteSpace: 'nowrap',
              }}>{step.pctStr}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════ */
/* RankingCard — agora 2 colunas separadas: SDRs + Closers */

interface RankEntry {
  v: Vendedor;
  m: SDRMetrics;
}

function buildRanking(vs: Vendedor[], mesKey: string): RankEntry[] {
  return [...vs]
    .map(v => ({ v, m: calcSDRMetrics(v, mesKey) }))
    .sort((a, b) => b.m.realizados - a.m.realizados);
}

function RankingCard({
  title, tipo, data,
}: { title: string; tipo: 'sdr' | 'closer'; data: RankEntry[] }) {
  const maxRealiz = data[0]?.m.realizados || 1;
  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div style={{
      padding: 22, borderRadius: 18,
      background: 'var(--bg-1)', border: '1px solid var(--border)',
    }}>
      <div style={{ fontSize: 10, color: 'var(--txt-3)', letterSpacing: 1.2, fontWeight: 700, marginBottom: 4 }}>
        PERFORMANCE
      </div>
      <h3 style={{ margin: '0 0 14px', fontSize: 17, fontWeight: 700, color: 'var(--txt-0)' }}>{title}</h3>

      {data.length === 0 ? (
        <div style={{ color: 'var(--txt-3)', fontSize: 13, padding: '24px 0', textAlign: 'center', lineHeight: 1.55 }}>
          Nenhum {tipo === 'sdr' ? 'SDR' : 'closer'} cadastrado.<br/>
          <span style={{ fontSize: 11.5 }}>Cadastre em Colaboradores e marque o tipo.</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {data.map(({ v, m }, i) => (
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
          ))}
        </div>
      )}
    </div>
  );
}
