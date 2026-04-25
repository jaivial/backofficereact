import React from "react";
import { Search } from "lucide-react";

import { cn } from "../shadcn/utils";

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
  className,
}: {
  title: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  items: MemberPickerItem[];
  selectedId: number | null;
  onSelect: (memberId: number) => void;
  emptyLabel: string;
  className?: string;
}) {
  return (
    <aside className={cn("bo-memberPicker bo-memberPicker--glass", className)} aria-label={title} data-testid="member-picker" data-slot="member-picker">
      <div className="bo-memberPickerHead" data-slot="member-picker-header">
        <div className="bo-panelTitle" data-slot="member-picker-title">{title}</div>
        <div className="bo-memberPickerCount" data-slot="member-picker-count">{items.length}</div>
      </div>

      <label className="bo-memberPickerSearch bo-memberPickerSearch--glass" aria-label="Buscar miembro" data-slot="member-picker-search-label">
        <Search size={14} strokeWidth={1.8} />
        <input
          type="text"
          className="bo-memberPickerSearchInput"
          value={searchValue}
          onChange={(ev) => onSearchChange(ev.target.value)}
          placeholder="Buscar..."
          data-testid="member-picker-input"
        />
      </label>

      <div className="bo-memberPickerList" data-slot="member-picker-list">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={cn("bo-memberPickerBtn", "bo-memberPickerBtn--glass", selectedId === item.id && "is-active")}
            onClick={() => onSelect(item.id)}
            data-testid="member-picker-item"
          >
            <span className="bo-memberPickerName" data-slot="member-picker-item-name">
              {item.name}
              {item.live ? <span className="bo-horariosLiveDot" aria-hidden="true" data-slot="member-picker-item-live" /> : null}
            </span>
            {item.meta ? <span className="bo-memberPickerMeta" data-slot="member-picker-item-meta">{item.meta}</span> : null}
          </button>
        ))}

        {items.length === 0 ? <div className="bo-mutedText bo-memberPickerEmpty" data-slot="member-picker-empty">{emptyLabel}</div> : null}
      </div>
    </aside>
  );
}
