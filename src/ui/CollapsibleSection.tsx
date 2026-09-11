import { useState, type ReactNode } from 'react';
import { Card } from './Card';

// Dagvyns kringblock (mobility, explosivt, tillägg) är fria textrader och tar
// mycket höjd - fullt utfällda trycker de ner själva SBS-lyften, som är det
// man faktiskt kommer till appen för. Därför är de ihopfällda som standard och
// visar bara en sammanfattning; tomma block fälls ut så de går att upptäcka.
//
// Radernas inputs sparas på onBlur, och blur hinner före att blocket fälls
// ihop (klicket flyttar fokus först), så inget inskrivet tappas.
export function CollapsibleSection({
  title,
  summary,
  onAction,
  children,
  defaultOpen = false,
}: {
  title: string;
  summary: string;
  onAction?: () => void;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="mb-4">
      <div className="mb-2 mt-5 flex items-center justify-between gap-2 px-1 first:mt-0">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-dim">{title}</h2>
        {onAction && (
          <button
            onClick={() => {
              setOpen(true);
              onAction();
            }}
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-white text-base text-ink shadow-sm"
            title="Lägg till övning"
          >
            +
          </button>
        )}
      </div>

      {open ? (
        <Card className="p-4">
          <button
            className="mb-3 flex w-full items-center justify-between gap-2 text-left text-xs text-dim"
            onClick={() => setOpen(false)}
          >
            <span className="truncate">{summary}</span>
            <span className="flex-shrink-0">Fäll ihop ▴</span>
          </button>
          {children}
        </Card>
      ) : (
        <Card
          className="flex cursor-pointer items-center justify-between gap-2 p-4 active:bg-app"
          onClick={() => setOpen(true)}
        >
          <span className="truncate text-sm text-dim">{summary}</span>
          <span className="flex-shrink-0 text-sm text-dim">▾</span>
        </Card>
      )}
    </div>
  );
}
