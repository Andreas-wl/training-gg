import { useRef, type ChangeEvent } from 'react';
import { useTraining } from '../state/TrainingProvider';
import { validateProgram } from '../domain/validateProgram';
import { Card } from '../ui/Card';
import { ListRow } from '../ui/ListRow';
import { Button } from '../ui/Button';

// Programbibliotek (PLAN.md #8.6/#10): lista program, byt aktivt, importera
// en egen JSON-fil (validerad, se validateProgram.ts) och exportera det
// aktuella programmet - ingen redigering av programinnehåll här.
export function ProgramLibraryScreen() {
  const { program, programs, switchProgram, importProgram, exportProgram } = useTraining();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    let data: unknown;
    try {
      const text = await file.text();
      data = JSON.parse(text);
    } catch {
      window.alert('Filen kunde inte tolkas som giltig JSON.');
      return;
    }

    const validated = validateProgram(data);
    if (!validated.ok) {
      window.alert(`Kunde inte importera programmet: ${validated.error}`);
      return;
    }

    const result = importProgram(validated.program);
    if (!result.ok) {
      window.alert(`Kunde inte importera programmet: ${result.error}`);
    }
  };

  return (
    <>
      <div className="mb-1">
        <h2 className="text-2xl font-bold text-ink">Program</h2>
        <p className="mt-0.5 text-sm text-dim">Välj vilket program du kör</p>
      </div>

      <Card className="my-4 divide-y divide-app">
        {programs.map((p) => {
          const isActive = p.id === program.id;
          return (
            <ListRow
              key={p.id}
              title={p.name}
              subtitle={`${Object.keys(p.lifts).length} lyft`}
              right={
                <span className={isActive ? 'text-accent' : 'text-dim'} aria-label={isActive ? 'Aktivt' : 'Inaktivt'}>
                  {isActive ? '●' : '○'}
                </span>
              }
              onClick={isActive ? undefined : () => switchProgram(p.id)}
            />
          );
        })}
      </Card>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={handleFileChange}
      />
      <Button variant="secondary" className="w-full" onClick={handleImportClick}>
        + Importera program (JSON)
      </Button>
      <Button variant="secondary" className="mt-3 w-full" onClick={() => exportProgram(program)}>
        Exportera aktuellt som JSON
      </Button>
    </>
  );
}
