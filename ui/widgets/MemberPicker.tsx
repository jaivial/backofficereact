import React from "react";
import { Search } from "lucide-react";

export type MemberPickerItem = {
  id: number;
  name: string;
  meta?: string;
  live?: boolean;
};

export function MemberPicker({
  title,
  searchValue,
  onSearchChange,
  items,
  selectedId,
  onSelect,
  emptyLabel,
}: {
  title: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  items: MemberPickerItem[];
  selectedId: number | null;
  onSelect: (memberId: number) => void;
  emptyLabel: string;
}) {
  return (
    <aside className="w-full h-full flex flex-col rounded-xl border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-black/[0.10]" aria-label={title}>
      <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
        <div className="text-sm font-semibold text-foreground">{title}</div>
        <div className="text-xs text-muted-foreground bg-white/[0.06] px-2 py-0.5 rounded">{items.length}</div>
      </div>

      <label className="flex items-center gap-2 p-3 mx-3 mt-3 rounded-lg border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-black/[0.10]" aria-label="Buscar miembro">
        <Search size={14} strokeWidth={1.8} />
        <input
          type="text"
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          value={searchValue}
          onChange={(ev) => onSearchChange(ev.target.value)}
          placeholder="Buscar..."
        />
      </label>

      <div className="flex-1 overflow-y-auto p-2">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`w-full text-left p-2 rounded-lg transition-colors hover:bg-white/[0.04] bg-white/[0.02] ${selectedId === item.id ? "bg-primary/20 border border-primary/30" : ""}`}
            onClick={() => onSelect(item.id)}
          >
            <span className="text-sm text-foreground flex items-center gap-2">
              {item.name}
              {item.live ? <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" aria-hidden="true" /> : null}
            </span>
            {item.meta ? <span className="text-xs text-muted-foreground">{item.meta}</span> : null}
          </button>
        ))}

        {items.length === 0 ? <div className="text-sm text-muted-foreground text-center py-8">{emptyLabel}</div> : null}
      </div>
    </aside>
  );
}
