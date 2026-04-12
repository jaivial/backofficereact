import React, { useCallback, useEffect, useState } from "react";
import { X, FileText, Plus, Search, Loader2, Trash2, Edit, Copy } from "lucide-react";
import { Modal } from "../../../../ui/overlays/Modal";
import { useToasts } from "../../../../ui/feedback/useToasts";
import type { InvoiceTemplate, InvoiceTemplateInput, PaymentMethod } from "../../../../api/types";
import { createClient } from "../../../../api/client";

interface SelectTemplateModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (template: InvoiceTemplate) => void;
}

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  bizum: "Bizum",
  cheque: "Cheque",
};

export function SelectTemplateModal({ open, onClose, onSelect }: SelectTemplateModalProps) {
  const { pushToast } = useToasts();
  const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<InvoiceTemplate | null>(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const api = createClient({ baseUrl: "" });
      const res = await api.invoiceTemplates.list();
      if (res.success) {
        setTemplates(res.templates);
      } else {
        pushToast({ kind: "error", title: "Error", message: "No se pudieron cargar las plantillas" });
      }
    } catch (e) {
      pushToast({ kind: "error", title: "Error", message: e instanceof Error ? e.message : "Error desconocido" });
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    if (open) {
      fetchTemplates();
    }
  }, [open, fetchTemplates]);

  const filteredTemplates = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(searchText.toLowerCase()) ||
      t.customer_name.toLowerCase().includes(searchText.toLowerCase()) ||
      t.customer_email.toLowerCase().includes(searchText.toLowerCase())
  );

  const handleSelect = useCallback(
    (template: InvoiceTemplate) => {
      onSelect(template);
      onClose();
    },
    [onSelect, onClose]
  );

  const handleDelete = useCallback(
    async (template: InvoiceTemplate, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!confirm(`¿Eliminar la plantilla "${template.name}"?`)) return;

      try {
        const api = createClient({ baseUrl: "" });
        const res = await api.invoiceTemplates.delete(template.id);
        if (res.success) {
          pushToast({ kind: "success", title: "Eliminado", message: "Plantilla eliminada correctamente" });
          fetchTemplates();
        } else {
          pushToast({ kind: "error", title: "Error", message: "No se pudo eliminar la plantilla" });
        }
      } catch (e) {
        pushToast({ kind: "error", title: "Error", message: e instanceof Error ? e.message : "Error desconocido" });
      }
    },
    [pushToast, fetchTemplates]
  );

  const handleEdit = useCallback((template: InvoiceTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTemplate(template);
    setShowCreateForm(true);
  }, []);

  const handleCreateNew = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTemplate(null);
    setShowCreateForm(true);
  }, []);

  return (
    <Modal open={open} onClose={onClose} title="Seleccionar Plantilla" widthPx={700}>
      <div className="bo-templateModal" data-slot="select-template-modal">
        {!showCreateForm ? (
          <>
            {/* Search and actions bar */}
            <div className="bo-templateModalHeader" data-slot="select-template-header">
              <div className="bo-templateSearch" data-slot="select-template-search-wrapper">
                <Search size={16} className="bo-templateSearchIcon" />
                <input
                  type="text"
                  className="bo-input"
                  placeholder="Buscar plantillas..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  data-testid="select-template-search-input"
                />
              </div>
              <button className="bo-btn bo-btn--primary bo-btn--sm" onClick={handleCreateNew} data-testid="select-template-create-btn">
                <Plus size={16} />
                Nueva plantilla
              </button>
            </div>

            {/* Templates list */}
            <div className="bo-templateList" data-slot="select-template-list">
              {loading ? (
                <div className="bo-templateLoading" data-slot="select-template-loading">
                  <Loader2 size={24} className="bo-spin bo-spin--sm" />
                  <span data-slot="select-template-loading-text">Cargando plantillas...</span>
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="bo-templateEmpty" data-slot="select-template-empty">
                  <FileText size={48} strokeWidth={1} />
                  <p data-slot="select-template-empty-text">{searchText ? "No se encontraron plantillas" : "No hay plantillas creadas"}</p>
                  <button className="bo-btn bo-btn--secondary" onClick={handleCreateNew} data-testid="select-template-create-first-btn">
                    <Plus size={16} />
                    Crear primera plantilla
                  </button>
                </div>
              ) : (
                filteredTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="bo-templateItem"
                    onClick={() => handleSelect(template)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && handleSelect(template)}
                    data-slot="select-template-item"
                  >
                    <div className="bo-templateItemIcon" data-slot="select-template-item-icon">
                      <FileText size={20} />
                    </div>
                    <div className="bo-templateItemContent" data-slot="select-template-item-content">
                      <div className="bo-templateItemName" data-slot="select-template-item-name">{template.name}</div>
                      <div className="bo-templateItemDetails" data-slot="select-template-item-details">
                        <span>{template.customer_name}</span>
                        {template.customer_email && <span>{template.customer_email}</span>}
                        {template.default_amount > 0 && (
                          <span className="bo-templateItemAmount">{template.default_amount.toFixed(2)} €</span>
                        )}
                        {template.default_payment_method && (
                          <span className="bo-templateItemPayment">
                            {PAYMENT_METHOD_LABELS[template.default_payment_method]}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="bo-templateItemActions" data-slot="select-template-item-actions">
                      <button
                        className="bo-btn bo-btn--ghost bo-btn--sm"
                        onClick={(e) => handleEdit(template, e)}
                        title="Editar"
                        data-testid="select-template-edit-btn"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        className="bo-btn bo-btn--ghost bo-btn--sm bo-btn--danger"
                        onClick={(e) => handleDelete(template, e)}
                        title="Eliminar"
                        data-testid="select-template-delete-btn"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <TemplateForm
            template={editingTemplate}
            onSave={() => {
              setShowCreateForm(false);
              setEditingTemplate(null);
              fetchTemplates();
            }}
            onCancel={() => {
              setShowCreateForm(false);
              setEditingTemplate(null);
            }}
          />
        )}
      </div>
    </Modal>
  );
}

// Template creation/edit form
interface TemplateFormProps {
  template: InvoiceTemplate | null;
  onSave: () => void;
  onCancel: () => void;
}

function TemplateForm({ template, onSave, onCancel }: TemplateFormProps) {
  const { pushToast } = useToasts();
  const [saving, setSaving] = useState(false);

  // Form fields
  const [name, setName] = useState(template?.name || "");
  const [customerName, setCustomerName] = useState(template?.customer_name || "");
  const [customerSurname, setCustomerSurname] = useState(template?.customer_surname || "");
  const [customerEmail, setCustomerEmail] = useState(template?.customer_email || "");
  const [customerDniCif, setCustomerDniCif] = useState(template?.customer_dni_cif || "");
  const [customerPhone, setCustomerPhone] = useState(template?.customer_phone || "");
  const [customerAddressStreet, setCustomerAddressStreet] = useState(template?.customer_address_street || "");
  const [customerAddressNumber, setCustomerAddressNumber] = useState(template?.customer_address_number || "");
  const [customerAddressPostalCode, setCustomerAddressPostalCode] = useState(template?.customer_address_postal_code || "");
  const [customerAddressCity, setCustomerAddressCity] = useState(template?.customer_address_city || "");
  const [customerAddressProvince, setCustomerAddressProvince] = useState(template?.customer_address_province || "");
  const [customerAddressCountry, setCustomerAddressCountry] = useState(template?.customer_address_country || "España");
  const [defaultAmount, setDefaultAmount] = useState(template?.default_amount?.toString() || "");
  const [defaultIvaRate, setDefaultIvaRate] = useState(template?.default_iva_rate?.toString() || "10");
  const [defaultPaymentMethod, setDefaultPaymentMethod] = useState<PaymentMethod | "">(template?.default_payment_method || "");
  const [notes, setNotes] = useState(template?.notes || "");
  const [isActive, setIsActive] = useState(template?.is_active ?? true);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!name.trim()) {
        pushToast({ kind: "error", title: "Error", message: "El nombre de la plantilla es obligatorio" });
        return;
      }
      if (!customerName.trim()) {
        pushToast({ kind: "error", title: "Error", message: "El nombre del cliente es obligatorio" });
        return;
      }
      if (!customerEmail.trim()) {
        pushToast({ kind: "error", title: "Error", message: "El email del cliente es obligatorio" });
        return;
      }

      const input: InvoiceTemplateInput = {
        name: name.trim(),
        customer_name: customerName.trim(),
        customer_surname: customerSurname.trim() || undefined,
        customer_email: customerEmail.trim(),
        customer_dni_cif: customerDniCif.trim() || undefined,
        customer_phone: customerPhone.trim() || undefined,
        customer_address_street: customerAddressStreet.trim() || undefined,
        customer_address_number: customerAddressNumber.trim() || undefined,
        customer_address_postal_code: customerAddressPostalCode.trim() || undefined,
        customer_address_city: customerAddressCity.trim() || undefined,
        customer_address_province: customerAddressProvince.trim() || undefined,
        customer_address_country: customerAddressCountry.trim() || undefined,
        default_amount: parseFloat(defaultAmount) || 0,
        default_iva_rate: parseFloat(defaultIvaRate) || 10,
        default_payment_method: defaultPaymentMethod || undefined,
        notes: notes.trim() || undefined,
        is_active: isActive,
      };

      setSaving(true);
      try {
        const api = createClient({ baseUrl: "" });
        let res;
        if (template) {
          res = await api.invoiceTemplates.update(template.id, input);
        } else {
          res = await api.invoiceTemplates.create(input);
        }

        if (res.success) {
          pushToast({ kind: "success", title: "Guardado", message: template ? "Plantilla actualizada" : "Plantilla creada" });
          onSave();
        } else {
          pushToast({ kind: "error", title: "Error", message: "No se pudo guardar la plantilla" });
        }
      } catch (e) {
        pushToast({ kind: "error", title: "Error", message: e instanceof Error ? e.message : "Error desconocido" });
      } finally {
        setSaving(false);
      }
    },
    [
      name,
      customerName,
      customerSurname,
      customerEmail,
      customerDniCif,
      customerPhone,
      customerAddressStreet,
      customerAddressNumber,
      customerAddressPostalCode,
      customerAddressCity,
      customerAddressProvince,
      customerAddressCountry,
      defaultAmount,
      defaultIvaRate,
      defaultPaymentMethod,
      notes,
      isActive,
      template,
      pushToast,
      onSave,
    ]
  );

  return (
    <form className="bo-templateForm" onSubmit={handleSubmit} data-slot="select-template-form" data-testid="select-template-form">
      <div className="bo-templateFormHeader" data-slot="select-template-form-header">
        <h3 data-slot="select-template-form-title">{template ? "Editar Plantilla" : "Nueva Plantilla"}</h3>
        <button type="button" className="bo-btn bo-btn--ghost bo-btn--sm" onClick={onCancel} data-testid="select-template-close-btn">
          <X size={18} />
        </button>
      </div>

      <div className="bo-templateFormBody" data-slot="select-template-form-body">
        {/* Template name */}
        <div className="bo-field" data-slot="select-template-field-name">
          <label className="bo-label">Nombre de la plantilla *</label>
          <input
            className="bo-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Cliente habitual - Juan"
            required
            data-testid="select-template-name-input"
          />
        </div>

        {/* Customer info */}
        <div className="bo-templateFormSection" data-slot="select-template-section-customer">
          <h4 data-slot="select-template-section-customer-title">Datos del cliente</h4>
          <div className="bo-invoiceFormRow">
            <label className="bo-field">
              <span className="bo-label">Nombre *</span>
              <input
                className="bo-input"
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
                data-testid="select-template-customerName-input"
              />
            </label>
            <label className="bo-field">
              <span className="bo-label">Apellidos</span>
              <input className="bo-input" type="text" value={customerSurname} onChange={(e) => setCustomerSurname(e.target.value)} data-testid="select-template-customerSurname-input" />
            </label>
          </div>
          <div className="bo-invoiceFormRow">
            <label className="bo-field">
              <span className="bo-label">Email *</span>
              <input className="bo-input" type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} required data-testid="select-template-customerEmail-input" />
            </label>
            <label className="bo-field">
              <span className="bo-label">Telefono</span>
              <input className="bo-input" type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} data-testid="select-template-customerPhone-input" />
            </label>
          </div>
          <div className="bo-invoiceFormRow">
            <label className="bo-field">
              <span className="bo-label">DNI/CIF</span>
              <input className="bo-input" type="text" value={customerDniCif} onChange={(e) => setCustomerDniCif(e.target.value)} data-testid="select-template-customerDniCif-input" />
            </label>
          </div>
          <div className="bo-invoiceFormRow">
            <label className="bo-field">
              <span className="bo-label">Calle</span>
              <input className="bo-input" type="text" value={customerAddressStreet} onChange={(e) => setCustomerAddressStreet(e.target.value)} data-testid="select-template-customerAddressStreet-input" />
            </label>
            <label className="bo-field bo-field--number">
              <span className="bo-label">Numero</span>
              <input className="bo-input" type="text" value={customerAddressNumber} onChange={(e) => setCustomerAddressNumber(e.target.value)} data-testid="select-template-customerAddressNumber-input" />
            </label>
          </div>
          <div className="bo-invoiceFormRow">
            <label className="bo-field">
              <span className="bo-label">Codigo Postal</span>
              <input className="bo-input" type="text" value={customerAddressPostalCode} onChange={(e) => setCustomerAddressPostalCode(e.target.value)} data-testid="select-template-customerAddressPostalCode-input" />
            </label>
            <label className="bo-field">
              <span className="bo-label">Localidad</span>
              <input className="bo-input" type="text" value={customerAddressCity} onChange={(e) => setCustomerAddressCity(e.target.value)} data-testid="select-template-customerAddressCity-input" />
            </label>
          </div>
          <div className="bo-invoiceFormRow">
            <label className="bo-field">
              <span className="bo-label">Provincia</span>
              <input className="bo-input" type="text" value={customerAddressProvince} onChange={(e) => setCustomerAddressProvince(e.target.value)} data-testid="select-template-customerAddressProvince-input" />
            </label>
            <label className="bo-field">
              <span className="bo-label">Pais</span>
              <input className="bo-input" type="text" value={customerAddressCountry} onChange={(e) => setCustomerAddressCountry(e.target.value)} data-testid="select-template-customerAddressCountry-input" />
            </label>
          </div>
        </div>

        {/* Default values */}
        <div className="bo-templateFormSection" data-slot="select-template-section-defaults">
          <h4 data-slot="select-template-section-defaults-title">Valores por defecto</h4>
          <div className="bo-invoiceFormRow">
            <label className="bo-field">
              <span className="bo-label">Importe</span>
              <input
                className="bo-input"
                type="number"
                step="0.01"
                min="0"
                value={defaultAmount}
                onChange={(e) => setDefaultAmount(e.target.value)}
                placeholder="0.00"
                data-testid="select-template-defaultAmount-input"
              />
            </label>
            <label className="bo-field">
              <span className="bo-label">IVA (%)</span>
              <input className="bo-input" type="number" step="0.1" min="0" max="100" value={defaultIvaRate} onChange={(e) => setDefaultIvaRate(e.target.value)} data-testid="select-template-defaultIvaRate-input" />
            </label>
          </div>
          <div className="bo-invoiceFormRow">
            <label className="bo-field">
              <span className="bo-label">Metodo de pago</span>
              <select className="bo-select" value={defaultPaymentMethod} onChange={(e) => setDefaultPaymentMethod(e.target.value as PaymentMethod | "")} data-testid="select-template-defaultPaymentMethod-select">
                <option value="">Seleccionar...</option>
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="transferencia">Transferencia</option>
                <option value="bizum">Bizum</option>
                <option value="cheque">Cheque</option>
              </select>
            </label>
          </div>
          <div className="bo-field" data-slot="select-template-field-notes">
            <label className="bo-label">Notas</label>
            <textarea className="bo-textarea" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Notas adicionales..." data-testid="select-template-notes-textarea" />
          </div>
        </div>

        {/* Active toggle */}
        <div className="bo-field bo-field--switch" data-slot="select-template-field-active-toggle">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} id="isActive" data-testid="select-template-isActive-input" />
          <label htmlFor="isActive">Plantilla activa</label>
        </div>
      </div>

      <div className="bo-templateFormActions" data-slot="select-template-form-actions">
        <button type="button" className="bo-btn bo-btn--secondary" onClick={onCancel} disabled={saving} data-testid="select-template-cancel-btn">
          Cancelar
        </button>
        <button type="submit" className="bo-btn bo-btn--primary" disabled={saving} data-testid="select-template-submit-btn">
          {saving ? (
            <>
              <Loader2 size={16} className="bo-spin bo-spin--sm" />
              Guardando...
            </>
          ) : (
            <>
              <Copy size={16} />
              {template ? "Actualizar" : "Crear"} plantilla
            </>
          )}
        </button>
      </div>
    </form>
  );
}
