import { test, expect } from "../../fixtures/session";
import { captureConsole, assertNoCriticalErrors } from "../../helpers/console";
import { waitForLoadingToFinish } from "../../helpers/wait";
import { TestApiClient } from "../../helpers/api-client";

test.describe("Miembros - Create Member", () => {
  const ts = Date.now();
  const firstName = `E2E${ts}`;
  const lastName = `Test${ts}`;
  const email = `e2e-member-${ts}@test.com`;

  test("complete add member flow via UI", async ({ adminPage }) => {
    const consoleCapture = captureConsole(adminPage);

    // 1. Navigate to members page
    await adminPage.goto("/app/miembros");
    await adminPage.waitForLoadState("networkidle");
    await waitForLoadingToFinish(adminPage);
    expect(adminPage.url()).toContain("miembros");

    const errorCheck1 = assertNoCriticalErrors(consoleCapture);
    expect(errorCheck1.hasErrors).toBeFalsy();

    // 2. Count members before creation
    const memberCount = await adminPage.getByTestId("member-count").textContent();
    const beforeCount = memberCount ? parseInt(memberCount, 10) : 0;

    // 3. Click "Añadir miembro" button
    const addBtn = adminPage.getByTestId("add-member-button");
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    // 4. Verify modal opened
    await expect(adminPage.getByTestId("member-create-firstname-input")).toBeVisible();

    // 5. Fill form
    await adminPage.getByTestId("member-create-firstname-input").fill(firstName);
    await adminPage.getByTestId("member-create-lastname-input").fill(lastName);
    await adminPage.getByTestId("member-create-email-input").fill(email);
    await adminPage.getByTestId("member-create-dni-input").fill(`${ts}XYZ`);

    // 6. Submit form — page reloads on success
    const submitBtn = adminPage.getByTestId("member-create-submit-button");
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // 7. Wait for page reload and verify member appears in list
    await adminPage.waitForLoadState("networkidle");
    await waitForLoadingToFinish(adminPage);

    await expect(adminPage.getByText(firstName)).toBeVisible();
    await expect(adminPage.getByText(lastName)).toBeVisible();
    await expect(adminPage.getByText(email)).toBeVisible();

    const errorCheck2 = assertNoCriticalErrors(consoleCapture);
    expect(errorCheck2.hasErrors).toBeFalsy();
  });

  test("create member via API returns correct schema", async ({ adminPage }) => {
    const api = new TestApiClient(adminPage);

    const response = await api.post<{
      success: boolean;
      member: { id: number; firstName: string };
      user: { created: boolean };
      provisioning: { hasContact: boolean };
    }>("/api/admin/members", {
      firstName: `APITest${ts}`,
      lastName: `APITest${ts}`,
      email: `e2e-api-member-${ts}@test.com`,
      roleSlug: "admin",
      dni: `${ts}API`,
    });

    expect(response.success).toBe(true);
    expect(response.member).toBeDefined();
    expect(response.member.firstName).toBe(`APITest${ts}`);
    expect(response.member.id).toBeGreaterThan(0);
    expect(response.user).toBeDefined();
    expect(response.user.created).toBe(true);
    expect(response.provisioning).toBeDefined();
    expect(response.provisioning.hasContact).toBe(true);
  });

  test("create member validates required fields", async ({ adminPage }) => {
    const consoleCapture = captureConsole(adminPage);

    await adminPage.goto("/app/miembros");
    await adminPage.waitForLoadState("networkidle");
    await waitForLoadingToFinish(adminPage);

    // Open modal
    await adminPage.getByTestId("add-member-button").click();
    await expect(adminPage.getByTestId("member-create-firstname-input")).toBeVisible();

    // Submit with empty fields should be disabled
    const submitBtn = adminPage.getByTestId("member-create-submit-button");
    await expect(submitBtn).toBeDisabled();

    // Fill only first name — still disabled (missing last name)
    await adminPage.getByTestId("member-create-firstname-input").fill("OnlyFirst");
    await expect(submitBtn).toBeDisabled();

    // Fill last name + email — should be enabled
    await adminPage.getByTestId("member-create-lastname-input").fill("OnlyLast");
    await adminPage.getByTestId("member-create-email-input").fill("only@test.com");
    await expect(submitBtn).toBeEnabled();

    const errorCheck = assertNoCriticalErrors(consoleCapture);
    expect(errorCheck.hasErrors).toBeFalsy();
  });

  test("cancel button closes modal", async ({ adminPage }) => {
    await adminPage.goto("/app/miembros");
    await adminPage.waitForLoadState("networkidle");
    await waitForLoadingToFinish(adminPage);

    // Open modal
    await adminPage.getByTestId("add-member-button").click();
    await expect(adminPage.getByTestId("member-create-firstname-input")).toBeVisible();

    // Click cancel
    await adminPage.getByTestId("member-create-cancel-button").click();

    // Modal should close
    await expect(adminPage.getByTestId("member-create-firstname-input")).not.toBeVisible();
  });
});
