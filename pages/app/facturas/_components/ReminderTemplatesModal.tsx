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
    <div className="bo-modal-overlay" onClick={onClose}>
      <div className="bo-modal bo-modal--lg" onClick={(e) => e.stopPropagation()}>
        <div className="bo-modalHeader">
          <h2 className="bo-modalTitle">Plantillas de recordatorios</h2>
          <button
            className="bo-btn bo-btn--ghost bo-btn--sm"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="bo-modalBody">
          {isEditing ? (
            // Edit/Create Form
            <div className="bo-templateForm">
              <div className="bo-field">
                <label className="bo-label" htmlFor="template-name">
                  Nombre de la plantilla
                </label>
                <input
                  id="template-name"
                  className="bo-input"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="ej: Recordatorio primera semana"
                />
              </div>

              <div className="bo-field">
                <label className="bo-label">Tipo de envio</label>
                <div className="bo-radioGroup">
                  <label className="bo-radio">
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
                  <label className="bo-radio">
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
                <div className="bo-field">
                  <label className="bo-label" htmlFor="template-subject">
                    Asunto
                  </label>
                  <input
                    id="template-subject"
                    className="bo-input"
                    value={formData.subject || ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, subject: e.target.value }))}
                    placeholder="Recordatorio de pago - Factura {invoice_number}"
                  />
                  <div className="bo-fieldHelp">
                    Usa {"{customer_name}"}, {"{invoice_number}"}, {"{amount}"}, {"{due_date}"} como variables
                  </div>
                </div>
              )}

              <div className="bo-field">
                <label className="bo-label" htmlFor="template-body">
                  Cuerpo del mensaje
                </label>
                <textarea
                  id="template-body"
                  className="bo-textarea"
                  value={formData.body}
                  onChange={(e) => setFormData((prev) => ({ ...prev, body: e.target.value }))}
                  rows={8}
                />
                <div className="bo-fieldHelp">
                  Usa {"{customer_name}"}, {"{invoice_number}"}, {"{amount}"}, {"{due_date}"} como variables
                </div>
              </div>

              <div className="bo-formActions">
                <button className="bo-btn bo-btn--ghost" onClick={handleCancelEdit}>
                  Cancelar
                </button>
                <button
                  className="bo-btn bo-btn--primary"
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
                <button className="bo-btn bo-btn--primary bo-btn--sm" onClick={handleCreateNew}>
                  <Plus size={16} />
                  Nueva plantilla
                </button>
              </div>

              {loading && (
                <div className="bo-loadingState">
                  <div className="bo-spinner" />
                  <span>Cargando plantillas...</span>
                </div>
              )}

              {!loading && templates.length === 0 && (
                <div className="bo-emptyState">
                  <AlertCircle size={32} />
                  <p>No hay plantillas de recordatorios</p>
                  <span className="bo-mutedText">
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
                            <span className="bo-badge bo-badge--success bo-badge--sm">
                              <Star size={10} />
                              Predeterminada
                            </span>
                          )}
                        </div>
                        <div className="bo-templateItemActions">
                          {!template.is_default && (
                            <button
                              className="bo-btn bo-btn--ghost bo-btn--sm"
                              onClick={() => handleSetDefault(template)}
                              title="Establecer como predeterminada"
                            >
                              <StarOff size={14} />
                            </button>
                          )}
                          <button
                            className="bo-btn bo-btn--ghost bo-btn--sm"
                            onClick={() => handleEdit(template)}
                            title="Editar"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            className="bo-btn bo-btn--ghost bo-btn--sm bo-btn--danger"
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
