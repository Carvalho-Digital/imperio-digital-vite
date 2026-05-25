import { useEffect, useState } from 'react';
import type { TabId } from '../App';
import { useAppContext } from '../context/AppContext';

interface NavItem {
  id: TabId;
  icon: string;
  label: string;
  badge?: string;
}

const NAV_VISAO_GERAL: NavItem[] = [
  { id: 'dashboard', icon: '▦',  label: 'Dashboard' },
  { id: 'plano',     icon: '≡',  label: 'Plano Anual' },
  { id: 'produtos',  icon: '◇',  label: 'Produtos & Mix' },
];

const NAV_OPERACAO: NavItem[] = [
  { id: 'operacao', icon: '▤', label: 'Dashboard Operacional' },
  { id: 'time',     icon: '◉', label: 'Time de Vendas' },
  { id: 'funis',    icon: '⫶', label: 'Funis de Aquisição' },
  { id: 'rotina',   icon: '✓', label: 'Rotina & Alertas' },
];

const NAV_EQUIPE: NavItem[] = [
  { id: 'colaboradores', icon: '◈', label: 'Colaboradores' },
];

const NAV_INTELIGENCIA: NavItem[] = [
  { id: 'agente',         icon: '⬢', label: 'Agente' },
  { id: 'base-agente',    icon: '◈', label: 'Base do Agente' },
  { id: 'scripts',        icon: '≋', label: 'Biblioteca de Scripts' },
  { id: 'mapa-mental',    icon: '⬡', label: 'Mapa Mental' },
];

interface Props {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export default function Sidebar({ activeTab, onTabChange }: Props) {
  const { state } = useAppContext();

  const sellerCount = state.appState.vendedores.length;

  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const handleTabClick = (tab: TabId) => {
    onTabChange(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">ID</div>
        <div className="brand-text">
          <div className="brand-name">Império Digital</div>
          <div className="brand-sub">Plano Comercial</div>
        </div>
      </div>

      <nav>
        <div className="nav-section">
          <div className="nav-section-title">Visão Geral</div>
          {NAV_VISAO_GERAL.map(item => (
            <button
              key={item.id}
              className={`nav-item${activeTab === item.id ? ' active' : ''}`}
              onClick={() => handleTabClick(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
        <div className="nav-section">
          <div className="nav-section-title">Operação</div>
          {NAV_OPERACAO.map(item => (
            <button
              key={item.id}
              className={`nav-item${activeTab === item.id ? ' active' : ''}`}
              onClick={() => handleTabClick(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
              {item.id === 'time' && (
                <span className="nav-badge" id="seller-count-badge">{sellerCount}</span>
              )}
            </button>
          ))}
        </div>
        <div className="nav-section">
          <div className="nav-section-title">Equipe</div>
          {NAV_EQUIPE.map(item => (
            <button
              key={item.id}
              className={`nav-item${activeTab === item.id ? ' active' : ''}`}
              onClick={() => handleTabClick(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
              {item.id === 'colaboradores' && sellerCount > 0 && (
                <span className="nav-badge">{sellerCount}</span>
              )}
            </button>
          ))}
        </div>
        <div className="nav-section">
          <div className="nav-section-title">Inteligência</div>
          {NAV_INTELIGENCIA.map(item => (
            <button
              key={item.id}
              className={`nav-item${activeTab === item.id ? ' active' : ''}`}
              onClick={() => handleTabClick(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="sidebar-footer">
        <div className="user-card">
          <div className="user-avatar">DI</div>
          <div className="user-info">
            <div className="user-name">Império Digital</div>
            <div className="user-role">Administrador</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
