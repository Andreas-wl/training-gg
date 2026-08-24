import { useEffect, useState } from 'react';
import { useTraining } from '../state/TrainingProvider';
import { EmptyState } from './EmptyState';
import { TodayScreen } from './TodayScreen';
import { HistoryScreen } from './HistoryScreen';
import { SettingsSheet } from './SettingsSheet';

type View = 'today' | 'history';

export function AppShell() {
  const { hasRequiredMaxes } = useTraining();
  const [view, setView] = useState<View>('today');
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (!hasRequiredMaxes) setSettingsOpen(true);
  }, [hasRequiredMaxes]);

  return (
    <>
      <header className="topbar">
        <h1>🏋️ Styrkelogg</h1>
        <button className="icon-btn" title="Inställningar" onClick={() => setSettingsOpen(true)}>
          ⚙️
        </button>
      </header>

      <nav className="tabs">
        <button
          className={`tab-btn ${view === 'today' ? 'active' : ''}`}
          onClick={() => setView('today')}
        >
          Idag
        </button>
        <button
          className={`tab-btn ${view === 'history' ? 'active' : ''}`}
          onClick={() => setView('history')}
        >
          Historik
        </button>
      </nav>

      <main id="app">
        {!hasRequiredMaxes ? (
          <EmptyState onOpenSettings={() => setSettingsOpen(true)} />
        ) : view === 'today' ? (
          <TodayScreen />
        ) : (
          <HistoryScreen />
        )}
      </main>

      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}
    </>
  );
}
