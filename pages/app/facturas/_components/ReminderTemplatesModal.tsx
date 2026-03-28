import React, { useCallback, useEffect, useMemo, useState } from "react";
import { X, Plus, Pencil, Trash2, Star, StarOff, Mail, MessageSquare, AlertCircle } from "lucide-react";
import type { ReminderTemplate, ReminderTemplateInput } from "../../../../api/types";
import { useToasts } from "../../../../ui/feedback/useToasts";
import { ConfirmDialog } from "../../../../ui/overlays/ConfirmDialog";
import { createClient } from "../../../../api/client";

interface ReminderTemplatesModalProps {
  open: boolean;
  onClose: () => void;
  onTemplatesChanged?: () => void;
}

const DEFAULT_EMAIL_TEMPLATE: ReminderTemplateInput = {
  name: "",
  subject: "Recordatorio de pago - Factura {invoice_number}",
  body: `Estimado/a {customer_name},

Le escribimos para recordarle que la factura #{invoice_number} por importe de {amount} EUR vence el {due_date}.

Por favor, proceda al pago a la mayor brevedad posible. Si ya ha realizado el pago, por favor ignore este mensaje.

Un saludo,
Equipo de Villa Carmen`,
  send_via: "email",
  is_default: false,
};

const DEFAULT_WHATSAPP_TEMPLATE: ReminderTemplateInput = {
  name: "",
  body: `Hola {customer_name}, te recordamos que la factura #{invoice_number} por {amount} EUR vence el {due_date}. Por favor, procede al pago. Un saludo, Villa Carmen`,
  send_via: "whatsapp",
  is_default: false,
};

export function ReminderTemplatesModal({ open, onClose, onTemplatesChanged }: ReminderTemplatesModalProps) {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();

  const [templates, setTemplates] = useState<ReminderTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Edit/Create form state
  const [isEditing, setIsEditing] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ReminderTemplate | null>(null);
  const [formData, setFormData] = useState<ReminderTemplateInput>({
    name: "",
    subject: "",
    body: "",
    send_via: "email",
    is_default: false,
  });

  // Delete confirmation
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<ReminderTemplate | null>(null);

  // Load templates
  useEffect(() => {
    if (!open) return;

    setLoading(true);
    api.reminderTemplates
      .list()
      .then((res) => {
        if (res.success) {
          setTemplates(res.templates);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [api, open]);

  const handleCreateNew = useCallback(() => {
    setEditingTemplate(null);
    setFormData(DEFAULT_EMAIL_TEMPLATE);
    setIsEditing(true);
  }, []);

  const handleEdit = useCallback((template: ReminderTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      subject: template.subject || "",
      body: template.body,
      send_via: template.send_via,
      is_default: template.is_default,
    });
    setIsEditing(true);
  }, []);

  const handleDelete = useCallback((template: ReminderTemplate) => {
    setTemplateToDelete(template);
    setDeleteConfirmOpen(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!templateToDelete) return;

    try {
      const res = await api.reminderTemplates.delete(templateToDelete.id);
      if (res.success) {
        pushToast({
          kind: "success",
          title: "Eliminado",
          message: `Plantilla "${templateToDelete.name}" eliminada`,
        });
        setTemplates((prev) => prev.filter((t) => t.id !== templateToDelete.id));
        onTemplatesChanged?.();
      } else {
        pushToast({
          kind: "error",
          title: "Error",
          message: res.message || "No se pudo eliminar la plantilla",
        });
      }
    } catch (e) {
      pushToast({
        kind: "error",
        title: "Error",
        message: e instanceof Error ? e.message : "Error desconocido",
      });
    } finally {
      setDeleteConfirmOpen(false);
      setTemplateToDelete(null);
    }
  }, [api, templateToDelete, pushToast, onTemplatesChanged]);

  const handleSetDefault = useCallback(async (template: ReminderTemplate) => {
    try {
      const res = await api.reminderTemplates.setDefault(template.id);
      if (res.success) {
        pushToast({
          kind: "success",
          title: "Plantilla predeterminada",
          message: `"${template.name}" ahora es la plantilla predeterminada`,
        });
        setTemplates((prev) =>
          prev.map((t) => ({
            ...t,
            is_default: t.id === template.id,
          }))
        );
        onTemplatesChanged?.();
      } else {
        pushToast({
          kind: "error",
          title: "Error",
          message: res.message || "No se pudo establecer la plantilla predeterminada",
        });
      }
    } catch (e) {
      pushToast({
        kind: "error",
        title: "Error",
        message: e instanceof Error ? e.message : "Error desconocido",
      });
    }
  }, [api, pushToast, onTemplatesChanged]);

  const handleSave = useCallback(async () => {
    if (!formData.name.trim()) {
      pushToast({
        kind: "error",
        title: "Error",
        message: "El nombre de la plantilla es obligatorio",
      });
      return;
    }

    setSaving(true);
    try {
      let res;
      if (editingTemplate) {
        res = await api.reminderTemplates.update(editingTemplate.id, formData);
      } else {
        res = await api.reminderTemplates.create(formData);
      }

      if (res.success) {
        pushToast({
          kind: "success",
          title: editingTemplate ? "Actualizado" : "Creado",
          message: editingTemplate
            ? `Plantilla "${formData.name}" actualizada`
            : `Plantilla "${formData.name}" creada`,
        });

        // Reload templates
        const listRes = await api.reminderTemplates.list();
        if (listRes.success) {
          setTemplates(listRes.templates);
        }

        setIsEditing(false);
        setEditingTemplate(null);
        onTemplatesChanged?.();
      } else {
        pushToast({
          kind: "error",
          title: "Error",
          message: res.message || "No se pudo guardar la plantilla",
        });
      }
    } catch (e) {
      pushToast({
        kind: "error",
        title: "Error",
        message: e instanceof Error ? e.message : "Error desconocido",
      });
    } finally {
      setSaving(false);
    }
  }, [api, editingTemplate, formData, pushToast, onTemplatesChanged]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditingTemplate(null);
  }, []);

  const handleTemplateTypeChange = useCallback((type: "email" | "whatsapp") => {
    const template = type === "email" ? DEFAULT_EMAIL_TEMPLATE : DEFAULT_WHATSAPP_TEMPLATE;
    setFormData((prev) => ({
      ...prev,
      ...template,
      name: prev.name,
    }));
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="rounded-lg bg-card shadow-soft max-w-lg w-full bo-modal--lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border">
          <h2 className="text-lg font-semibold text-foreground">Plantillas de recordatorios</h2>
          <button
            className="inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-white/[0.06] bg-transparent text-foreground text-xs font-bold transition-all hover:bg-white/[0.04]"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4">
          {isEditing ? (
            // Edit/Create Form
            <div className="bo-templateForm">
              <div className="grid gap-2">
                <label className="text-sm font-semibold text-muted-foreground" htmlFor="template-name">
                  Nombre de la plantilla
                </label>
                <input
                  id="template-name"
                  className="h-10 rounded-md border border bg-white/5 text-foreground px-3 outline-none min-w-0 transition-colors"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="ej: Recordatorio primera semana"
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-semibold text-muted-foreground">Tipo de envio</label>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="template_type"
                      value="email"
                      checked={formData.send_via === "email"}
                      onChange={() => handleTemplateTypeChange("email")}
                    />
                    <Mail size={14} />
                    <span>Email</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="template_type"
                      value="whatsapp"
                      checked={formData.send_via === "whatsapp"}
                      onChange={() => handleTemplateTypeChange("whatsapp")}
                    />
                    <MessageSquare size={14} />
                    <span>WhatsApp</span>
                  </label>
                </div>
              </div>

              {formData.send_via === "email" && (
                <div className="grid gap-2">
                  <label className="text-sm font-semibold text-muted-foreground" htmlFor="template-subject">
                    Asunto
                  </label>
                  <input
                    id="template-subject"
                    className="h-10 rounded-md border border bg-white/5 text-foreground px-3 outline-none min-w-0 transition-colors"
                    value={formData.subject || ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, subject: e.target.value }))}
                    placeholder="Recordatorio de pago - Factura {invoice_number}"
                  />
                  <div className="bo-fieldHelp">
                    Usa {"{customer_name}"}, {"{invoice_number}"}, {"{amount}"}, {"{due_date}"} como variables
                  </div>
                </div>
              )}

              <div className="grid gap-2">
                <label className="text-sm font-semibold text-muted-foreground" htmlFor="template-body">
                  Cuerpo del mensaje
                </label>
                <textarea
                  id="template-body"
                  className="min-h-[80px] rounded-md border border bg-white/5 text-foreground p-3 outline-none"
                  value={formData.body}
                  onChange={(e) => setFormData((prev) => ({ ...prev, body: e.target.value }))}
                  rows={8}
                />
                <div className="bo-fieldHelp">
                  Usa {"{customer_name}"}, {"{invoice_number}"}, {"{amount}"}, {"{due_date}"} como variables
                </div>
              </div>

              <div className="bo-formActions">
                <button className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-transparent text-foreground text-sm font-bold transition-all hover:bg-white/[0.04]" onClick={handleCancelEdit}>
                  Cancelar
                </button>
                <button
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[rgba(185,168,255,0.30)] bg-[rgba(185,168,255,0.16)] text-foreground text-sm font-bold transition-all hover:border-[rgba(185,168,255,0.40)] hover:bg-[rgba(185,168,255,0.24)] disabled:opacity-55 disabled:cursor-not-allowed mx-auto"
                  onClick={handleSave}
                  disabled={saving || !formData.name.trim()}
                >
                  {saving ? "Guardando..." : editingTemplate ? "Actualizar" : "Crear"}
                </button>
              </div>
            </div>
          ) : (
            // Templates List
            <>
              <div className="bo-templatesHeader">
                <button className="inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-[rgba(185,168,255,0.30)] bg-[rgba(185,168,255,0.16)] text-foreground text-xs font-bold transition-all hover:border-[rgba(185,168,255,0.40)] hover:bg-[rgba(185,168,255,0.24)] disabled:opacity-55 disabled:cursor-not-allowed" onClick={handleCreateNew}>
                  <Plus size={16} />
                  Nueva plantilla
                </button>
              </div>

              {loading && (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <div className="animate-spin h-5 w-5" />
                  <span>Cargando plantillas...</span>
                </div>
              )}

              {!loading && templates.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-muted-foreground text-center gap-3">
                  <AlertCircle size={32} />
                  <p>No hay plantillas de recordatorios</p>
                  <span className="text-mutedText">
                    Crea tu primera plantilla para enviar recordatorios de pago
                  </span>
                </div>
              )}

              {!loading && templates.length > 0 && (
                <div className="bo-templatesList">
                  {templates.map((template) => (
                    <div key={template.id} className="bo-templateItem">
                      <div className="bo-templateItemHeader">
                        <div className="bo-templateItemInfo">
                          <span className="bo-templateItemName">{template.name}</span>
                          <span className="bo-templateItemType">
                            {template.send_via === "email" ? (
                              <><Mail size={12} /> Email</>
                            ) : (
                              <><MessageSquare size={12} /> WhatsApp</>
                            )}
                          </span>
                          {template.is_default && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-[var(--text-success)]/[0.14] text-[var(--text-success)] border-[var(--text-success)]/[0.30]">
                              <Star size={10} />
                              Predeterminada
                            </span>
                          )}
                        </div>
                        <div className="bo-templateItemActions">
                          {!template.is_default && (
                            <button
                              className="inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-white/[0.06] bg-transparent text-foreground text-xs font-bold transition-all hover:bg-white/[0.04]"
                              onClick={() => handleSetDefault(template)}
                              title="Establecer como predeterminada"
                            >
                              <StarOff size={14} />
                            </button>
                          )}
                          <button
                            className="inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-white/[0.06] bg-transparent text-foreground text-xs font-bold transition-all hover:bg-white/[0.04]"
                            onClick={() => handleEdit(template)}
                            title="Editar"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            className="h-9 px-4 rounded-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer bg-transparent border border-transparent hover:bg-white/5 bg-transparent text-sm text-danger/80"
                            onClick={() => handleDelete(template)}
                            title="Eliminar"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="bo-templateItemPreview">
                        {template.subject && <div className="bo-templateItemSubject">{template.subject}</div>}
                        <div className="bo-templateItemBody">{template.body.substring(0, 150)}...</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Delete Confirmation */}
        <ConfirmDialog
          open={deleteConfirmOpen}
          title="Eliminar plantilla"
          message={`Estas seguro de que quieres eliminar la plantilla "${templateToDelete?.name}"? Esta accion no se puede deshacer.`}
          confirmText="Eliminar"
          cancelText="Cancelar"
          danger
          onClose={() => setDeleteConfirmOpen(false)}
          onConfirm={confirmDelete}
        />
      </div>
    </div>
  );
}
