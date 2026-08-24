export function EmptyState({ onOpenSettings }: { onOpenSettings: () => void }) {
  return (
    <div className="empty-state">
      Sätt upp dina max för knäböj, bänkpress, marklyft och militärpress
      <br />
      innan du kan börja logga träning.
      <br />
      <br />
      <button
        className="primary-btn"
        style={{ maxWidth: 260, margin: '0 auto' }}
        onClick={onOpenSettings}
      >
        Öppna inställningar
      </button>
    </div>
  );
}
