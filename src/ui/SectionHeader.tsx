import type { ReactNode } from 'react';

export function SectionHeader({
  title,
  onAction,
  actionLabel = '+',
}: {
  title: string;
  onAction?: () => void;
  actionLabel?: ReactNode;
}) {
  return (
    <div className="mb-2 mt-5 flex items-center justify-between px-1 first:mt-0">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-dim">{title}</h2>
      {onAction && (
        <button
          onClick={onAction}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-base text-ink shadow-sm"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
