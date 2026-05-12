import { useState } from 'react';
import Sidebar from './components/Sidebar';
import DashboardPanel from './components/panels/DashboardPanel';
import PlanoAnualPanel from './components/panels/PlanoAnualPanel';
import ProdutosMixPanel from './components/panels/ProdutosMixPanel';
import TimeVendasPanel from './components/panels/TimeVendasPanel';
import FunisPanel from './components/panels/FunisPanel';
import RotinaPanel from './components/panels/RotinaPanel';
import AuthScreen from './components/AuthScreen';
import { useAuth } from './context/AuthContext';
import { useAppContext } from './context/AppContext';

export type TabId = 'dashboard' | 'plano' | 'produtos' | 'time' | 'funis' | 'rotina';

function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-0)', color: 'var(--txt-2)', gap: 12,
    }}>
      <div style={{ fontSize: 28 }}>👑</div>
      <div style={{ fontSize: 13, fontFamily: 'var(--font-display)' }}>Carregando...</div>
    </div>
  );
}

function MainApp() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const { isLoading } = useAppContext();

  if (isLoading) return <LoadingScreen />;

  return (
    <div className="app">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="main">
        <div className={`tab-panel${activeTab === 'dashboard' ? ' active' : ''}`} id="panel-dashboard">
          <DashboardPanel />
        </div>
        <div className={`tab-panel${activeTab === 'plano' ? ' active' : ''}`} id="panel-plano">
          <PlanoAnualPanel />
        </div>
        <div className={`tab-panel${activeTab === 'produtos' ? ' active' : ''}`} id="panel-produtos">
          <ProdutosMixPanel />
        </div>
        <div className={`tab-panel${activeTab === 'time' ? ' active' : ''}`} id="panel-time">
          <TimeVendasPanel />
        </div>
        <div className={`tab-panel${activeTab === 'funis' ? ' active' : ''}`} id="panel-funis">
          <FunisPanel />
        </div>
        <div className={`tab-panel${activeTab === 'rotina' ? ' active' : ''}`} id="panel-rotina">
          <RotinaPanel />
        </div>
      </main>
    </div>
  );
}

export default function App() {
  const { session, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;
  if (!session) return <AuthScreen />;

  return <MainApp />;
}
