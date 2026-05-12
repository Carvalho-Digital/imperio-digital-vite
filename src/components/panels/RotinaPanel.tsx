import { useState, useEffect } from 'react';

const CHECKLIST_INICIO = [
  { id: 'i1', text: 'Quantos contratos fechamos no mês passado? Estamos na meta ou atrasados?' },
  { id: 'i2', text: 'Quantas reuniões precisamos fazer este mês? (meta = nº contratos × 3)' },
  { id: 'i3', text: 'Quantos clientes vencem contrato em 30–60 dias? Ligar para renovação!' },
  { id: 'i4', text: 'MRR atual vs meta do mês — qual o gap? Como fechar?' },
  { id: 'i5', text: 'Revisar pipeline comercial — quantas propostas ativas temos?' },
];

const CHECKLIST_FIM = [
  { id: 'f1', text: 'Contratos fechados vs meta — atingimos? (preencher na tabela)' },
  { id: 'f2', text: 'MRR fim do mês — quanto cresceu em R$ e em %?' },
  { id: 'f3', text: 'Faturamento do mês vs meta — atingimos?' },
  { id: 'f4', text: 'Quantas renovações confirmamos para os próximos 2 meses?' },
  { id: 'f5', text: 'Preparar relatório mensal e planejar próximo mês' },
];

const CHECKS_KEY = 'imperio_checks';

function loadChecks(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(CHECKS_KEY) || '{}'); } catch { return {}; }
}

export default function RotinaPanel() {
  const [checks, setChecks] = useState<Record<string, boolean>>(loadChecks);

  useEffect(() => {
    try { localStorage.setItem(CHECKS_KEY, JSON.stringify(checks)); } catch {}
  }, [checks]);

  const toggle = (id: string) => setChecks(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <>
      <div className="topbar">
        <div>
          <h1 className="page-title">Rotina &amp; Alertas</h1>
          <div className="page-subtitle">Checklist mensal e semáforo de saúde do negócio</div>
        </div>
      </div>

      <div className="section" style={{ marginTop: 0 }}>
        <div className="section-eyebrow">Checklist Mensal</div>
        <div className="section-title">Rotina de Gestão Comercial</div>
        <div className="section-desc">Os checks salvam automaticamente — use como roteiro recorrente</div>
      </div>

      <div className="grid-2">
        <div className="checklist-box">
          <div className="card-title">📋 Início de Cada Mês</div>
          <div className="card-subtitle">Planejamento e diagnóstico</div>
          {CHECKLIST_INICIO.map(item => (
            <div key={item.id} className="check-item">
              <input
                type="checkbox"
                id={`ck-${item.id}`}
                checked={!!checks[item.id]}
                onChange={() => toggle(item.id)}
              />
              <label htmlFor={`ck-${item.id}`}>{item.text}</label>
            </div>
          ))}
        </div>
        <div className="checklist-box">
          <div className="card-title">📊 Final de Cada Mês</div>
          <div className="card-subtitle">Fechamento e relatório</div>
          {CHECKLIST_FIM.map(item => (
            <div key={item.id} className="check-item">
              <input
                type="checkbox"
                id={`ck-${item.id}`}
                checked={!!checks[item.id]}
                onChange={() => toggle(item.id)}
              />
              <label htmlFor={`ck-${item.id}`}>{item.text}</label>
            </div>
          ))}
        </div>
      </div>

      <div className="section">
        <div className="section-eyebrow">Semáforo</div>
        <div className="section-title">Alertas Críticos</div>
        <div className="section-desc">Sinais de alerta para agir rápido e ações para manter o ritmo</div>
      </div>

      <div className="grid-2">
        <div className="alert-card red">
          <div className="alert-card-title">🔴 Red Flags — Agir Imediatamente</div>
          <ul className="alert-list">
            <li>MRR caiu 2 meses seguidos → revisar churn e retenção</li>
            <li>Taxa Lead → Contrato &lt; 12% → revisar funil e qualificação</li>
            <li>Pipeline com menos de 30 propostas ativas → acelerar geração de leads</li>
            <li>Renovações abaixo de 75% → ligar para clientes em risco AGORA</li>
            <li>Faturamento do mês &lt; 80% da meta → ação corretiva imediata</li>
          </ul>
        </div>
        <div className="alert-card green">
          <div className="alert-card-title">🟢 No Caminho — Manter Ritmo</div>
          <ul className="alert-list">
            <li>MRR crescendo &gt; 15% mês a mês → escalar canal de aquisição</li>
            <li>Taxa Lead → Contrato &gt; 16% → documentar o que está funcionando</li>
            <li>Renovações &gt; 84% → criar programa de fidelidade</li>
            <li>Faturamento ≥ meta → considerar upsell e contratar reforço</li>
            <li>Pipeline saudável → focar em qualidade e ticket médio</li>
          </ul>
        </div>
      </div>
    </>
  );
}
