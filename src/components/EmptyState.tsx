import { Button } from '../ui/Button';

export function EmptyState({ onOpenSettings }: { onOpenSettings: () => void }) {
  return (
    <div className="px-4 py-12 text-center text-dim">
      <p className="text-[15px] leading-relaxed">
        Sätt upp dina max för knäböj, bänkpress, marklyft och militärpress
        <br />
        innan du kan börja logga träning.
      </p>
      <div className="mt-6 flex justify-center">
        <Button className="w-full max-w-[260px]" onClick={onOpenSettings}>
          Öppna inställningar
        </Button>
      </div>
    </div>
  );
}
