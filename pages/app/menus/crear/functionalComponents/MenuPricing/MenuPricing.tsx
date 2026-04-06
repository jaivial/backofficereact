import React from "react";
import { Plus, Settings2, Trash2 } from "lucide-react";
import { Switch } from "../../../../../../ui/shadcn/Switch";
import { Select } from "../../../../../../ui/inputs/Select";
import { PlusMinusCounter } from "../../../../../../ui/widgets/PlusMinusCounter";
import { beverageTypeOptions } from "../../constants/menuEditor.constants";

export type MenuPricingProps = {
  isSpecial: boolean;
  beverageType: string;
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
    <div className="bo-panel bo-settingsPanel" data-pricing-panel="true">
      <div className="bo-panelHead">
        <div className="bo-panelTitle">
          <Settings2 size={15} /> Configuracion
        </div>
      </div>
      <div className="bo-panelBody bo-form bo-form--menuWizard">
        <div className="bo-field">
          <div className="bo-label">Bebida</div>
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
          <div className="bo-field">
            <div className="bo-label">Precio por persona</div>
            <input className="bo-input" value={beveragePrice} onChange={(e) => onBeveragePriceChange(e.target.value)} inputMode="decimal" />
          </div>
        ) : null}

        {beverageType === "ilimitada" ? (
          <>
            <div className="bo-field">
              <div className="bo-label">Tiene suplemento</div>
              <Switch checked={beverageHasSupplement} onCheckedChange={onBeverageHasSupplementChange} />
            </div>
            {beverageHasSupplement ? (
              <div className="bo-field">
                <div className="bo-label">Valor suplemento</div>
                <input
                  className="bo-input"
                  value={beverageSupplementPrice}
                  onChange={(e) => onBeverageSupplementPriceChange(e.target.value)}
                  inputMode="decimal"
                />
              </div>
            ) : null}
          </>
        ) : null}

        <div className="bo-field">
          <div className="bo-label">Minimo personas para reservar</div>
          <input className="bo-input" value={minPartySize} onChange={(e) => onMinPartySizeChange(e.target.value)} inputMode="numeric" />
        </div>

        <div className="bo-field bo-field--inline">
          <div className="bo-label" style={{ marginRight: "auto" }}>Limite maximo de principales por mesa</div>
          <Switch checked={mainLimit} onCheckedChange={onMainLimitChange} />
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

        <div className="bo-field">
          <div className="bo-label">Cafe incluido</div>
          <Switch checked={includedCoffee} onCheckedChange={onIncludedCoffeeChange} />
        </div>

        <div className="bo-field bo-field--full">
          <div className="bo-label">Comentarios</div>
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
          />
        </div>
      </div>
    </div>
  );
}
