import React from "react";
import { Beer, CupSoda, Droplets, Martini, Plus, Settings2, Wine } from "lucide-react";
import type { BeverageOption } from "../../types/menuEditor.types";
import { Switch } from "../../../../../../ui/shadcn/Switch";
import { Select } from "../../../../../../ui/inputs/Select";
import { PlusMinusCounter } from "../../../../../../ui/widgets/PlusMinusCounter";
import { Panel } from "../../../../../../ui/shell/Panel";
import { beverageTypeOptions } from "../../constants/menuEditor.constants";

export type MenuPricingProps = {
  isSpecial: boolean;
  beverageType: string;
  beverageOptions: BeverageOption[];
  onOpenBeverageModal: () => void;
  beveragePrice: string;
  beverageHasSupplement: boolean;
  beverageSupplementPrice: string;
  minPartySize: string;
  mainLimit: boolean;
  mainLimitNum: string;
  includedCoffee: boolean;
  comments: string[];
  onBeverageTypeChange: (type: string) => void;
  onBeveragePriceChange: (price: string) => void;
  onBeverageHasSupplementChange: (v: boolean) => void;
  onBeverageSupplementPriceChange: (price: string) => void;
  onMinPartySizeChange: (size: string) => void;
  onMainLimitChange: (v: boolean) => void;
  onMainLimitNumChange: (num: string) => void;
  onIncludedCoffeeChange: (v: boolean) => void;
  onCommentsChange: (comments: string[]) => void;
};

export function MenuPricing({
  isSpecial,
  beverageType,
  beverageOptions,
  onOpenBeverageModal,
  beveragePrice,
  beverageHasSupplement,
  beverageSupplementPrice,
  minPartySize,
  mainLimit,
  mainLimitNum,
  includedCoffee,
  comments,
  onBeverageTypeChange,
  onBeveragePriceChange,
  onBeverageHasSupplementChange,
  onBeverageSupplementPriceChange,
  onMinPartySizeChange,
  onMainLimitChange,
  onMainLimitNumChange,
  onIncludedCoffeeChange,
  onCommentsChange,
}: MenuPricingProps) {
  if (isSpecial) return null;
  return (
    <Panel className="bo-settingsPanel" data-pricing-panel="true" data-slot="menuPricing-settingsPanel"
      title={<><Settings2 size={15} /> Configuracion</>}
      bodyClassName="bo-form bo-form--menuWizard"
    >
        <div className="bo-field" data-slot="menuPricing-field">
          <div className="bo-label" data-slot="menuPricing-label">Bebida</div>
          <Select
            className="bo-menuSettingSelect"
            value={beverageType}
            onChange={onBeverageTypeChange}
            options={beverageTypeOptions}
            size="sm"
            ariaLabel="Tipo de bebida"
          />
        </div>

        {beverageType !== "no_incluida" ? (
          <div className="bo-field" data-slot="menuPricing-field">
            <div className="bo-label" data-slot="menuPricing-label">Precio por persona</div>
            <input className="bo-input" value={beveragePrice} onChange={(e) => onBeveragePriceChange(e.target.value)} inputMode="decimal" data-testid="menu-pricing-beverage-price-input" />
          </div>
        ) : null}

        {beverageType === "opcion" || beverageType === "ilimitada" ? (
          <div className="bo-field" data-slot="menuPricing-field">
            <div className="bo-label" data-slot="menuPricing-label">Bebidas incluidas</div>
            <div className="bo-beverageIconRow" data-testid="menu-pricing-beverage-icon-row">
              {beverageOptions.filter((option) => option.selected).map((option) => {
                const Icon = beverageIconForSlug(option.slug);
                return (
                  <span
                    key={option.id}
                    className="bo-beverageIconChip is-selected"
                    title={option.name}
                    data-testid={`menu-pricing-beverage-icon-${option.slug}`}
                  >
                    <Icon size={16} />
                  </span>
                );
              })}
              <button
                type="button"
                className="bo-btn bo-btn--ghost bo-btn--sm bo-beverageAddBtn"
                onClick={onOpenBeverageModal}
                data-testid="menu-pricing-beverage-add-plus"
                aria-label="Gestionar bebidas incluidas"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
        ) : null}

        {beverageType === "ilimitada" ? (
          <>
            <div className="bo-field" data-slot="menuPricing-field">
              <div className="bo-label" data-slot="menuPricing-label">Tiene suplemento</div>
              <Switch checked={beverageHasSupplement} onCheckedChange={onBeverageHasSupplementChange} data-testid="menu-pricing-beverage-supplement-switch" />
            </div>
            {beverageHasSupplement ? (
              <div className="bo-field" data-slot="menuPricing-field">
                <div className="bo-label" data-slot="menuPricing-label">Valor suplemento</div>
                <input
                  className="bo-input"
                  value={beverageSupplementPrice}
                  onChange={(e) => onBeverageSupplementPriceChange(e.target.value)}
                  inputMode="decimal"
                  data-testid="menu-pricing-beverage-supplement-price-input"
                />
              </div>
            ) : null}
          </>
        ) : null}

        <div className="bo-field" data-slot="menuPricing-field">
          <div className="bo-label" data-slot="menuPricing-label">Minimo personas para reservar</div>
          <input className="bo-input" value={minPartySize} onChange={(e) => onMinPartySizeChange(e.target.value)} inputMode="numeric" data-testid="menu-pricing-min-party-size-input" />
        </div>

        <div className="bo-field bo-field--inline" data-slot="menuPricing-field--inline">
          <div className="bo-label" style={{ marginRight: "auto" }} data-slot="menuPricing-label">Limite maximo de principales por mesa</div>
          <Switch checked={mainLimit} onCheckedChange={onMainLimitChange} data-testid="menu-pricing-main-limit-switch" />
          {mainLimit ? (
            <PlusMinusCounter
              label="Numero de principales"
              value={mainLimitNum}
              onDecrease={() => onMainLimitNumChange(String(Math.max(1, Number(mainLimitNum) - 1)))}
              onIncrease={() => onMainLimitNumChange(String(Number(mainLimitNum) + 1))}
              canDecrease={Number(mainLimitNum) > 1}
              className="bo-principalesCounter"
            />
          ) : null}
        </div>

        <div className="bo-field" data-slot="menuPricing-field">
          <div className="bo-label" data-slot="menuPricing-label">Cafe incluido</div>
          <Switch checked={includedCoffee} onCheckedChange={onIncludedCoffeeChange} data-testid="menu-pricing-coffee-switch" />
        </div>

        <div className="bo-field bo-field--full" data-slot="menuPricing-field--full">
          <div className="bo-label" data-slot="menuPricing-label">Comentarios</div>
          <textarea
            className="bo-input bo-textarea"
            value={comments.join("\n")}
            onChange={(e) => onCommentsChange(e.target.value.split("\n").filter((line) => line.trim() !== ""))}
            placeholder="Añade comentarios..."
            rows={2}
            onInput={(e) => {
              const node = e.currentTarget;
              node.style.height = "auto";
              node.style.height = `${node.scrollHeight}px`;
            }}
            style={{ minHeight: "60px", resize: "vertical" }}
            data-testid="menu-pricing-comments-textarea"
          />
        </div>
    </Panel>
  );
}

function beverageIconForSlug(slug: string) {
  switch (slug) {
    case "agua":
      return Droplets;
    case "refrescos":
      return CupSoda;
    case "vino":
      return Wine;
    case "cerveza-de-barril":
    case "cerveza-de-tercio":
      return Beer;
    case "sangria":
      return Wine;
    case "martini":
      return Martini;
    default:
      return CupSoda;
  }
}
