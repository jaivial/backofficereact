import React, { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "../../../../../ui/actions/Button";
import { InlineAlert } from "../../../../../ui/feedback/InlineAlert";
import { StatusBadge } from "../../../../../ui/feedback/StatusBadge";
import { FormField } from "../../../../../ui/inputs/FormField";

type Item = { id: number; name: string; kind: string; isTracked: boolean; displayUnit: { id: number; code: string; label: string; factorToBase: number } };
type Warehouse = { id: number; name: string; isDefault: boolean };
type ProductionPreview={name:string;neededQuantityBase:number;availableQuantityBase:number;shortage:boolean};
type Recipe = { id: number; name: string; outputItemId: number; outputItemName: string; outputQuantityBase: number; sellingPriceGross?: number; isProtected: boolean };
type RecipeDetail = Recipe & { components: { stockItemId: number; enteredQuantity: number; wastePct: number }[]; labour: { memberId: number; minutesPerBatch: number }[] };
type RecipeComponent = { stockItemId: number; quantity: string; wastePct: string };
type LabourMember = { id: number; name: string; costAvailable: boolean };
type RecipeLabour = { memberId: number; minutesPerBatch: string };
type ForecastItem = { itemId: number; name: string; onHand: number; forecast: number; toOrder: number; unit: string };
type CostItem = { recipeId: number; name: string; grossPrice: number; ingredientCost: number; labourCost: number; overheadCost: number; totalCost: number; foodCostPct: number; grossMargin: number; zone: string; isProtected: boolean; labourCostEnabled: boolean; labourCostAvailable: boolean; missingLabourMembers?: string[] };

async function operationRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/admin/stock${path}`, { ...init, credentials: "include", headers: { "Content-Type": "application/json", ...init?.headers } });
  const body = await response.json();
  if (!response.ok || !body.success) throw new Error(body.message || "Error de operaciones");
  return body as T;
}

const EMPTY_COMPONENT: RecipeComponent = { stockItemId: 0, quantity: "1", wastePct: "0" };

const ZONE_VARIANT: Record<string, "success" | "warning" | "danger" | "info"> = { GREEN: "success", AMBER: "warning", RED: "danger", PURPLE: "info" };

export function StockOperationsPanel({ items, warehouses, onChanged }: { items: Item[]; warehouses: Warehouse[]; onChanged: () => void | Promise<void> }) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [forecast, setForecast] = useState<{ confidence: string; historyDays: number; requiredHistoryDays: number; items: ForecastItem[] }>({ confidence: "COLLECTING", historyDays: 0, requiredHistoryDays: 56, items: [] });
  const [costs, setCosts] = useState<CostItem[]>([]);
  const [showRecipe, setShowRecipe] = useState(false);
  const [editingRecipeId, setEditingRecipeId] = useState(0);
  const [name, setName] = useState("");
  const [outputItemId, setOutputItemId] = useState(0);
  const [outputQuantity, setOutputQuantity] = useState("1");
  const [components, setComponents] = useState<RecipeComponent[]>([{ ...EMPTY_COMPONENT }]);
  const [labourMembers,setLabourMembers]=useState<LabourMember[]>([]);
  const [labour,setLabour]=useState<RecipeLabour[]>([]);
  const [productionRecipeId, setProductionRecipeId] = useState(0);
  const [pricingRecipeId, setPricingRecipeId] = useState(0);
  const [sellingPrice, setSellingPrice] = useState("");
  const [overheadPct, setOverheadPct] = useState("0");
  const [isProtected, setIsProtected] = useState(false);
  const [productionBatches, setProductionBatches] = useState("1");
  const [warehouseId, setWarehouseId] = useState(0);
  const [preview, setPreview] = useState<ProductionPreview[]>([]);
  const [previewLabourCost,setPreviewLabourCost]=useState(0);
  const [previewMissingLabour,setPreviewMissingLabour]=useState<string[]>([]);
  const [scenario, setScenario] = useState("MEDIUM");
  const [horizon, setHorizon] = useState("7");
  const [affluenceDate, setAffluenceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [affluenceService, setAffluenceService] = useState("DINNER");
  const [affluenceCovers, setAffluenceCovers] = useState("");
  const [recommendations, setRecommendations] = useState<{ summary?: string; recommendations?: { type: string; priority: string; item: string; reason: string; suggestedAction: string }[] } | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const selectedWarehouseId = useMemo(() => warehouseId || warehouses.find((warehouse) => warehouse.isDefault)?.id || 0, [warehouseId, warehouses]);
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  const load = useCallback(async () => {
    try {
      const [recipeData, forecastData, costData, labourData] = await Promise.all([
        operationRequest<{ recipes: Recipe[] }>("/recipes"),
        operationRequest<{ confidence: string; historyDays: number; requiredHistoryDays: number; items: ForecastItem[] }>(`/forecast?scenario=${scenario}&horizonDays=${horizon}`),
        operationRequest<{ items: CostItem[] }>("/costing"),
        operationRequest<{ items: LabourMember[] }>("/labour-members"),
      ]);
      setRecipes(recipeData.recipes || []); setForecast(forecastData); setCosts(costData.items || []); setLabourMembers(labourData.items||[]);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudieron cargar operaciones"); }
  }, [horizon, scenario]);
  useEffect(() => { void load(); }, [load]);

  const setComponent = useCallback((index: number, patch: Partial<RecipeComponent>) => setComponents((current) => current.map((component, position) => position === index ? { ...component, ...patch } : component)), []);

  const saveRecipe = useCallback(async () => {
    const output = itemById.get(outputItemId);
    if (!output || !name.trim()) { setError("Completa nombre y elaboración resultante"); return; }
    const validComponents = components.filter((component) => component.stockItemId && Number(component.quantity) > 0);
    if (!validComponents.length) { setError("Añade al menos un ingrediente"); return; }
    try {
      await operationRequest(editingRecipeId ? `/recipes/${editingRecipeId}` : "/recipes", { method: editingRecipeId ? "PATCH" : "POST", body: JSON.stringify({ name: name.trim(), outputItemId: output.id, outputQuantity: Number(outputQuantity), outputUnitId: output.displayUnit.id, wastePct: 0, overheadPct: 0, isProtected: false, labour: labour.filter(entry=>entry.memberId&&Number(entry.minutesPerBatch)>0).map(entry=>({memberId:entry.memberId,minutesPerBatch:Number(entry.minutesPerBatch)})), components: validComponents.map((component) => { const item = itemById.get(component.stockItemId)!; return { stockItemId: item.id, quantity: Number(component.quantity), unitId: item.displayUnit.id, wastePct: Number(component.wastePct), isOptional: false }; }) }) });
      setName(""); setOutputItemId(0); setComponents([{ ...EMPTY_COMPONENT }]); setLabour([]); setEditingRecipeId(0); setShowRecipe(false); setMessage(editingRecipeId ? "Receta actualizada." : "Receta creada."); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo crear la receta"); }
  }, [components, editingRecipeId, itemById, labour, load, name, outputItemId, outputQuantity]);

  const editRecipe = useCallback(async (recipeId: number) => {
    try { const result = await operationRequest<{ recipe: RecipeDetail }>(`/recipes/${recipeId}`); const recipe=result.recipe; const output=itemById.get(recipe.outputItemId); setEditingRecipeId(recipe.id); setName(recipe.name); setOutputItemId(recipe.outputItemId); setOutputQuantity(String(recipe.outputQuantityBase/(output?.displayUnit.factorToBase||1))); setComponents(recipe.components.map((component)=>({stockItemId:component.stockItemId,quantity:String(component.enteredQuantity),wastePct:String(component.wastePct)}))); setLabour((recipe.labour||[]).map(entry=>({memberId:entry.memberId,minutesPerBatch:String(entry.minutesPerBatch)}))); setShowRecipe(true); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo abrir la receta"); }
  }, [itemById]);

  const savePricing = useCallback(async () => {
    if (!pricingRecipeId) return;
    const gross = sellingPrice === "" ? null : Number(sellingPrice);
    if (gross !== null && (!Number.isFinite(gross) || gross < 0)) { setError("Precio no válido"); return; }
    try { await operationRequest(`/recipes/${pricingRecipeId}/pricing`, { method: "PATCH", body: JSON.stringify({ sellingPriceGross: gross, vatRateId: null, overheadPct: Number(overheadPct), isProtected }) }); setMessage("Precio y protección guardados."); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo guardar el precio"); }
  }, [isProtected, load, overheadPct, pricingRecipeId, sellingPrice]);

  const deleteRecipe = useCallback(async (recipeId: number) => {
    if (!window.confirm("¿Eliminar esta receta?")) return;
    try { await operationRequest(`/recipes/${recipeId}`, { method: "DELETE" }); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo eliminar la receta"); }
  }, [load]);

  const productionPreview = useCallback(async () => {
    if (!productionRecipeId || !selectedWarehouseId) return;
    try { const data = await operationRequest<{ components: ProductionPreview[];standardLabourCost:number;missingLabourMembers:string[] }>(`/recipes/${productionRecipeId}/production/preview`, { method: "POST", body: JSON.stringify({ warehouseId: selectedWarehouseId, batches: Number(productionBatches) }) }); setPreview(data.components || []);setPreviewLabourCost(data.standardLabourCost||0);setPreviewMissingLabour(data.missingLabourMembers||[]); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo calcular la elaboración"); }
  }, [productionBatches, productionRecipeId, selectedWarehouseId]);

  const produce = useCallback(async () => {
    if (!productionRecipeId || !selectedWarehouseId) return;
    try { await operationRequest(`/recipes/${productionRecipeId}/production`, { method: "POST", body: JSON.stringify({ warehouseId: selectedWarehouseId, batches: Number(productionBatches), idempotencyKey: crypto.randomUUID() }) }); setPreview([]); setPreviewLabourCost(0);setPreviewMissingLabour([]);setMessage("Elaboración registrada."); await onChanged(); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo registrar la elaboración"); }
  }, [load, onChanged, productionBatches, productionRecipeId, selectedWarehouseId]);

  const saveAffluence = useCallback(async () => {
    const covers = Number(affluenceCovers);
    if (!Number.isInteger(covers) || covers < 0) { setError("Comensales no válidos"); return; }
    try { await operationRequest("/affluence", { method: "PUT", body: JSON.stringify({ date: affluenceDate, serviceType: affluenceService, covers }) }); setMessage("Afluencia guardada."); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo guardar la afluencia"); }
  }, [affluenceCovers, affluenceDate, affluenceService, load]);

  const loadRecommendations = useCallback(async () => {
    try { const result = await operationRequest<{ report: typeof recommendations }>("/ai/recommendations", { method: "POST", body: JSON.stringify({ scenario, forecast: forecast.items.slice(0, 50), costs: costs.slice(0, 50) }) }); setRecommendations(result.report); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudieron generar recomendaciones"); }
  }, [costs, forecast.items, scenario]);

  const confidenceLabel = useMemo(() => ({ COLLECTING: "Recopilando datos", LOW: "Confianza baja", MEDIUM: "Confianza media", FULL: "Confianza completa" }[forecast.confidence] || forecast.confidence), [forecast.confidence]);

  return (
    <section className="bo-stockSplit" data-ui="stock-operations">
      <article className="bo-panel" data-ui="stock-recipes-panel">
        <div className="bo-panelHead" data-ui="stock-recipes-header">
          <div data-ui="stock-recipes-heading">
            <h2 className="bo-panelTitle" data-ui="stock-recipes-title">Recetas y elaboraciones</h2>
            <p className="bo-panelMeta" data-ui="stock-recipes-subtitle">Escandallos, semielaborados y consumo anidado</p>
          </div>
          <Button variant="primary" size="sm" onClick={() => { setEditingRecipeId(0); setName(""); setOutputItemId(0); setOutputQuantity("1"); setComponents([{ ...EMPTY_COMPONENT }]); setLabour([]); setShowRecipe((value) => !value); }} data-testid="stock-recipe-new">Nueva receta</Button>
        </div>

        <div className="bo-panelBody" data-ui="stock-recipes-body">
          {showRecipe ? (
            <div className="bo-stockSubsection" data-ui="stock-recipe-form">
              <FormField label="Nombre" htmlFor="stock-recipe-name">
                <input id="stock-recipe-name" className="bo-input" value={name} onChange={(event) => setName(event.target.value)} data-testid="stock-recipe-name" />
              </FormField>

              <div className="bo-stockFormGrid bo-stockFormGrid--2" data-ui="stock-recipe-output-row">
                <FormField label="Resultado" htmlFor="stock-recipe-output">
                  <select id="stock-recipe-output" className="bo-input" value={outputItemId} onChange={(event) => setOutputItemId(Number(event.target.value))} data-testid="stock-recipe-output">
                    <option value={0} data-ui="stock-recipe-output-empty">Selecciona</option>
                    {items.map((item) => <option key={item.id} value={item.id} data-ui="stock-recipe-output-option">{item.name}</option>)}
                  </select>
                </FormField>
                <FormField label="Rendimiento" htmlFor="stock-recipe-output-quantity">
                  <input id="stock-recipe-output-quantity" className="bo-input" inputMode="decimal" value={outputQuantity} onChange={(event) => setOutputQuantity(event.target.value)} data-ui="stock-recipe-output-quantity" />
                </FormField>
              </div>

              {components.map((component, index) => (
                <div className="bo-stockFormGrid bo-stockFormGrid--component" key={index} data-ui="stock-recipe-component">
                  <FormField label={`Ingrediente ${index + 1}`} htmlFor={`stock-recipe-component-${index}`}>
                    <select id={`stock-recipe-component-${index}`} className="bo-input" value={component.stockItemId} onChange={(event) => setComponent(index, { stockItemId: Number(event.target.value) })} data-testid={`stock-recipe-component-${index}`}>
                      <option value={0} data-ui="stock-recipe-component-empty">Ingrediente</option>
                      {items.filter((item) => item.id !== outputItemId).map((item) => <option key={item.id} value={item.id} data-ui="stock-recipe-component-option">{item.name} · {item.displayUnit.label}</option>)}
                    </select>
                  </FormField>
                  <FormField label={`Cantidad ingrediente ${index + 1}`} htmlFor={`stock-recipe-component-qty-${index}`}>
                    <input id={`stock-recipe-component-qty-${index}`} className="bo-input" inputMode="decimal" value={component.quantity} onChange={(event) => setComponent(index, { quantity: event.target.value })} data-testid={`stock-recipe-component-qty-${index}`} />
                  </FormField>
                  <FormField label={`Merma ingrediente ${index + 1}`} htmlFor={`stock-recipe-component-waste-${index}`}>
                    <input id={`stock-recipe-component-waste-${index}`} className="bo-input" inputMode="decimal" value={component.wastePct} onChange={(event) => setComponent(index, { wastePct: event.target.value })} data-ui="stock-recipe-component-waste" />
                  </FormField>
                </div>
              ))}

              <div className="bo-stockSubsection" data-ui="stock-recipe-labour">
                <h3 className="bo-stockSubtitle" data-ui="stock-recipe-labour-title">Mano de obra por lote</h3>
                {labour.map((entry, index) => (
                  <div className="bo-stockFormGrid bo-stockFormGrid--labour" key={index} data-ui="stock-recipe-labour-row">
                    <FormField label={`Miembro mano de obra ${index + 1}`} htmlFor={`stock-recipe-labour-member-${index}`}>
                      <select id={`stock-recipe-labour-member-${index}`} className="bo-input" value={entry.memberId} onChange={event=>setLabour(current=>current.map((item,position)=>position===index?{...item,memberId:Number(event.target.value)}:item))} data-ui="stock-recipe-labour-member">
                        <option value={0} data-ui="stock-recipe-labour-empty">Miembro</option>
                        {labourMembers.map(member=><option key={member.id} value={member.id} data-ui="stock-recipe-labour-option">{member.name}{member.costAvailable?"":" · salario pendiente"}</option>)}
                      </select>
                    </FormField>
                    <FormField label={`Minutos mano de obra ${index + 1}`} htmlFor={`stock-recipe-labour-minutes-${index}`}>
                      <input id={`stock-recipe-labour-minutes-${index}`} className="bo-input" inputMode="decimal" value={entry.minutesPerBatch} onChange={event=>setLabour(current=>current.map((item,position)=>position===index?{...item,minutesPerBatch:event.target.value}:item))} placeholder="Minutos/lote" data-ui="stock-recipe-labour-minutes" />
                    </FormField>
                  </div>
                ))}
                <Button variant="secondary" size="sm" className="bo-btn--fit" onClick={()=>setLabour(current=>[...current,{memberId:0,minutesPerBatch:"30"}])} data-ui="stock-recipe-labour-add">Añadir mano de obra</Button>
              </div>

              <div className="bo-stockFormActions" data-ui="stock-recipe-form-actions">
                <Button variant="secondary" onClick={() => setComponents((current) => [...current, { ...EMPTY_COMPONENT }])} data-ui="stock-recipe-add-component">Añadir ingrediente</Button>
                <Button variant="primary" onClick={() => void saveRecipe()} data-testid="stock-recipe-save">{editingRecipeId ? "Actualizar receta" : "Guardar receta"}</Button>
              </div>
            </div>
          ) : null}

          {recipes.length ? (
            <div className="bo-stockRowList" data-ui="stock-recipe-list">
              {recipes.map((recipe) => (
                <div className="bo-stockRow" key={recipe.id} data-ui="stock-recipe-list-item">
                  <span data-ui="stock-recipe-list-name">{recipe.name} → {recipe.outputItemName}</span>
                  <span className="bo-stockRowActions" data-ui="stock-recipe-list-actions">
                    <Button variant="ghost" size="sm" onClick={() => void editRecipe(recipe.id)} data-ui="stock-recipe-edit">Editar</Button>
                    <Button variant="danger" size="sm" onClick={() => void deleteRecipe(recipe.id)} data-ui="stock-recipe-delete">Eliminar</Button>
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          <div className="bo-stockSubsection" data-ui="stock-recipe-pricing">
            <h3 className="bo-stockSubtitle" data-ui="stock-recipe-pricing-title">Precio y protección</h3>
            <div className="bo-stockFormGrid bo-stockFormGrid--3" data-ui="stock-recipe-pricing-fields">
              <FormField label="Receta" htmlFor="stock-recipe-pricing-recipe">
                <select id="stock-recipe-pricing-recipe" className="bo-input" value={pricingRecipeId} onChange={(event) => { const id=Number(event.target.value); setPricingRecipeId(id); const recipe=recipes.find((entry)=>entry.id===id); setSellingPrice(recipe?.sellingPriceGross==null?"":String(recipe.sellingPriceGross)); setIsProtected(Boolean(recipe?.isProtected)); }} data-ui="stock-recipe-pricing-recipe">
                  <option value={0} data-ui="stock-recipe-pricing-empty">Receta</option>
                  {recipes.map((recipe)=><option key={recipe.id} value={recipe.id} data-ui="stock-recipe-pricing-option">{recipe.name}</option>)}
                </select>
              </FormField>
              <FormField label="Precio PVP" htmlFor="stock-recipe-price">
                <input id="stock-recipe-price" className="bo-input" inputMode="decimal" value={sellingPrice} onChange={(event)=>setSellingPrice(event.target.value)} placeholder="€" data-ui="stock-recipe-price" />
              </FormField>
              <FormField label="Overhead" htmlFor="stock-recipe-overhead">
                <input id="stock-recipe-overhead" className="bo-input" inputMode="decimal" value={overheadPct} onChange={(event)=>setOverheadPct(event.target.value)} placeholder="%" data-ui="stock-recipe-overhead" />
              </FormField>
            </div>
            <label className="bo-stockCheckbox" data-ui="stock-recipe-protected-label">
              <input type="checkbox" checked={isProtected} onChange={(event)=>setIsProtected(event.target.checked)} data-ui="stock-recipe-protected" />
              Plato estratégico/firma: bloquear recomendación de retirada
            </label>
            <Button variant="secondary" className="bo-btn--fit" onClick={()=>void savePricing()} data-ui="stock-recipe-pricing-save">Guardar precio</Button>
          </div>

          <div className="bo-stockSubsection" data-ui="stock-production">
            <h3 className="bo-stockSubtitle" data-ui="stock-production-title">Registrar elaboración</h3>
            <div className="bo-stockFormGrid bo-stockFormGrid--3" data-ui="stock-production-fields">
              <FormField label="Receta" htmlFor="stock-production-recipe">
                <select id="stock-production-recipe" className="bo-input" value={productionRecipeId} onChange={(event) => { setProductionRecipeId(Number(event.target.value)); setPreview([]); }} data-ui="stock-production-recipe">
                  <option value={0} data-ui="stock-production-recipe-empty">Receta</option>
                  {recipes.map((recipe) => <option key={recipe.id} value={recipe.id} data-ui="stock-production-recipe-option">{recipe.name}</option>)}
                </select>
              </FormField>
              <FormField label="Almacén" htmlFor="stock-production-warehouse">
                <select id="stock-production-warehouse" className="bo-input" value={selectedWarehouseId} onChange={(event) => setWarehouseId(Number(event.target.value))} data-ui="stock-production-warehouse">
                  {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id} data-ui="stock-production-warehouse-option">{warehouse.name}</option>)}
                </select>
              </FormField>
              <FormField label="Lotes" htmlFor="stock-production-batches">
                <input id="stock-production-batches" className="bo-input" inputMode="decimal" value={productionBatches} onChange={(event) => setProductionBatches(event.target.value)} data-ui="stock-production-batches" />
              </FormField>
            </div>
            <Button variant="secondary" className="bo-btn--fit" onClick={() => void productionPreview()} data-ui="stock-production-preview">Previsualizar consumo</Button>

            {preview.length ? (
              <div className="bo-stockRowList" data-ui="stock-production-preview-lines">
                <p className="bo-stockNote" data-ui="stock-production-labour-cost">Mano de obra estándar: {previewLabourCost.toFixed(2)} €</p>
                {previewMissingLabour.length ? <p className="bo-stockTextWarning" data-ui="stock-production-labour-missing">Falta salario: {previewMissingLabour.join(", ")}</p> : null}
                {preview.map((line) => (
                  <div className="bo-stockRow" key={line.name} data-ui="stock-production-preview-line">
                    <span data-ui="stock-production-preview-name">{line.name}</span>
                    <span className={line.shortage ? "bo-stockTextDanger" : "bo-stockRowMeta"} data-ui="stock-production-preview-quantity">{line.neededQuantityBase} base / {line.availableQuantityBase} disponible</span>
                  </div>
                ))}
                <Button variant="primary" className="bo-btn--fit" onClick={() => void produce()} data-ui="stock-production-confirm">Confirmar elaboración</Button>
              </div>
            ) : null}
          </div>
        </div>
      </article>

      <article className="bo-panel" data-ui="stock-analytics-panel">
        <div className="bo-panelHead" data-ui="stock-forecast-header">
          <div data-ui="stock-forecast-heading">
            <h2 className="bo-panelTitle" data-ui="stock-forecast-title">Previsión y rentabilidad</h2>
            <p className="bo-panelMeta" data-ui="stock-forecast-confidence">{confidenceLabel} · {forecast.historyDays}/{forecast.requiredHistoryDays} días</p>
          </div>
          <div className="bo-stockRowActions" data-ui="stock-forecast-controls">
            <label className="sr-only" htmlFor="stock-forecast-scenario" data-ui="stock-forecast-scenario-label">Escenario</label>
            <select id="stock-forecast-scenario" className="bo-input bo-input--sm" value={scenario} onChange={(event) => setScenario(event.target.value)} data-ui="stock-forecast-scenario">
              <option value="LIGHT" data-ui="stock-forecast-light">Suave</option>
              <option value="MEDIUM" data-ui="stock-forecast-medium">Media</option>
              <option value="HIGH" data-ui="stock-forecast-high">Alta</option>
            </select>
            <label className="sr-only" htmlFor="stock-forecast-horizon" data-ui="stock-forecast-horizon-label">Horizonte</label>
            <select id="stock-forecast-horizon" className="bo-input bo-input--sm" value={horizon} onChange={(event) => setHorizon(event.target.value)} data-ui="stock-forecast-horizon">
              <option value="7" data-ui="stock-forecast-seven">7 días</option>
              <option value="14" data-ui="stock-forecast-fourteen">14 días</option>
              <option value="30" data-ui="stock-forecast-thirty">30 días</option>
            </select>
          </div>
        </div>

        <div className="bo-panelBody" data-ui="stock-analytics-body">
          <div className="bo-stockFormGrid bo-stockFormGrid--4" data-ui="stock-affluence-form">
            <FormField label="Fecha de afluencia" htmlFor="stock-affluence-date">
              <input id="stock-affluence-date" className="bo-input" type="date" value={affluenceDate} onChange={(event) => setAffluenceDate(event.target.value)} data-ui="stock-affluence-date" />
            </FormField>
            <FormField label="Servicio" htmlFor="stock-affluence-service">
              <select id="stock-affluence-service" className="bo-input" value={affluenceService} onChange={(event) => setAffluenceService(event.target.value)} data-ui="stock-affluence-service">
                <option value="LUNCH" data-ui="stock-affluence-lunch">Comida</option>
                <option value="DINNER" data-ui="stock-affluence-dinner">Cena</option>
                <option value="OTHER" data-ui="stock-affluence-other">Otro</option>
              </select>
            </FormField>
            <FormField label="Comensales" htmlFor="stock-affluence-covers">
              <input id="stock-affluence-covers" className="bo-input" inputMode="numeric" value={affluenceCovers} onChange={(event) => setAffluenceCovers(event.target.value)} data-ui="stock-affluence-covers" />
            </FormField>
            <Button variant="secondary" className="bo-btn--fit" style={{ alignSelf: "end" }} onClick={() => void saveAffluence()} data-ui="stock-affluence-save">Guardar</Button>
          </div>

          <div className="bo-stockRowList" data-ui="stock-forecast-list">
            {forecast.items.filter((item) => item.toOrder > 0).slice(0, 12).map((item) => (
              <div className="bo-stockRow" key={item.itemId} data-ui="stock-forecast-item">
                <span data-ui="stock-forecast-item-name">{item.name}</span>
                <strong className="bo-stockTextAccent" data-ui="stock-forecast-item-order">Pedir {item.toOrder.toFixed(2)} {item.unit}</strong>
              </div>
            ))}
            {!forecast.items.some((item) => item.toOrder > 0) ? <p className="bo-stockNote" data-ui="stock-forecast-empty">Sin pedidos sugeridos con datos actuales.</p> : null}
          </div>

          <div className="bo-stockSubsection" data-ui="stock-costing">
            <h3 className="bo-stockSubtitle" data-ui="stock-costing-title">Coste y margen por receta</h3>
            <div className="bo-stockRowList" data-ui="stock-costing-list">
              {costs.map((cost) => (
                <div className="bo-stockMovement" key={cost.recipeId} data-ui="stock-costing-item">
                  <div className="bo-stockMovementTop" data-ui="stock-costing-item-main">
                    <span data-ui="stock-costing-item-name">{cost.name}{cost.isProtected ? " · protegido" : ""}</span>
                    <StatusBadge variant={ZONE_VARIANT[cost.zone] || "neutral"} size="sm" data-ui="stock-costing-item-zone">{cost.zone} · {(cost.foodCostPct || 0).toFixed(1)}%</StatusBadge>
                  </div>
                  <p className="bo-stockRowMeta" data-ui="stock-costing-item-detail">Ingredientes {(cost.ingredientCost || 0).toFixed(2)} € · personal {(cost.labourCost || 0).toFixed(2)} € · overhead {(cost.overheadCost || 0).toFixed(2)} € · margen {(cost.grossMargin || 0).toFixed(2)} €</p>
                  {cost.missingLabourMembers?.length ? <p className="bo-stockTextWarning" data-ui="stock-costing-missing-labour">Falta salario: {cost.missingLabourMembers.join(", ")}</p> : null}
                </div>
              ))}
            </div>
            <p className="bo-stockNote" data-ui="stock-costing-labour-note">Coste laboral usa minutos por lote y coste empresa vigente del miembro. Actívalo en Configuración.</p>
          </div>

          <div className="bo-stockSubsection" data-ui="stock-ai-advisor">
            <div className="bo-stockSubsectionHead" data-ui="stock-ai-advisor-header">
              <h3 className="bo-stockSubtitle" data-ui="stock-ai-advisor-title">Asesor MiniMax</h3>
              <Button variant="secondary" size="sm" onClick={() => void loadRecommendations()} data-ui="stock-ai-advisor-load">Generar recomendaciones</Button>
            </div>
            {recommendations?.summary ? <p className="bo-stockNote" data-ui="stock-ai-advisor-summary">{recommendations.summary}</p> : null}
            <div className="bo-stockRowList" data-ui="stock-ai-advisor-list">
              {recommendations?.recommendations?.map((recommendation, index) => (
                <article className="bo-stockMovement" key={`${recommendation.type}-${recommendation.item}-${index}`} data-ui="stock-ai-advisor-item">
                  <div className="bo-stockMovementTop" data-ui="stock-ai-advisor-item-main">
                    <strong data-ui="stock-ai-advisor-item-title">{recommendation.item || recommendation.type}</strong>
                    <StatusBadge variant="info" size="sm" data-ui="stock-ai-advisor-item-priority">{recommendation.priority}</StatusBadge>
                  </div>
                  <p className="bo-stockRowMeta" data-ui="stock-ai-advisor-item-reason">{recommendation.reason}</p>
                  <p data-ui="stock-ai-advisor-item-action">{recommendation.suggestedAction}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </article>

      {error ? <InlineAlert kind="error" title="Operaciones" message={error} /> : null}
      {message ? <InlineAlert kind="success" title="Operaciones" message={message} /> : null}
    </section>
  );
}
