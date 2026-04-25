import React, { useCallback, useEffect, useMemo, useState } from "react";
import { X, Plus, Pencil, Trash2, Star, StarOff, Mail, MessageSquare, AlertCircle } from "lucide-react";
import { ModalHeader } from "../../../../ui/overlays/ModalHeader";
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
    <div className="bo-modal-overlay" onClick={onClose} data-slot="reminderTemplatesModal-modal-overlay">
      <div className="bo-modal bo-modal--lg" onClick={(e) => e.stopPropagation()} data-slot="reminderTemplatesModal-modal--lg">
        <ModalHeader title="Plantillas de recordatorios" onClose={onClose} />

        <div className="bo-modalBody" data-slot="reminderTemplatesModal-modalBody">
          {isEditing ? (
            // Edit/Create Form
            <div className="bo-templateForm" data-slot="reminderTemplatesModal-templateForm">
              <div className="bo-field" data-slot="reminderTemplatesModal-field">
                <label className="bo-label" htmlFor="template-name" data-slot="reminderTemplatesModal-label">
                  Nombre de la plantilla
                </label>
                <input
                  id="template-name"
                  className="bo-input"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="ej: Recordatorio primera semana"
                  data-testid="reminder-template-name-input"
                />
              </div>

              <div className="bo-field" data-slot="reminderTemplatesModal-field">
                <label className="bo-label" data-slot="reminderTemplatesModal-label">Tipo de envio</label>
                <div className="bo-radioGroup" data-slot="reminderTemplatesModal-radioGroup">
                  <label className="bo-radio" data-slot="reminderTemplatesModal-radio">
                    <input
                      type="radio"
                      name="template_type"
                      value="email"
                      checked={formData.send_via === "email"}
                      onChange={() => handleTemplateTypeChange("email")}
                      data-testid="reminder-template-type-email"
                    />
                    <Mail size={14} />
                    <span data-slot="reminderTemplatesModal-ail">Email</span>
                  </label>
                  <label className="bo-radio" data-slot="reminderTemplatesModal-radio">
                    <input
                      type="radio"
                      name="template_type"
                      value="whatsapp"
                      checked={formData.send_via === "whatsapp"}
                      onChange={() => handleTemplateTypeChange("whatsapp")}
                      data-testid="reminder-template-type-whatsapp"
                    />
                    <MessageSquare size={14} />
                    <span data-slot="reminderTemplatesModal-app">WhatsApp</span>
                  </label>
                </div>
              </div>

              {formData.send_via === "email" && (
                <div className="bo-field" data-slot="reminderTemplatesModal-field">
                  <label className="bo-label" htmlFor="template-subject" data-slot="reminderTemplatesModal-label">
                    Asunto
                  </label>
                  <input
                    id="template-subject"
                    className="bo-input"
                    value={formData.subject || ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, subject: e.target.value }))}
                    placeholder="Recordatorio de pago - Factura {invoice_number}"
                    data-testid="reminder-template-subject-input"
                  />
                  <div className="bo-fieldHelp" data-slot="reminderTemplatesModal-fieldHelp">
                    Usa {"{customer_name}"}, {"{invoice_number}"}, {"{amount}"}, {"{due_date}"} como variables
                  </div>
                </div>
              )}

              <div className="bo-field" data-slot="reminderTemplatesModal-field">
                <label className="bo-label" htmlFor="template-body" data-slot="reminderTemplatesModal-label">
                  Cuerpo del mensaje
                </label>
                <textarea
                  id="template-body"
                  className="bo-textarea"
                  value={formData.body}
                  onChange={(e) => setFormData((prev) => ({ ...prev, body: e.target.value }))}
                  rows={8}
                  data-testid="reminder-template-body-textarea"
                />
                <div className="bo-fieldHelp" data-slot="reminderTemplatesModal-fieldHelp">
                  Usa {"{customer_name}"}, {"{invoice_number}"}, {"{amount}"}, {"{due_date}"} como variables
                </div>
              </div>

              <div className="bo-formActions" data-slot="reminderTemplatesModal-formActions">
                <button className="bo-btn bo-btn--ghost" onClick={handleCancelEdit} data-testid="reminder-template-cancel-edit">
                  Cancelar
                </button>
                <button
                  className="bo-btn bo-btn--primary"
                  onClick={handleSave}
                  disabled={saving || !formData.name.trim()}
                  data-testid="reminder-template-save"
                >
                  {saving ? "Guardando..." : editingTemplate ? "Actualizar" : "Crear"}
                </button>
              </div>
            </div>
          ) : (
            // Templates List
            <>
              <div className="bo-templatesHeader" data-slot="reminderTemplatesModal-templatesHeader">
                <button className="bo-btn bo-btn--primary bo-btn--sm" onClick={handleCreateNew} data-testid="reminder-template-new">
                  <Plus size={16} />
                  Nueva plantilla
                </button>
              </div>

              {loading && (
                <div className="bo-loadingState" data-slot="reminderTemplatesModal-loadingState">
                  <div className="bo-spinner" data-slot="reminderTemplatesModal-spinner" />
                  <span data-slot="reminderTemplatesModal-las">Cargando plantillas...</span>
                </div>
              )}

              {!loading && templates.length === 0 && (
                <div className="bo-emptyState" data-slot="reminderTemplatesModal-emptyState">
                  <AlertCircle size={32} />
                  <p data-slot="reminderTemplatesModal-ios">No hay plantillas de recordatorios</p>
                  <span className="bo-mutedText" data-slot="reminderTemplatesModal-mutedText">
                    Crea tu primera plantilla para enviar recordatorios de pago
                  </span>
                </div>
              )}

              {!loading && templates.length > 0 && (
                <div className="bo-templatesList" data-slot="reminderTemplatesModal-templatesList">
                  {templates.map((template) => (
                    <div key={template.id} className="bo-templateItem" data-slot="reminderTemplatesModal-templateItem">
                      <div className="bo-templateItemHeader" data-slot="reminderTemplatesModal-templateItemHeader">
                        <div className="bo-templateItemInfo" data-slot="reminderTemplatesModal-templateItemInfo">
                          <span className="bo-templateItemName" data-slot="reminderTemplatesModal-templateItemName">{template.name}</span>
                          <span className="bo-templateItemType" data-slot="reminderTemplatesModal-templateItemType">
                            {template.send_via === "email" ? (
                              <><Mail size={12} /> Email</>
                            ) : (
                              <><MessageSquare size={12} /> WhatsApp</>
                            )}
                          </span>
                          {template.is_default && (
                            <span className="bo-badge bo-badge--success bo-badge--sm" data-slot="reminderTemplatesModal-badge--sm">
                              <Star size={10} />
                              Predeterminada
                            </span>
                          )}
                        </div>
                        <div className="bo-templateItemActions" data-slot="reminderTemplatesModal-templateItemActions">
                          {!template.is_default && (
                            <button
                              className="bo-btn bo-btn--ghost bo-btn--sm"
                              onClick={() => handleSetDefault(template)}
                              title="Establecer como predeterminada"
                              data-testid={`reminder-template-set-default-${template.id}`}
                            >
                              <StarOff size={14} />
                            </button>
                          )}
                          <button
                            className="bo-btn bo-btn--ghost bo-btn--sm"
                            onClick={() => handleEdit(template)}
                            title="Editar"
                            data-testid={`reminder-template-edit-${template.id}`}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            className="bo-btn bo-btn--ghost bo-btn--sm bo-btn--danger"
                            onClick={() => handleDelete(template)}
                            title="Eliminar"
                            data-testid={`reminder-template-delete-${template.id}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="bo-templateItemPreview" data-slot="reminderTemplatesModal-templateItemPreview">
                        {template.subject && <div className="bo-templateItemSubject">{template.subject}</div>}
                        <div className="bo-templateItemBody" data-slot="reminderTemplatesModal-templateItemBody">{template.body.substring(0, 150)}...</div>
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
