import { test } from "../../fixtures/session";
import { redTests, greenTests, refactorTests } from "./templates/crud.template";

const params = {
  foodType: "platos" as const,
  urlPath: "platos",
  requiredFields: ["nombre", "precio"],
  typeField: undefined,
  optionalFields: ["descripcion", "categoria", "alergenos"],
  addButtonSelector: "[data-role='food-list-create-btn']",
  submitButtonSelector: "[data-role='food-form-submit']",
  listPagePath: "/app/comida/platos",
};

test.describe("Platos CRUD E2E Tests", () => {
  redTests(params);
  greenTests(params);
  refactorTests(params);
});
