import React, { useState } from "react";
import { POSDialog } from "../POSSellScreen/POSDialog";
import { parseAmount } from "../../utils/money";

export type EditableProduct = { id: number; name: string; priceGrossCents: number; categoryId?: number; vatRateId?: number; isActive: boolean };
type Option = { id: number; name: string };

/**
 * Single form to edit a TPV product (name, price, category, VAT) instead of a
 * chain of browser prompts with raw ids. Coordination id: pos_product_edit_dialog_v1
 */
export function POSProductEditDialog({ product, categories, vatRates, busy, error, onClose, onSave }: {
  product: EditableProduct;
  categories: Option[];
  vatRates: Array<Option & { rate: number }>;
  busy?: boolean;
  error?: string;
  onClose: () => void;
  onSave: (next: EditableProduct) => void;
}) {
  const [name, setName] = useState(product.name);
  const [price, setPrice] = useState((product.priceGrossCents / 100).toFixed(2).replace(".", ","));
  const [categoryId, setCategoryId] = useState(product.categoryId || 0);
  const [vatRateId, setVatRateId] = useState(product.vatRateId || 0);
  const [isActive, setIsActive] = useState(product.isActive);
  const amount = parseAmount(price);
  const invalid = !name.trim() || !Number.isFinite(amount) || amount < 0;
  const field = "min-h-11 w-full rounded-lg border border-[var(--bo-border-2)] bg-[var(--bo-surface-2)] px-3 text-[var(--bo-text)]";
  return (
    <POSDialog testId="pos-product-edit" title="Editar producto" busy={busy} error={error} onClose={onClose}>
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => { event.preventDefault(); if (!invalid) onSave({ ...product, name: name.trim(), priceGrossCents: Math.round(amount * 100), categoryId: categoryId || undefined, vatRateId: vatRateId || undefined, isActive }); }}
        data-testid="pos-product-edit-form"
      >
        <label className="grid gap-1 text-sm text-[var(--bo-muted)] sm:col-span-2" data-testid="pos-product-edit-name-field">Nombre
          <input className={field} value={name} onChange={(event) => setName(event.target.value)} autoFocus data-testid="pos-product-edit-name" />
        </label>
        <label className="grid gap-1 text-sm text-[var(--bo-muted)]" data-testid="pos-product-edit-price-field">Precio (IVA incl.)
          <input className={field} inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} aria-invalid={!Number.isFinite(amount) || amount < 0} data-testid="pos-product-edit-price" />
        </label>
        <label className="grid gap-1 text-sm text-[var(--bo-muted)]" data-testid="pos-product-edit-vat-field">IVA
          <select className={field} value={vatRateId} onChange={(event) => setVatRateId(Number(event.target.value))} data-testid="pos-product-edit-vat">
            <option value={0} data-testid="pos-product-edit-vat-default">IVA por defecto</option>
            {vatRates.map((rate) => <option value={rate.id} key={rate.id} data-testid={`pos-product-edit-vat-${rate.id}`}>{rate.name} · {rate.rate}%</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm text-[var(--bo-muted)]" data-testid="pos-product-edit-category-field">Categoría
          <select className={field} value={categoryId} onChange={(event) => setCategoryId(Number(event.target.value))} data-testid="pos-product-edit-category">
            <option value={0} data-testid="pos-product-edit-category-none">Sin categoría</option>
            {categories.map((category) => <option value={category.id} key={category.id} data-testid={`pos-product-edit-category-${category.id}`}>{category.name}</option>)}
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-2 self-end text-sm text-[var(--bo-text)]" data-testid="pos-product-edit-active-field">
          <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} data-testid="pos-product-edit-active" />
          Visible en el TPV
        </label>
        <button className="pos-modal__primary sm:col-span-2" type="submit" disabled={busy || invalid} data-testid="pos-product-edit-save">Guardar cambios</button>
      </form>
    </POSDialog>
  );
}
