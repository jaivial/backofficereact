import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";

import { createClient } from "../../../api/client";
import type { GroupMenu, GroupMenuSummary, MenuDish, MenuTable, MenuVisibilityItem, Postre, Vino } from "../../../api/types";
import { InlineAlert } from "../../../ui/feedback/InlineAlert";
import { useToasts } from "../../../ui/feedback/useToasts";
import { Select } from "../../../ui/inputs/Select";
import { DropdownMenu } from "../../../ui/inputs/DropdownMenu";
import { ConfirmDialog } from "../../../ui/overlays/ConfirmDialog";
import { Modal } from "../../../ui/overlays/Modal";

type PageData = {
  visibility: MenuVisibilityItem[];
  dia: MenuTable | null;
  error: string | null;
};

type ModuleKey = "dia" | "finde" | "postres" | "vinos" | "grupos" | "visibilidad";

const moduleOptions = [
  { value: "dia", label: "Menu del dia" },
  { value: "finde", label: "Menu finde" },
  { value: "postres", label: "Postres" },
  { value: "vinos", label: "Vinos" },
  { value: "grupos", label: "Menus de grupos" },
  { value: "visibilidad", label: "Visibilidad en web" },
] as const;

const ALERGENOS = [
  "Gluten",
  "Crustaceos",
  "Huevos",
  "Pescado",
  "Cacahuetes",
  "Soja",
  "Leche",
  "Frutos de cascara",
  "Apio",
  "Mostaza",
  "Sesamo",
  "Sulfitos",
  "Altramuces",
  "Moluscos",
];

function sortDishes(list: MenuDish[]): MenuDish[] {
  return [...list].sort((a, b) => {
    const ta = a.tipo || "";
    const tb = b.tipo || "";
    if (ta !== tb) return ta.localeCompare(tb);
    return a.num - b.num;
  });
}

export default function Page() {
  const pageContext = usePageContext();
  const data = pageContext.data as PageData;
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();

  const [module, setModule] = useState<ModuleKey>("dia");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(data.error);

  const [visibility, setVisibility] = useState<MenuVisibilityItem[]>(data.visibility || []);
  const [dia, setDia] = useState<MenuTable | null>(data.dia);
  const [finde, setFinde] = useState<MenuTable | null>(null);
  const [postres, setPostres] = useState<Postre[] | null>(null);
  const [vinos, setVinos] = useState<Vino[] | null>(null);
  const [groupMenus, setGroupMenus] = useState<GroupMenuSummary[] | null>(null);

  const loadVisibility = useCallback(async () => {
    const res = await api.menus.visibility.list();
    if (!res.success) throw new Error(res.message || "Error cargando visibilidad");
    setVisibility(res.menus);
  }, [api]);

  const loadDia = useCallback(async () => {
    const res = await api.menus.dia.get();
    if (!res.success) throw new Error(res.message || "Error cargando menu del dia");
    setDia(res.menu);
  }, [api]);

  const loadFinde = useCallback(async () => {
    const res = await api.menus.finde.get();
    if (!res.success) throw new Error(res.message || "Error cargando menu finde");
    setFinde(res.menu);
  }, [api]);

  const loadPostres = useCallback(async () => {
    const res = await api.menus.postres.list();
    if (!res.success) throw new Error(res.message || "Error cargando postres");
    setPostres(res.postres);
  }, [api]);

  const loadVinos = useCallback(async () => {
    const res = await api.menus.vinos.list();
    if (!res.success) throw new Error(res.message || "Error cargando vinos");
    setVinos(res.vinos);
  }, [api]);

  const loadGroupMenus = useCallback(async () => {
    const res = await api.menus.grupos.list();
    if (!res.success) throw new Error(res.message || "Error cargando menus de grupos");
    setGroupMenus(res.menus);
  }, [api]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (module === "dia") return;
      if (module === "finde" && finde) return;
      if (module === "postres" && postres) return;
      if (module === "vinos" && vinos) return;
      if (module === "grupos" && groupMenus) return;
      if (module === "visibilidad" && visibility.length) return;

      setBusy(true);
      setError(null);
      try {
        if (module === "finde") await loadFinde();
        else if (module === "postres") await loadPostres();
        else if (module === "vinos") await loadVinos();
        else if (module === "grupos") await loadGroupMenus();
        else if (module === "visibilidad") await loadVisibility();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error cargando datos");
      } finally {
        if (!cancelled) setBusy(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [finde, groupMenus, loadFinde, loadGroupMenus, loadPostres, loadVisibility, loadVinos, module, postres, visibility.length, vinos]);

  const onReload = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      if (module === "dia") await loadDia();
      else if (module === "finde") await loadFinde();
      else if (module === "postres") await loadPostres();
      else if (module === "vinos") await loadVinos();
      else if (module === "grupos") await loadGroupMenus();
      else await loadVisibility();
      pushToast({ kind: "success", title: "Actualizado" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error recargando");
    } finally {
      setBusy(false);
    }
  }, [loadDia, loadFinde, loadGroupMenus, loadPostres, loadVisibility, loadVinos, module, pushToast]);

  if (error) return <InlineAlert kind="error" title="Error" message={error} />;

  return (
    <section aria-label="Menus">
      <div className="bo-toolbar">
        <div className="bo-toolbarLeft">
          <Select value={module} onChange={(v) => setModule(v as ModuleKey)} options={moduleOptions as any} ariaLabel="Modulo menus" />
          <button className="bo-btn bo-btn--ghost" type="button" onClick={onReload} disabled={busy}>
            Recargar
          </button>
        </div>
        <div className="bo-toolbarRight">
          <div className="bo-mutedText">{busy ? "Cargando..." : ""}</div>
        </div>
      </div>

      {module === "visibilidad" ? (
        <MenuVisibilityEditor rows={visibility} busy={busy} onToggle={async (key, next) => {
          setBusy(true);
          try {
            const res = await api.menus.visibility.set(key, next);
            if (!res.success) {
              pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo actualizar" });
              return;
            }
            await loadVisibility();
            pushToast({ kind: "success", title: "Guardado" });
          } finally {
            setBusy(false);
          }
        }} />
      ) : null}

      {module === "dia" ? (
        <MenuTableEditor
          title="Menu Del Dia"
          menu={dia}
          busy={busy}
          onSetPrice={async (price) => {
            setBusy(true);
            try {
              const res = await api.menus.dia.setPrice(price);
              if (!res.success) throw new Error(res.message || "No se pudo guardar precio");
              await loadDia();
              pushToast({ kind: "success", title: "Guardado", message: "Precio actualizado" });
            } finally {
              setBusy(false);
            }
          }}
          onCreateDish={async (input) => {
            setBusy(true);
            try {
              const res = await api.menus.dia.createDish(input);
              if (!res.success) throw new Error(res.message || "No se pudo crear");
              await loadDia();
              pushToast({ kind: "success", title: "Creado" });
            } finally {
              setBusy(false);
            }
          }}
          onPatchDish={async (id, patch) => {
            setBusy(true);
            try {
              const res = await api.menus.dia.patchDish(id, patch);
              if (!res.success) throw new Error(res.message || "No se pudo actualizar");
              await loadDia();
              pushToast({ kind: "success", title: "Actualizado" });
            } finally {
              setBusy(false);
            }
          }}
          onDeleteDish={async (id) => {
            setBusy(true);
            try {
              const res = await api.menus.dia.deleteDish(id);
              if (!res.success) throw new Error(res.message || "No se pudo eliminar");
              await loadDia();
              pushToast({ kind: "success", title: "Eliminado" });
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}

      {module === "finde" ? (
        <MenuTableEditor
          title="Menu Finde"
          menu={finde}
          busy={busy}
          onSetPrice={async (price) => {
            setBusy(true);
            try {
              const res = await api.menus.finde.setPrice(price);
              if (!res.success) throw new Error(res.message || "No se pudo guardar precio");
              await loadFinde();
              pushToast({ kind: "success", title: "Guardado", message: "Precio actualizado" });
            } finally {
              setBusy(false);
            }
          }}
          onCreateDish={async (input) => {
            setBusy(true);
            try {
              const res = await api.menus.finde.createDish(input);
              if (!res.success) throw new Error(res.message || "No se pudo crear");
              await loadFinde();
              pushToast({ kind: "success", title: "Creado" });
            } finally {
              setBusy(false);
            }
          }}
          onPatchDish={async (id, patch) => {
            setBusy(true);
            try {
              const res = await api.menus.finde.patchDish(id, patch);
              if (!res.success) throw new Error(res.message || "No se pudo actualizar");
              await loadFinde();
              pushToast({ kind: "success", title: "Actualizado" });
            } finally {
              setBusy(false);
            }
          }}
          onDeleteDish={async (id) => {
            setBusy(true);
            try {
              const res = await api.menus.finde.deleteDish(id);
              if (!res.success) throw new Error(res.message || "No se pudo eliminar");
              await loadFinde();
              pushToast({ kind: "success", title: "Eliminado" });
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}

      {module === "postres" ? (
        <PostresEditor
          rows={postres || []}
          busy={busy}
          onCreate={async (input) => {
            setBusy(true);
            try {
              const res = await api.menus.postres.create(input);
              if (!res.success) throw new Error(res.message || "No se pudo crear");
              await loadPostres();
              pushToast({ kind: "success", title: "Creado" });
            } finally {
              setBusy(false);
            }
          }}
          onPatch={async (id, patch) => {
            setBusy(true);
            try {
              const res = await api.menus.postres.patch(id, patch);
              if (!res.success) throw new Error(res.message || "No se pudo actualizar");
              await loadPostres();
              pushToast({ kind: "success", title: "Actualizado" });
            } finally {
              setBusy(false);
            }
          }}
          onDelete={async (id) => {
            setBusy(true);
            try {
              const res = await api.menus.postres.delete(id);
              if (!res.success) throw new Error(res.message || "No se pudo eliminar");
              await loadPostres();
              pushToast({ kind: "success", title: "Eliminado" });
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}

      {module === "vinos" ? (
        <VinosEditor
          rows={vinos || []}
          busy={busy}
          onCreate={async (input) => {
            setBusy(true);
            try {
              const res = await api.menus.vinos.create(input);
              if (!res.success) throw new Error(res.message || "No se pudo crear");
              await loadVinos();
              pushToast({ kind: "success", title: "Creado" });
            } finally {
              setBusy(false);
            }
          }}
          onPatch={async (id, patch) => {
            setBusy(true);
            try {
              const res = await api.menus.vinos.patch(id, patch);
              if (!res.success) throw new Error(res.message || "No se pudo actualizar");
              await loadVinos();
              pushToast({ kind: "success", title: "Actualizado" });
            } finally {
              setBusy(false);
            }
          }}
          onDelete={async (id) => {
            setBusy(true);
            try {
              const res = await api.menus.vinos.delete(id);
              if (!res.success) throw new Error(res.message || "No se pudo eliminar");
              await loadVinos();
              pushToast({ kind: "success", title: "Eliminado" });
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}

      {module === "grupos" ? (
        <GroupMenusEditor
          rows={groupMenus || []}
          busy={busy}
          loadFull={api.menus.grupos.get}
          onCreate={api.menus.grupos.create}
          onUpdate={api.menus.grupos.update}
          onToggle={api.menus.grupos.toggle}
          onDelete={api.menus.grupos.delete}
          onRefresh={async () => {
            setBusy(true);
            try {
              await loadGroupMenus();
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}
    </section>
  );
}

function MenuVisibilityEditor({
  rows,
  busy,
  onToggle,
}: {
  rows: MenuVisibilityItem[];
  busy: boolean;
  onToggle: (menuKey: string, next: boolean) => Promise<void>;
}) {
  return (
    <div className="bo-tableWrap">
      <table className="bo-table" aria-label="Visibilidad menus">
        <thead>
          <tr>
            <th>Menu</th>
            <th>Key</th>
            <th>Activo</th>
            <th className="end" />
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.menuKey}>
              <td>{m.menuName}</td>
              <td>{m.menuKey}</td>
              <td>{m.isActive ? "Si" : "No"}</td>
              <td className="end">
                <button className="bo-btn bo-btn--ghost" type="button" disabled={busy} onClick={() => void onToggle(m.menuKey, !m.isActive)}>
                  {m.isActive ? "Ocultar" : "Mostrar"}
                </button>
              </td>
            </tr>
          ))}
          {!rows.length ? (
            <tr>
              <td colSpan={4} className="bo-mutedText">
                Sin datos
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function MenuTableEditor({
  title,
  menu,
  busy,
  onSetPrice,
  onCreateDish,
  onPatchDish,
  onDeleteDish,
}: {
  title: string;
  menu: MenuTable | null;
  busy: boolean;
  onSetPrice: (price: string) => Promise<void>;
  onCreateDish: (input: { tipo: string; descripcion: string; alergenos: string[]; active?: boolean }) => Promise<void>;
  onPatchDish: (id: number, patch: Partial<Pick<MenuDish, "tipo" | "descripcion" | "active">> & { alergenos?: string[] }) => Promise<void>;
  onDeleteDish: (id: number) => Promise<void>;
}) {
  const dishes = useMemo(() => sortDishes((menu?.dishes || []).filter((d) => d.tipo !== "PRECIO")), [menu?.dishes]);
  const price = useMemo(() => (menu?.price ? String(menu.price) : ""), [menu?.price]);

  const [priceDraft, setPriceDraft] = useState(price);
  useEffect(() => setPriceDraft(price), [price]);

  const [edit, setEdit] = useState<{ open: boolean; dish: MenuDish | null; mode: "create" | "edit" }>({ open: false, dish: null, mode: "create" });
  const [confirmDel, setConfirmDel] = useState<{ open: boolean; dish: MenuDish | null }>({ open: false, dish: null });

  return (
    <>
      <div className="bo-panel">
        <div className="bo-panelHead">
          <div className="bo-panelTitle">{title}</div>
          <div className="bo-panelMeta">{menu?.table || ""}</div>
        </div>
        <div className="bo-panelBody">
          <div className="bo-row">
            <div className="bo-field bo-field--inline">
              <div className="bo-label">Precio</div>
              <input className="bo-input bo-input--sm" value={priceDraft} onChange={(e) => setPriceDraft(e.target.value)} />
            </div>
            <button className="bo-btn bo-btn--primary" type="button" disabled={busy} onClick={() => void onSetPrice(priceDraft)}>
              Guardar precio
            </button>
            <button className="bo-btn bo-btn--ghost" type="button" disabled={busy} onClick={() => setEdit({ open: true, dish: null, mode: "create" })}>
              Nuevo plato
            </button>
          </div>
        </div>
      </div>

      <div className="bo-tableWrap" style={{ marginTop: 14 }}>
        <table className="bo-table" aria-label="Platos menu">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Descripcion</th>
              <th>Alergenos</th>
              <th>Activo</th>
              <th className="end" />
            </tr>
          </thead>
          <tbody>
            {dishes.map((d) => (
              <DishRow
                key={d.num}
                dish={d}
                busy={busy}
                onEdit={() => setEdit({ open: true, dish: d, mode: "edit" })}
                onToggle={() => void onPatchDish(d.num, { active: !d.active })}
                onDelete={() => setConfirmDel({ open: true, dish: d })}
              />
            ))}
            {!dishes.length ? (
              <tr>
                <td colSpan={5} className="bo-mutedText">
                  No hay platos.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <DishModal
        open={edit.open}
        mode={edit.mode}
        dish={edit.dish}
        onClose={() => setEdit({ open: false, dish: null, mode: "create" })}
        onSubmit={async (v) => {
          if (edit.mode === "create") await onCreateDish(v);
          else if (edit.dish) await onPatchDish(edit.dish.num, v);
          setEdit({ open: false, dish: null, mode: "create" });
        }}
      />

      <ConfirmDialog
        open={confirmDel.open}
        title="Eliminar plato"
        message={confirmDel.dish ? `Eliminar #${confirmDel.dish.num}?` : ""}
        confirmText="Eliminar"
        danger
        onClose={() => setConfirmDel({ open: false, dish: null })}
        onConfirm={() => {
          const d = confirmDel.dish;
          if (!d) return;
          void onDeleteDish(d.num).then(() => setConfirmDel({ open: false, dish: null }));
        }}
      />
    </>
  );
}

const DishRow = React.memo(function DishRow({
  dish,
  busy,
  onEdit,
  onToggle,
  onDelete,
}: {
  dish: MenuDish;
  busy: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <tr className={dish.active ? "" : "is-inactive"}>
      <td>{dish.tipo}</td>
      <td style={{ whiteSpace: "pre-wrap" }}>{dish.descripcion}</td>
      <td>{dish.alergenos?.length ? dish.alergenos.join(", ") : ""}</td>
      <td>{dish.active ? "Si" : "No"}</td>
      <td className="end">
        <DropdownMenu
          label="Acciones"
          items={[
            { id: "edit", label: "Editar", onSelect: onEdit },
            { id: "toggle", label: dish.active ? "Desactivar" : "Activar", onSelect: onToggle },
            { id: "del", label: "Eliminar", tone: "danger", onSelect: onDelete },
          ]}
        />
      </td>
    </tr>
  );
});

function DishModal({
  open,
  mode,
  dish,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "edit";
  dish: MenuDish | null;
  onClose: () => void;
  onSubmit: (v: { tipo: string; descripcion: string; alergenos: string[]; active: boolean }) => Promise<void>;
}) {
  const { pushToast } = useToasts();

  const [tipo, setTipo] = useState(dish?.tipo && dish.tipo !== "PRECIO" ? dish.tipo : "ENTRANTE");
  const [descripcion, setDescripcion] = useState(dish?.descripcion || "");
  const [active, setActive] = useState(dish?.active ?? true);
  const [alergenos, setAlergenos] = useState<string[]>(dish?.alergenos || []);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTipo(dish?.tipo && dish.tipo !== "PRECIO" ? dish.tipo : "ENTRANTE");
    setDescripcion(dish?.descripcion || "");
    setActive(dish?.active ?? true);
    setAlergenos(dish?.alergenos || []);
  }, [dish, open]);

  const tipoOptions = useMemo(
    () => [
      { value: "ENTRANTE", label: "Entrante" },
      { value: "PRINCIPAL", label: "Principal" },
      { value: "ARROZ", label: "Arroz" },
    ],
    [],
  );
  const activeOptions = useMemo(
    () => [
      { value: "1", label: "Activo" },
      { value: "0", label: "Inactivo" },
    ],
    [],
  );

  const toggleAlergeno = useCallback((a: string) => {
    setAlergenos((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  }, []);

  const submit = useCallback(async () => {
    const desc = descripcion.trim();
    if (!desc) {
      pushToast({ kind: "error", title: "Error", message: "Descripcion requerida" });
      return;
    }
    setSaving(true);
    try {
      if (mode === "create") {
        await onSubmit({ tipo, descripcion: desc, alergenos, active });
      } else {
        await onSubmit({ tipo, descripcion: desc, alergenos, active });
      }
    } finally {
      setSaving(false);
    }
  }, [active, alergenos, descripcion, mode, onSubmit, pushToast, tipo]);

  return (
    <Modal open={open} title={mode === "create" ? "Nuevo plato" : "Editar plato"} onClose={onClose}>
      <div className="bo-modalHead">
        <div className="bo-modalTitle">{mode === "create" ? "Nuevo plato" : `Editar #${dish?.num ?? ""}`}</div>
        <button className="bo-modalX" type="button" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      <div className="bo-modalBody">
        <div className="bo-form">
          <div className="bo-field">
            <div className="bo-label">Tipo</div>
            <Select value={tipo} onChange={setTipo} options={tipoOptions} ariaLabel="Tipo" />
          </div>

          <div className="bo-field">
            <div className="bo-label">Descripcion</div>
            <textarea className="bo-input bo-textarea" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </div>

          <div className="bo-field">
            <div className="bo-label">Estado</div>
            <Select value={active ? "1" : "0"} onChange={(v) => setActive(v === "1")} options={activeOptions} ariaLabel="Activo" />
          </div>

          <div className="bo-field">
            <div className="bo-label">Alergenos</div>
            <div className="bo-chips">
              {ALERGENOS.map((a) => {
                const on = alergenos.includes(a);
                return (
                  <button key={a} type="button" className={`bo-chip${on ? " is-on" : ""}`} onClick={() => toggleAlergeno(a)}>
                    {a}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="bo-modalActions">
        <button className="bo-btn bo-btn--ghost" type="button" onClick={onClose} disabled={saving}>
          Cancelar
        </button>
        <button className="bo-btn bo-btn--primary" type="button" onClick={() => void submit()} disabled={saving}>
          Guardar
        </button>
      </div>
    </Modal>
  );
}

function PostresEditor({
  rows,
  busy,
  onCreate,
  onPatch,
  onDelete,
}: {
  rows: Postre[];
  busy: boolean;
  onCreate: (input: { descripcion: string; alergenos: string[]; active?: boolean }) => Promise<void>;
  onPatch: (id: number, patch: Partial<{ descripcion: string; alergenos: string[]; active: boolean }>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const list = useMemo(() => [...rows].sort((a, b) => Number(b.active) - Number(a.active) || a.num - b.num), [rows]);
  const [edit, setEdit] = useState<{ open: boolean; row: Postre | null; mode: "create" | "edit" }>({ open: false, row: null, mode: "create" });
  const [confirmDel, setConfirmDel] = useState<{ open: boolean; row: Postre | null }>({ open: false, row: null });

  return (
    <>
      <div className="bo-panel">
        <div className="bo-panelHead">
          <div className="bo-panelTitle">Postres</div>
          <div className="bo-panelMeta">{list.length ? `${list.length} items` : ""}</div>
        </div>
        <div className="bo-panelBody bo-row">
          <button className="bo-btn bo-btn--ghost" type="button" disabled={busy} onClick={() => setEdit({ open: true, row: null, mode: "create" })}>
            Nuevo postre
          </button>
        </div>
      </div>

      <div className="bo-tableWrap" style={{ marginTop: 14 }}>
        <table className="bo-table" aria-label="Postres">
          <thead>
            <tr>
              <th>ID</th>
              <th>Descripcion</th>
              <th>Alergenos</th>
              <th>Activo</th>
              <th className="end" />
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.num} className={p.active ? "" : "is-inactive"}>
                <td>{p.num}</td>
                <td style={{ whiteSpace: "pre-wrap" }}>{p.descripcion}</td>
                <td>{p.alergenos?.length ? p.alergenos.join(", ") : ""}</td>
                <td>{p.active ? "Si" : "No"}</td>
                <td className="end">
                  <DropdownMenu
                    label="Acciones"
                    items={[
                      { id: "edit", label: "Editar", onSelect: () => setEdit({ open: true, row: p, mode: "edit" }) },
                      { id: "toggle", label: p.active ? "Desactivar" : "Activar", onSelect: () => void onPatch(p.num, { active: !p.active }) },
                      { id: "del", label: "Eliminar", tone: "danger", onSelect: () => setConfirmDel({ open: true, row: p }) },
                    ]}
                  />
                </td>
              </tr>
            ))}
            {!list.length ? (
              <tr>
                <td colSpan={5} className="bo-mutedText">
                  No hay postres.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <PostreModal
        open={edit.open}
        mode={edit.mode}
        row={edit.row}
        onClose={() => setEdit({ open: false, row: null, mode: "create" })}
        onSubmit={async (v) => {
          if (edit.mode === "create") await onCreate(v);
          else if (edit.row) await onPatch(edit.row.num, v as any);
          setEdit({ open: false, row: null, mode: "create" });
        }}
      />

      <ConfirmDialog
        open={confirmDel.open}
        title="Eliminar postre"
        message={confirmDel.row ? `Eliminar #${confirmDel.row.num}?` : ""}
        confirmText="Eliminar"
        danger
        onClose={() => setConfirmDel({ open: false, row: null })}
        onConfirm={() => {
          const p = confirmDel.row;
          if (!p) return;
          void onDelete(p.num).then(() => setConfirmDel({ open: false, row: null }));
        }}
      />
    </>
  );
}

function PostreModal({
  open,
  mode,
  row,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "edit";
  row: Postre | null;
  onClose: () => void;
  onSubmit: (v: { descripcion: string; alergenos: string[]; active: boolean }) => Promise<void>;
}) {
  const { pushToast } = useToasts();
  const [descripcion, setDescripcion] = useState(row?.descripcion || "");
  const [active, setActive] = useState(row?.active ?? true);
  const [alergenos, setAlergenos] = useState<string[]>(row?.alergenos || []);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDescripcion(row?.descripcion || "");
    setActive(row?.active ?? true);
    setAlergenos(row?.alergenos || []);
  }, [open, row]);

  const activeOptions = useMemo(
    () => [
      { value: "1", label: "Activo" },
      { value: "0", label: "Inactivo" },
    ],
    [],
  );

  const toggleAlergeno = useCallback((a: string) => {
    setAlergenos((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  }, []);

  const submit = useCallback(async () => {
    const desc = descripcion.trim();
    if (!desc) {
      pushToast({ kind: "error", title: "Error", message: "Descripcion requerida" });
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ descripcion: desc, alergenos, active });
    } finally {
      setSaving(false);
    }
  }, [active, alergenos, descripcion, onSubmit, pushToast]);

  return (
    <Modal open={open} title={mode === "create" ? "Nuevo postre" : "Editar postre"} onClose={onClose}>
      <div className="bo-modalHead">
        <div className="bo-modalTitle">{mode === "create" ? "Nuevo postre" : `Editar #${row?.num ?? ""}`}</div>
        <button className="bo-modalX" type="button" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      <div className="bo-modalBody">
        <div className="bo-form">
          <div className="bo-field">
            <div className="bo-label">Descripcion</div>
            <textarea className="bo-input bo-textarea" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </div>

          <div className="bo-field">
            <div className="bo-label">Estado</div>
            <Select value={active ? "1" : "0"} onChange={(v) => setActive(v === "1")} options={activeOptions} ariaLabel="Activo" />
          </div>

          <div className="bo-field">
            <div className="bo-label">Alergenos</div>
            <div className="bo-chips">
              {ALERGENOS.map((a) => {
                const on = alergenos.includes(a);
                return (
                  <button key={a} type="button" className={`bo-chip${on ? " is-on" : ""}`} onClick={() => toggleAlergeno(a)}>
                    {a}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="bo-modalActions">
        <button className="bo-btn bo-btn--ghost" type="button" onClick={onClose} disabled={saving}>
          Cancelar
        </button>
        <button className="bo-btn bo-btn--primary" type="button" onClick={() => void submit()} disabled={saving}>
          Guardar
        </button>
      </div>
    </Modal>
  );
}

function VinosEditor({
  rows,
  busy,
  onCreate,
  onPatch,
  onDelete,
}: {
  rows: Vino[];
  busy: boolean;
  onCreate: (input: any) => Promise<void>;
  onPatch: (id: number, patch: any) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [tipo, setTipo] = useState("");
  const [edit, setEdit] = useState<{ open: boolean; row: Vino | null; mode: "create" | "edit" }>({ open: false, row: null, mode: "create" });
  const [confirmDel, setConfirmDel] = useState<{ open: boolean; row: Vino | null }>({ open: false, row: null });

  const tipoOptions = useMemo(
    () => [
      { value: "", label: "Todos" },
      { value: "TINTO", label: "Tinto" },
      { value: "BLANCO", label: "Blanco" },
      { value: "CAVA", label: "Cava" },
    ],
    [],
  );

  const list = useMemo(() => {
    const base = rows || [];
    const filtered = tipo ? base.filter((v) => (v.tipo || "").toUpperCase() === tipo) : base;
    return [...filtered].sort((a, b) => (a.tipo || "").localeCompare(b.tipo || "") || (a.nombre || "").localeCompare(b.nombre || "") || a.num - b.num);
  }, [rows, tipo]);

  return (
    <>
      <div className="bo-panel">
        <div className="bo-panelHead">
          <div className="bo-panelTitle">Vinos</div>
          <div className="bo-panelMeta">{list.length ? `${list.length} items` : ""}</div>
        </div>
        <div className="bo-panelBody bo-row">
          <Select value={tipo} onChange={setTipo} options={tipoOptions} size="sm" ariaLabel="Tipo vino" />
          <button className="bo-btn bo-btn--ghost" type="button" disabled={busy} onClick={() => setEdit({ open: true, row: null, mode: "create" })}>
            Nuevo vino
          </button>
        </div>
      </div>

      <div className="bo-tableWrap" style={{ marginTop: 14 }}>
        <table className="bo-table" aria-label="Vinos">
          <thead>
            <tr>
              <th>ID</th>
              <th>Tipo</th>
              <th>Nombre</th>
              <th className="num">Precio</th>
              <th>Activo</th>
              <th className="end" />
            </tr>
          </thead>
          <tbody>
            {list.map((v) => (
              <tr key={v.num} className={v.active ? "" : "is-inactive"}>
                <td>{v.num}</td>
                <td>{v.tipo}</td>
                <td>{v.nombre}</td>
                <td className="num">{Number(v.precio || 0).toFixed(2)}</td>
                <td>{v.active ? "Si" : "No"}</td>
                <td className="end">
                  <DropdownMenu
                    label="Acciones"
                    items={[
                      { id: "edit", label: "Editar", onSelect: () => setEdit({ open: true, row: v, mode: "edit" }) },
                      { id: "toggle", label: v.active ? "Desactivar" : "Activar", onSelect: () => void onPatch(v.num, { active: !v.active }) },
                      { id: "del", label: "Eliminar", tone: "danger", onSelect: () => setConfirmDel({ open: true, row: v }) },
                    ]}
                  />
                </td>
              </tr>
            ))}
            {!list.length ? (
              <tr>
                <td colSpan={6} className="bo-mutedText">
                  No hay vinos.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <VinoModal
        open={edit.open}
        mode={edit.mode}
        row={edit.row}
        onClose={() => setEdit({ open: false, row: null, mode: "create" })}
        onSubmit={async (v) => {
          if (edit.mode === "create") await onCreate(v);
          else if (edit.row) await onPatch(edit.row.num, v);
          setEdit({ open: false, row: null, mode: "create" });
        }}
      />

      <ConfirmDialog
        open={confirmDel.open}
        title="Eliminar vino"
        message={confirmDel.row ? `Eliminar #${confirmDel.row.num}?` : ""}
        confirmText="Eliminar"
        danger
        onClose={() => setConfirmDel({ open: false, row: null })}
        onConfirm={() => {
          const v = confirmDel.row;
          if (!v) return;
          void onDelete(v.num).then(() => setConfirmDel({ open: false, row: null }));
        }}
      />
    </>
  );
}

function VinoModal({
  open,
  mode,
  row,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "edit";
  row: Vino | null;
  onClose: () => void;
  onSubmit: (v: any) => Promise<void>;
}) {
  const { pushToast } = useToasts();

  const [tipo, setTipo] = useState(row?.tipo || "TINTO");
  const [nombre, setNombre] = useState(row?.nombre || "");
  const [precio, setPrecio] = useState(String(row?.precio ?? ""));
  const [descripcion, setDescripcion] = useState(row?.descripcion || "");
  const [bodega, setBodega] = useState(row?.bodega || "");
  const [denom, setDenom] = useState(row?.denominacion_origen || "");
  const [graduacion, setGraduacion] = useState(String(row?.graduacion ?? ""));
  const [anyo, setAnyo] = useState(row?.anyo || "");
  const [active, setActive] = useState(row?.active ?? true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTipo(row?.tipo || "TINTO");
    setNombre(row?.nombre || "");
    setPrecio(String(row?.precio ?? ""));
    setDescripcion(row?.descripcion || "");
    setBodega(row?.bodega || "");
    setDenom(row?.denominacion_origen || "");
    setGraduacion(String(row?.graduacion ?? ""));
    setAnyo(row?.anyo || "");
    setActive(row?.active ?? true);
  }, [open, row]);

  const tipoOptions = useMemo(
    () => [
      { value: "TINTO", label: "Tinto" },
      { value: "BLANCO", label: "Blanco" },
      { value: "CAVA", label: "Cava" },
    ],
    [],
  );

  const activeOptions = useMemo(
    () => [
      { value: "1", label: "Activo" },
      { value: "0", label: "Inactivo" },
    ],
    [],
  );

  const submit = useCallback(async () => {
    const n = nombre.trim();
    const b = bodega.trim();
    const t = tipo.trim();
    const p = Number(precio);
    if (!n || !b || !t || !Number.isFinite(p) || p <= 0) {
      pushToast({ kind: "error", title: "Error", message: "Campos obligatorios: tipo, nombre, bodega, precio" });
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        tipo: t,
        nombre: n,
        precio: p,
        descripcion: descripcion.trim(),
        bodega: b,
        denominacion_origen: denom.trim(),
        graduacion: Number(graduacion) || 0,
        anyo: anyo.trim(),
        active,
      });
    } finally {
      setSaving(false);
    }
  }, [active, anyo, bodega, denom, descripcion, graduacion, nombre, onSubmit, precio, pushToast, tipo]);

  return (
    <Modal open={open} title={mode === "create" ? "Nuevo vino" : "Editar vino"} onClose={onClose}>
      <div className="bo-modalHead">
        <div className="bo-modalTitle">{mode === "create" ? "Nuevo vino" : `Editar #${row?.num ?? ""}`}</div>
        <button className="bo-modalX" type="button" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      <div className="bo-modalBody">
        <div className="bo-form">
          <div className="bo-field">
            <div className="bo-label">Tipo</div>
            <Select value={tipo} onChange={setTipo} options={tipoOptions} ariaLabel="Tipo vino" />
          </div>
          <div className="bo-field">
            <div className="bo-label">Nombre</div>
            <input className="bo-input" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div className="bo-field">
            <div className="bo-label">Bodega</div>
            <input className="bo-input" value={bodega} onChange={(e) => setBodega(e.target.value)} />
          </div>
          <div className="bo-field">
            <div className="bo-label">Precio</div>
            <input className="bo-input" value={precio} onChange={(e) => setPrecio(e.target.value)} />
          </div>
          <div className="bo-field">
            <div className="bo-label">Descripcion</div>
            <textarea className="bo-input bo-textarea" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </div>
          <div className="bo-field">
            <div className="bo-label">Denominacion de origen</div>
            <input className="bo-input" value={denom} onChange={(e) => setDenom(e.target.value)} />
          </div>
          <div className="bo-field">
            <div className="bo-label">Graduacion</div>
            <input className="bo-input" value={graduacion} onChange={(e) => setGraduacion(e.target.value)} />
          </div>
          <div className="bo-field">
            <div className="bo-label">Anyo</div>
            <input className="bo-input" value={anyo} onChange={(e) => setAnyo(e.target.value)} />
          </div>
          <div className="bo-field">
            <div className="bo-label">Estado</div>
            <Select value={active ? "1" : "0"} onChange={(v) => setActive(v === "1")} options={activeOptions} ariaLabel="Activo" />
          </div>
        </div>
      </div>

      <div className="bo-modalActions">
        <button className="bo-btn bo-btn--ghost" type="button" onClick={onClose} disabled={saving}>
          Cancelar
        </button>
        <button className="bo-btn bo-btn--primary" type="button" onClick={() => void submit()} disabled={saving}>
          Guardar
        </button>
      </div>
    </Modal>
  );
}

function GroupMenusEditor({
  rows,
  busy,
  loadFull,
  onCreate,
  onUpdate,
  onToggle,
  onDelete,
  onRefresh,
}: {
  rows: GroupMenuSummary[];
  busy: boolean;
  loadFull: (id: number) => Promise<any>;
  onCreate: (input: any) => Promise<any>;
  onUpdate: (id: number, input: any) => Promise<any>;
  onToggle: (id: number) => Promise<any>;
  onDelete: (id: number) => Promise<any>;
  onRefresh: () => Promise<void>;
}) {
  const { pushToast } = useToasts();
  const list = useMemo(() => [...rows].sort((a, b) => Number(b.active) - Number(a.active) || b.id - a.id), [rows]);

  const [edit, setEdit] = useState<{ open: boolean; menu: GroupMenu | null; mode: "create" | "edit" }>({ open: false, menu: null, mode: "create" });
  const [confirmDel, setConfirmDel] = useState<{ open: boolean; menu: GroupMenuSummary | null }>({ open: false, menu: null });

  const openCreate = useCallback(() => setEdit({ open: true, menu: null, mode: "create" }), []);
  const openEdit = useCallback(
    async (id: number) => {
      const res = await loadFull(id);
      if (!res.success) {
        pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo cargar" });
        return;
      }
      setEdit({ open: true, menu: res.menu as GroupMenu, mode: "edit" });
    },
    [loadFull, pushToast],
  );

  return (
    <>
      <div className="bo-panel">
        <div className="bo-panelHead">
          <div className="bo-panelTitle">Menus de grupos</div>
          <div className="bo-panelMeta">{list.length ? `${list.length} menus` : ""}</div>
        </div>
        <div className="bo-panelBody bo-row">
          <button className="bo-btn bo-btn--ghost" type="button" disabled={busy} onClick={openCreate}>
            Nuevo menu de grupo
          </button>
          <button className="bo-btn bo-btn--ghost" type="button" disabled={busy} onClick={() => void onRefresh()}>
            Recargar
          </button>
        </div>
      </div>

      <div className="bo-tableWrap" style={{ marginTop: 14 }}>
        <table className="bo-table" aria-label="Menus de grupo">
          <thead>
            <tr>
              <th>ID</th>
              <th>Titulo</th>
              <th className="num">Precio</th>
              <th className="num">Min pax</th>
              <th>Activo</th>
              <th className="end" />
            </tr>
          </thead>
          <tbody>
            {list.map((m) => (
              <tr key={m.id} className={m.active ? "" : "is-inactive"}>
                <td>{m.id}</td>
                <td>{m.menu_title}</td>
                <td className="num">{m.price}</td>
                <td className="num">{m.min_party_size}</td>
                <td>{m.active ? "Si" : "No"}</td>
                <td className="end">
                  <DropdownMenu
                    label="Acciones"
                    items={[
                      { id: "edit", label: "Editar", onSelect: () => void openEdit(m.id) },
                      { id: "toggle", label: m.active ? "Desactivar" : "Activar", onSelect: () => void onToggle(m.id).then(onRefresh) },
                      { id: "del", label: "Eliminar", tone: "danger", onSelect: () => setConfirmDel({ open: true, menu: m }) },
                    ]}
                  />
                </td>
              </tr>
            ))}
            {!list.length ? (
              <tr>
                <td colSpan={6} className="bo-mutedText">
                  No hay menus.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <GroupMenuModal
        open={edit.open}
        mode={edit.mode}
        menu={edit.menu}
        onClose={() => setEdit({ open: false, menu: null, mode: "create" })}
        onSubmit={async (payload) => {
          if (edit.mode === "create") {
            const res = await onCreate(payload);
            if (!res.success) throw new Error(res.message || "No se pudo crear");
          } else if (edit.menu) {
            const res = await onUpdate(edit.menu.id, payload);
            if (!res.success) throw new Error(res.message || "No se pudo actualizar");
          }
          await onRefresh();
        }}
      />

      <ConfirmDialog
        open={confirmDel.open}
        title="Eliminar menu"
        message={confirmDel.menu ? `Eliminar #${confirmDel.menu.id} (${confirmDel.menu.menu_title})?` : ""}
        confirmText="Eliminar"
        danger
        onClose={() => setConfirmDel({ open: false, menu: null })}
        onConfirm={() => {
          const m = confirmDel.menu;
          if (!m) return;
          void onDelete(m.id).then(() => onRefresh()).then(() => setConfirmDel({ open: false, menu: null }));
        }}
      />
    </>
  );
}

function formatJSONCompact(v: any): string {
  try {
    return JSON.stringify(v ?? null, null, 2);
  } catch {
    return "null";
  }
}

function parseJSONOrThrow(raw: string): any {
  const t = raw.trim();
  if (!t) return null;
  return JSON.parse(t);
}

function GroupMenuModal({
  open,
  mode,
  menu,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "edit";
  menu: GroupMenu | null;
  onClose: () => void;
  onSubmit: (payload: any) => Promise<void>;
}) {
  const { pushToast } = useToasts();

  const [title, setTitle] = useState(menu?.menu_title || "");
  const [price, setPrice] = useState(menu?.price || "");
  const [minParty, setMinParty] = useState(String(menu?.min_party_size ?? 8));
  const [includedCoffee, setIncludedCoffee] = useState(menu?.included_coffee ?? false);
  const [active, setActive] = useState(menu?.active ?? true);
  const [mainLimit, setMainLimit] = useState(menu?.main_dishes_limit ?? false);
  const [mainLimitNum, setMainLimitNum] = useState(String(menu?.main_dishes_limit_number ?? 1));

  const [menuSubtitle, setMenuSubtitle] = useState(formatJSONCompact(menu?.menu_subtitle));
  const [entrantes, setEntrantes] = useState(formatJSONCompact(menu?.entrantes));
  const [principales, setPrincipales] = useState(formatJSONCompact(menu?.principales));
  const [postre, setPostre] = useState(formatJSONCompact(menu?.postre));
  const [beverage, setBeverage] = useState(formatJSONCompact(menu?.beverage));
  const [comments, setComments] = useState(formatJSONCompact(menu?.comments));

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(menu?.menu_title || "");
    setPrice(menu?.price || "");
    setMinParty(String(menu?.min_party_size ?? 8));
    setIncludedCoffee(menu?.included_coffee ?? false);
    setActive(menu?.active ?? true);
    setMainLimit(menu?.main_dishes_limit ?? false);
    setMainLimitNum(String(menu?.main_dishes_limit_number ?? 1));

    setMenuSubtitle(formatJSONCompact(menu?.menu_subtitle));
    setEntrantes(formatJSONCompact(menu?.entrantes));
    setPrincipales(formatJSONCompact(menu?.principales));
    setPostre(formatJSONCompact(menu?.postre));
    setBeverage(formatJSONCompact(menu?.beverage));
    setComments(formatJSONCompact(menu?.comments));
  }, [menu, open]);

  const boolOptions = useMemo(
    () => [
      { value: "1", label: "Si" },
      { value: "0", label: "No" },
    ],
    [],
  );

  const submit = useCallback(async () => {
    const t = title.trim();
    const p = Number(price);
    const mps = Number(minParty);
    const mln = Number(mainLimitNum);
    if (!t || !Number.isFinite(p) || p <= 0) {
      pushToast({ kind: "error", title: "Error", message: "Titulo y precio son requeridos" });
      return;
    }
    if (!Number.isFinite(mps) || mps <= 0) {
      pushToast({ kind: "error", title: "Error", message: "Min party size invalido" });
      return;
    }
    if (!Number.isFinite(mln) || mln <= 0) {
      pushToast({ kind: "error", title: "Error", message: "Main dishes limit number invalido" });
      return;
    }

    let payload: any;
    try {
      payload = {
        menu_title: t,
        price: p,
        included_coffee: includedCoffee,
        active,
        min_party_size: mps,
        main_dishes_limit: mainLimit,
        main_dishes_limit_number: mln,
        menu_subtitle: parseJSONOrThrow(menuSubtitle),
        entrantes: parseJSONOrThrow(entrantes),
        principales: parseJSONOrThrow(principales),
        postre: parseJSONOrThrow(postre),
        beverage: parseJSONOrThrow(beverage),
        comments: parseJSONOrThrow(comments),
      };
    } catch (e) {
      pushToast({ kind: "error", title: "JSON invalido", message: e instanceof Error ? e.message : "Revisa campos JSON" });
      return;
    }

    setSaving(true);
    try {
      await onSubmit(payload);
      pushToast({ kind: "success", title: "Guardado" });
      onClose();
    } catch (e) {
      pushToast({ kind: "error", title: "Error", message: e instanceof Error ? e.message : "No se pudo guardar" });
    } finally {
      setSaving(false);
    }
  }, [active, beverage, comments, entrantes, includedCoffee, mainLimit, mainLimitNum, menuSubtitle, minParty, onClose, onSubmit, postre, price, principales, pushToast, title]);

  return (
    <Modal open={open} title={mode === "create" ? "Nuevo menu de grupo" : "Editar menu de grupo"} onClose={onClose}>
      <div className="bo-modalHead">
        <div className="bo-modalTitle">{mode === "create" ? "Nuevo menu de grupo" : `Editar #${menu?.id ?? ""}`}</div>
        <button className="bo-modalX" type="button" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <div className="bo-modalBody">
        <div className="bo-form">
          <div className="bo-field">
            <div className="bo-label">Titulo</div>
            <input className="bo-input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="bo-field">
            <div className="bo-label">Precio</div>
            <input className="bo-input" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="bo-field">
            <div className="bo-label">Min party size</div>
            <input className="bo-input" value={minParty} onChange={(e) => setMinParty(e.target.value)} />
          </div>
          <div className="bo-field">
            <div className="bo-label">Incluye cafe</div>
            <Select value={includedCoffee ? "1" : "0"} onChange={(v) => setIncludedCoffee(v === "1")} options={boolOptions} ariaLabel="Incluye cafe" />
          </div>
          <div className="bo-field">
            <div className="bo-label">Activo</div>
            <Select value={active ? "1" : "0"} onChange={(v) => setActive(v === "1")} options={boolOptions} ariaLabel="Activo" />
          </div>
          <div className="bo-field">
            <div className="bo-label">Limite principales</div>
            <Select value={mainLimit ? "1" : "0"} onChange={(v) => setMainLimit(v === "1")} options={boolOptions} ariaLabel="Limite principales" />
          </div>
          <div className="bo-field">
            <div className="bo-label">Limite principales numero</div>
            <input className="bo-input" value={mainLimitNum} onChange={(e) => setMainLimitNum(e.target.value)} />
          </div>

          <div className="bo-field">
            <div className="bo-label">menu_subtitle (JSON)</div>
            <textarea className="bo-input bo-textarea" value={menuSubtitle} onChange={(e) => setMenuSubtitle(e.target.value)} />
          </div>
          <div className="bo-field">
            <div className="bo-label">entrantes (JSON)</div>
            <textarea className="bo-input bo-textarea" value={entrantes} onChange={(e) => setEntrantes(e.target.value)} />
          </div>
          <div className="bo-field">
            <div className="bo-label">principales (JSON)</div>
            <textarea className="bo-input bo-textarea" value={principales} onChange={(e) => setPrincipales(e.target.value)} />
          </div>
          <div className="bo-field">
            <div className="bo-label">postre (JSON)</div>
            <textarea className="bo-input bo-textarea" value={postre} onChange={(e) => setPostre(e.target.value)} />
          </div>
          <div className="bo-field">
            <div className="bo-label">beverage (JSON)</div>
            <textarea className="bo-input bo-textarea" value={beverage} onChange={(e) => setBeverage(e.target.value)} />
          </div>
          <div className="bo-field">
            <div className="bo-label">comments (JSON)</div>
            <textarea className="bo-input bo-textarea" value={comments} onChange={(e) => setComments(e.target.value)} />
          </div>
        </div>
      </div>
      <div className="bo-modalActions">
        <button className="bo-btn bo-btn--ghost" type="button" onClick={onClose} disabled={saving}>
          Cancelar
        </button>
        <button className="bo-btn bo-btn--primary" type="button" onClick={() => void submit()} disabled={saving}>
          Guardar
        </button>
      </div>
    </Modal>
  );
}
