import React, { useRef, useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Member } from "../../../../../../api/types";
import { fullName } from "../../../../../../lib/member";
import { ScrollArea } from "../../../../../../ui/layout/ScrollArea";

export type MemberSelectorProps = {
  members: Member[];
  selectedMemberId: number | null;
  onSelect: (id: number) => void;
  className?: string;
};

export function MemberSelector({
  members,
  selectedMemberId,
  onSelect,
  className = "",
}: MemberSelectorProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedMember = members.find((m) => m.id === selectedMemberId);
  const displayName = selectedMember ? fullName(selectedMember) : "Selecciona un miembro";

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  const handleSelect = (id: number) => {
    onSelect(id);
    setOpen(false);
  };

  return (
    <div
      ref={containerRef}
      data-ui="memberSelector"
      className={`relative ${className}`}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="bo-dateBtn bo-dateBtn--glass w-full flex items-center justify-between gap-2 px-3 py-2"
        aria-label="Selecciona un miembro"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate text-sm font-medium">{displayName}</span>
        <ChevronDown
          size={16}
          strokeWidth={1.8}
          className={`flex-shrink-0 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          className="absolute top-full left-0 right-0 mt-1 z-50 rounded-lg border border-solid shadow-lg"
          style={{
            background: "linear-gradient(140deg, color-mix(in srgb, var(--bo-accent) 8%, white), transparent 60%), linear-gradient(180deg, rgba(255, 255, 255, 0.88), rgba(242, 244, 251, 0.76)), color-mix(in srgb, var(--bo-surface) 90%, transparent)",
            boxShadow: "0 8px 24px rgba(124, 92, 231, 0.06), 0 2px 6px rgba(0, 0, 0, 0.04)",
            borderColor: "color-mix(in srgb, var(--bo-accent) 16%, var(--bo-border))",
          }}
          role="listbox"
          data-ui="memberSelectorDropdown"
        >
          <ScrollArea dataSlot="memberList" maxHeight="auto" className="max-h-80">
            <div className="space-y-1 p-2">
              {members.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => handleSelect(member.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-150 border border-transparent ${
                    selectedMemberId === member.id
                      ? "bg-[color-mix(in_srgb,var(--bo-accent)_18%,transparent)] border-[var(--bo-accent)] text-[var(--bo-text)] font-medium"
                      : "bg-transparent text-[var(--bo-muted)] hover:bg-[var(--bo-bg-hover)] hover:text-[var(--bo-text)]"
                  }`}
                  role="option"
                  aria-selected={selectedMemberId === member.id}
                >
                  {fullName(member)}
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
