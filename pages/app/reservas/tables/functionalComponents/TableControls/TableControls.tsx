import React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronLeft, Ellipsis, Plus, Pencil, LayoutGrid } from "lucide-react";

interface TopControlsProps {
  onBack: () => void;
  onToggleMenu: () => void;
  onOpenAddModal: () => void;
  onToggleDrawMode: () => void;
  onOpenRightSheet: () => void;
  menuVisible: boolean;
  menuTooltipStyle: React.CSSProperties;
  rightSheetOpen: boolean;
  mapMode: "tables" | "draw";
  floorTabs: Array<{ floorNumber: number; label: string }>;
  selectedFloor: number;
  onFloorChange: (floor: number) => void;
  occupancy: { totalPeople: number; limit: number; percent: number };
}

export function TopControls({
  onBack,
  onToggleMenu,
  onOpenAddModal,
  onToggleDrawMode,
  onOpenRightSheet,
  menuVisible,
  menuTooltipStyle,
  rightSheetOpen,
  mapMode,
  floorTabs,
  selectedFloor,
  onFloorChange,
  occupancy,
}: TopControlsProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div data-ui="top-controls" className="bo-tableMapTopControls">
      <button data-ui="back-btn" className="bo-actionBtn bo-actionBtn--glass" type="button" onClick={onBack} aria-label="Volver a reservas">
        <ChevronLeft size={18} strokeWidth={1.8} />
      </button>

      <div data-ui="top-center" className="bo-tableMapTopCenter">
        <button
          data-ui="menu-trigger"
          className="bo-actionBtn bo-actionBtn--glass"
          type="button"
          aria-label="Abrir menú de mapa"
          aria-expanded={menuVisible}
          onClick={onToggleMenu}
        >
          <Ellipsis size={18} strokeWidth={1.8} />
        </button>

        <AnimatePresence>
          {menuVisible ? (
            <motion.div
              data-ui="map-menu-tooltip"
              className="bo-tableMapTooltip"
              role="menu"
              aria-label="Opciones del mapa"
              style={menuTooltipStyle}
              initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.16, ease: "easeInOut" }}
            >
              <div data-slot="tooltip-head" className="bo-tableMapTooltipHead">
                <div data-ui="tooltip-title" className="bo-tableMapTooltipTitle">Mapa de mesas</div>
                <div data-ui="tooltip-subtitle" className="bo-tableMapTooltipSub">Acciones rapidas</div>
              </div>

              <div data-slot="tooltip-actions" className="bo-tableMapTooltipActions" role="group" aria-label="Acciones de mapa">
                <button data-ui="add-table-btn" className="bo-menuItem" type="button" onClick={onOpenAddModal} role="menuitem">
                  <span data-ui="menu-icon" className="bo-menuIcon" aria-hidden="true">
                    <Plus size={16} strokeWidth={1.8} />
                  </span>
                  <span data-ui="menu-label" className="bo-menuLabel">Añadir mesa</span>
                </button>

                <button data-ui="toggle-draw-btn" className="bo-menuItem" type="button" onClick={onToggleDrawMode} role="menuitem">
                  <span data-ui="menu-icon" className="bo-menuIcon" aria-hidden="true">
                    <Pencil size={16} strokeWidth={1.8} />
                  </span>
                  <span data-ui="menu-label" className="bo-menuLabel">{mapMode === "draw" ? "Salir de dibujo" : "Dibujar"}</span>
                </button>
              </div>

              <div data-slot="tooltip-stats" className="bo-tableMapTooltipStats" aria-label="Resumen del día">
                <div data-ui="stat-people">
                  Personas / Límite: <strong data-ui="people-value">{occupancy.totalPeople} / {occupancy.limit || "-"}</strong>
                </div>
                <div data-ui="stat-occupancy">
                  Ocupación: <strong data-ui="occupancy-value">{occupancy.percent}%</strong>
                </div>
              </div>

              {floorTabs.length > 1 ? (
                <div data-ui="floor-tabs" className="bo-tableMapFloorTabs" role="tablist" aria-label="Seleccionar planta">
                  {floorTabs.map((f) => {
                    const active = f.floorNumber === selectedFloor;
                    return (
                      <button
                        key={f.floorNumber}
                        data-ui="floor-tab"
                        type="button"
                        className={`bo-tableMapFloorTab${active ? " is-active" : ""}`}
                        role="tab"
                        aria-selected={active}
                        onClick={() => onFloorChange(f.floorNumber)}
                      >
                        {f.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
      <div data-ui="top-right" className="bo-tableMapTopRight">
        <button
          data-ui="add-table-top-btn"
          className="bo-actionBtn bo-actionBtn--glass"
          type="button"
          aria-label="Añadir mesa"
          onClick={onOpenAddModal}
        >
          <Plus size={18} strokeWidth={1.8} />
        </button>
        <div
          data-ui="draw-trigger"
          className="bo-tableMapDrawTrigger"
          onMouseEnter={() => {}}
          onMouseLeave={() => {}}
        >
          <button
            data-ui="draw-mode-btn"
            className={`bo-actionBtn bo-actionBtn--glass${mapMode === "draw" ? " is-active" : ""}`}
            type="button"
            aria-label="Modo dibujo"
            onClick={onToggleDrawMode}
          >
            <Pencil size={18} strokeWidth={1.8} />
          </button>
        </div>
        {!rightSheetOpen ? (
          <button
            data-ui="open-right-panel-btn"
            className="bo-actionBtn bo-actionBtn--glass"
            type="button"
            aria-label="Abrir panel derecho"
            aria-expanded={rightSheetOpen}
            onClick={onOpenRightSheet}
          >
            <LayoutGrid size={18} strokeWidth={1.8} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
