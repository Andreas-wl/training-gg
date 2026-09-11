import { useEffect, useState } from 'react';
import { useTraining } from '../state/TrainingProvider';
import { EmptyState } from './EmptyState';
import { TodayScreen } from './TodayScreen';
import { ExerciseScreen } from './ExerciseScreen';
import { HistoryScreen } from './HistoryScreen';
import { ProgramLibraryScreen } from './ProgramLibraryScreen';
import { SettingsSheet } from './SettingsSheet';
import { TabBar, type TabBarItem } from '../ui/TabBar';
import type { LiftKey } from '../domain/types';

type View = 'today' | 'history' | 'program';

const TABS: TabBarItem[] = [
  { key: 'today', label: 'Idag', icon: '🏠' },
  { key: 'history', label: 'Historik', icon: '📜' },
  { key: 'program', label: 'Program', icon: '📋' },
];

export function AppShell() {
  const { hasRequiredMaxes } = useTraining();
  const [view, setView] = useState<View>('today');
  const [settingsOpen, setSettingsOpen] = useState(false);
  // "En övning i taget" (PLAN.md #8.3): när en övning är öppen visas
  // ExerciseScreen ISTÄLLET FÖR dagöversikten, med egen header och utan
  // tab-bar (se PLAN.md #8.8) - byts via detta lokala state, ingen egen route.
  const [openLift, setOpenLift] = useState<LiftKey | null>(null);

  useEffect(() => {
    if (!hasRequiredMaxes) setSettingsOpen(true);
  }, [hasRequiredMaxes]);

  // Vyerna byts genom att byta ut innehållet i <main>, inte via routing - då
  // ligger scrollpositionen kvar från förra vyn, vilket läser som att appen
  // hakar upp sig (man landar mitt i en lista). Nolla den vid varje byte.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view, openLift]);

  const showExercise = view === 'today' && openLift != null && hasRequiredMaxes;

  return (
    <>
      {!showExercise && (
        <header className="flex items-start justify-between px-5 pb-2 pt-6">
          <h1 className="text-3xl font-bold text-ink">Styrkelogg</h1>
          <button
            className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-white text-ink shadow-sm"
            title="Inställningar"
            onClick={() => setSettingsOpen(true)}
          >
            ⚙️
          </button>
        </header>
      )}

      <main className="mx-auto max-w-[640px] px-4 pb-8">
        {!hasRequiredMaxes ? (
          <EmptyState onOpenSettings={() => setSettingsOpen(true)} />
        ) : view === 'today' ? (
          showExercise ? (
            <ExerciseScreen liftKey={openLift as LiftKey} onClose={() => setOpenLift(null)} onOpenLift={setOpenLift} />
          ) : (
            <TodayScreen onOpenLift={setOpenLift} />
          )
        ) : view === 'history' ? (
          <HistoryScreen />
        ) : (
          <ProgramLibraryScreen />
        )}
      </main>

      {!showExercise && (
        <TabBar
          items={TABS}
          active={view}
          onChange={(key) => {
            setView(key as View);
            setOpenLift(null);
          }}
        />
      )}

      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}
    </>
  );
}
