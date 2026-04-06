import { test, expect } from "../../fixtures/session";

test.describe("Config - Email Provider Settings", () => {
  test("renders accordion on Contacto tab", async ({ adminPage }) => {
    await adminPage.goto("https://localhost:3001/app/config?content=contacto");
    await adminPage.waitForLoadState("networkidle");
    await expect(adminPage.getByTestId("email-provider-trigger")).toBeVisible();
  });

  test("expanding accordion shows SMTP fields by default", async ({ adminPage }) => {
    await adminPage.goto("https://localhost:3001/app/config?content=contacto");
    await adminPage.waitForLoadState("networkidle");
    await adminPage.getByTestId("email-provider-trigger").click();
    await expect(adminPage.getByTestId("email-smtp-host")).toBeVisible();
    await expect(adminPage.getByTestId("email-smtp-port")).toBeVisible();
    await expect(adminPage.getByTestId("email-smtp-username")).toBeVisible();
  });

  test("switching to Gmail provider shows Gmail fields", async ({ adminPage }) => {
    await adminPage.goto("https://localhost:3001/app/config?content=contacto");
    await adminPage.waitForLoadState("networkidle");
    await adminPage.getByTestId("email-provider-trigger").click();
    await adminPage.getByTestId("email-provider-select").click();
    await adminPage.getByRole("option", { name: "Gmail" }).click();
    await expect(adminPage.getByTestId("email-gmail-from")).toBeVisible();
    await expect(adminPage.getByTestId("email-gmail-app-password")).toBeVisible();
  });

  test("Guardar button is disabled when SMTP fields are empty", async ({ adminPage }) => {
    await adminPage.goto("https://localhost:3001/app/config?content=contacto");
    await adminPage.waitForLoadState("networkidle");
    await adminPage.getByTestId("email-provider-trigger").click();
    await expect(adminPage.getByTestId("email-save-button")).toBeDisabled();
  });

  test("Guardar button enables when SMTP fields are filled", async ({ adminPage }) => {
    await adminPage.goto("https://localhost:3001/app/config?content=contacto");
    await adminPage.waitForLoadState("networkidle");
    await adminPage.getByTestId("email-provider-trigger").click();
    await adminPage.getByTestId("email-smtp-host").fill("smtp.gmail.com");
    await adminPage.getByTestId("email-smtp-port").fill("587");
    await adminPage.getByTestId("email-smtp-username").fill("test@example.com");
    await adminPage.getByTestId("email-smtp-password").fill("secret123");
    await adminPage.getByTestId("email-smtp-from").fill("noreply@example.com");
    await expect(adminPage.getByTestId("email-save-button")).toBeEnabled();
  });

  test("saves SMTP configuration successfully", async ({ adminPage }) => {
    await adminPage.goto("https://localhost:3001/app/config?content=contacto");
    await adminPage.waitForLoadState("networkidle");
    await adminPage.getByTestId("email-provider-trigger").click();
    await adminPage.getByTestId("email-smtp-host").fill("smtp.example.com");
    await adminPage.getByTestId("email-smtp-port").fill("465");
    await adminPage.getByTestId("email-smtp-username").fill("user@example.com");
    await adminPage.getByTestId("email-smtp-password").fill("password123");
    await adminPage.getByTestId("email-smtp-from").fill("restaurant@example.com");
    await adminPage.getByTestId("email-save-button").click();
    await expect(adminPage.getByRole("status").getByText("Guardado")).toBeVisible({ timeout: 10000 });
  });

  test("loaded config persists after navigation", async ({ adminPage }) => {
    await adminPage.goto("https://localhost:3001/app/config?content=contacto");
    await adminPage.waitForLoadState("networkidle");
    await adminPage.getByTestId("email-provider-trigger").click();
    await adminPage.getByTestId("email-smtp-host").fill("smtp.persist.com");
    await adminPage.getByTestId("email-smtp-port").fill("587");
    await adminPage.getByTestId("email-smtp-username").fill("persist@test.com");
    await adminPage.getByTestId("email-smtp-password").fill("password456");
    await adminPage.getByTestId("email-smtp-from").fill("info@persist.com");
    await adminPage.getByTestId("email-save-button").click();
    await expect(adminPage.getByRole("status").getByText("Guardado")).toBeVisible({ timeout: 10000 });
    await adminPage.reload();
    await adminPage.waitForLoadState("networkidle");
    await adminPage.getByTestId("email-provider-trigger").click();
    await expect(adminPage.getByTestId("email-smtp-host")).toHaveValue("smtp.persist.com");
    await expect(adminPage.getByTestId("email-smtp-port")).toHaveValue("587");
  });

  test("seeds via API then verifies loaded in UI", async ({ adminPage }) => {
    await adminPage.evaluate(async () => {
      await fetch("/api/admin/config/email-provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "gmail",
          gmailFromEmail: "seeded@gmail.com",
          gmailAppPassword: "abcd1234efgh5678",
          isActive: true,
        }),
      });
    });
    await adminPage.goto("https://localhost:3001/app/config?content=contacto");
    await adminPage.waitForLoadState("networkidle");
    await adminPage.getByTestId("email-provider-trigger").click();
    await adminPage.getByTestId("email-provider-select").click();
    await adminPage.getByRole("option", { name: "Gmail" }).click();
    await expect(adminPage.getByTestId("email-gmail-from")).toHaveValue("seeded@gmail.com");
  });
});
