import { test } from "../../fixtures/session";
import { redTests, greenTests, refactorTests } from "./templates/crud.template";

const params = {
  foodType: "bebidas" as const,
  urlPath: "bebidas",
  requiredFields: ["nombre", "precio"],
  typeField: undefined,
  optionalFields: ["descripcion", "categoria"],
  addButtonSelector: "[data-role='food-list-create-btn']",
  submitButtonSelector: "[data-role='food-form-submit']",
  listPagePath: "/app/comida/bebidas",
};

test.describe("Bebidas CRUD E2E Tests", () => {
  redTests(params);
  greenTests(params);
  refactorTests(params);
});
