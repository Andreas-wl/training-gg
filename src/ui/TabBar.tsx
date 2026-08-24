import type { ReactNode } from 'react';

export interface TabBarItem {
  key: string;
  label: string;
  icon: ReactNode;
}

export function TabBar({
  items,
  active,
  onChange,
}: {
  items: TabBarItem[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4"
      style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
    >
      <div className="flex items-center gap-1 rounded-full bg-white/95 px-2 py-2 shadow-lg backdrop-blur">
        {items.map((item) => {
          const isActive = item.key === active;
          return (
            <button
              key={item.key}
              onClick={() => onChange(item.key)}
              className={`flex flex-col items-center gap-0.5 rounded-full px-5 py-1.5 text-xs font-medium transition-colors ${
                isActive ? 'text-accent' : 'text-dim'
              }`}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
