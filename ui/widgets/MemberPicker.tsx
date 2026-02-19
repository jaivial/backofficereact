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
    <aside className="bo-memberPicker bo-memberPicker--glass" aria-label={title}>
      <div className="bo-memberPickerHead">
        <div className="bo-panelTitle">{title}</div>
        <div className="bo-memberPickerCount">{items.length}</div>
      </div>

      <label className="bo-memberPickerSearch bo-memberPickerSearch--glass" aria-label="Buscar miembro">
        <Search size={14} strokeWidth={1.8} />
        <input
          type="text"
          className="bo-memberPickerSearchInput"
          value={searchValue}
          onChange={(ev) => onSearchChange(ev.target.value)}
          placeholder="Buscar..."
        />
      </label>

      <div className="bo-memberPickerList">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`bo-memberPickerBtn bo-memberPickerBtn--glass${selectedId === item.id ? " is-active" : ""}`}
            onClick={() => onSelect(item.id)}
          >
            <span className="bo-memberPickerName">
              {item.name}
              {item.live ? <span className="bo-horariosLiveDot" aria-hidden="true" /> : null}
            </span>
            {item.meta ? <span className="bo-memberPickerMeta">{item.meta}</span> : null}
          </button>
        ))}

        {items.length === 0 ? <div className="bo-mutedText bo-memberPickerEmpty">{emptyLabel}</div> : null}
      </div>
    </aside>
  );
}
