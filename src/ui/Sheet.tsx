import type { ReactNode } from 'react';

export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-[640px] flex-col overflow-y-auto rounded-t-3xl bg-app px-5 pb-10 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">{title}</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-dim shadow-sm"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
