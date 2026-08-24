import type { ReactNode } from 'react';

export function ListRow({
  title,
  subtitle,
  right,
  onClick,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 px-4 py-3 ${onClick ? 'cursor-pointer active:bg-app' : ''}`}
      onClick={onClick}
    >
      <div className="min-w-0">
        <div className="text-[15px] text-ink">{title}</div>
        {subtitle && <div className="mt-0.5 text-sm text-dim">{subtitle}</div>}
      </div>
      {right && <div className="flex-shrink-0 text-[15px] text-dim">{right}</div>}
    </div>
  );
}
