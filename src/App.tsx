import { TrainingProvider } from './state/TrainingProvider';
import { AppShell } from './components/AppShell';

export default function App() {
  return (
    <TrainingProvider>
      <AppShell />
    </TrainingProvider>
  );
}
