import { test } from "../../fixtures/session";
import { redTests, greenTests, refactorTests } from "./templates/crud.template";

const params = {
  foodType: "cafes" as const,
  urlPath: "cafes",
  requiredFields: ["nombre", "precio"],
  typeField: {
    name: "tipo",
    options: [
      "solo",
      "con_leche",
      "cortado",
      "descafeinado",
      "capuccino",
      "americano",
      "irish",
      "con_hiel",
    ],
  },
  optionalFields: ["descripcion"],
  addButtonSelector: "[data-role='food-list-create-btn']",
  submitButtonSelector: "[data-role='food-form-submit']",
  listPagePath: "/app/comida/cafes",
};

test.describe("Cafes CRUD E2E Tests", () => {
  redTests(params);
  greenTests(params);
  refactorTests(params);
});
