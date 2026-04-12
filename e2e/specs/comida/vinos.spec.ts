import { test } from "../../fixtures/session";
import { redTests, greenTests, refactorTests } from "./templates/crud.template";

const params = {
  foodType: "vinos" as const,
  urlPath: "vinos",
  requiredFields: ["nombre", "tipo", "precio"],
  typeField: {
    name: "tipo",
    options: ["TINTO", "BLANCO", "CAVA", "ROSADO"],
  },
  optionalFields: [
    "bodega",
    "denominacion_origen",
    "graduacion",
    "anyo",
    "descripcion",
  ],
  addButtonSelector: "[data-role='food-list-create-btn']",
  submitButtonSelector: "[data-role='food-form-submit']",
  listPagePath: "/app/comida/vinos",
};

test.describe("Vinos CRUD E2E Tests", () => {
  redTests(params);
  greenTests(params);
  refactorTests(params);
});
