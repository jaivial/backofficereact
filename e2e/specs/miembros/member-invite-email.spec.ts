/**
 * E2E: Member invitation / password-reset emails use the per-restaurant
 * email provider settings (SMTP or Gmail) from app/config?content=contacto,
 * not global SMTP env vars.
 *
 * Credentials come from env (loaded by global-setup via .env):
 *   E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD  (admin session)
 *   E2E_SMTP_HOST / E2E_SMTP_USER / E2E_SMTP_PASS / E2E_SMTP_FROM
 *   E2E_GMAIL_FROM / E2E_GMAIL_APP_PASSWORD
 */
import { test, expect } from "../../fixtures/session";
import { TestApiClient } from "../../helpers/api-client";

const EMAIL_PROVIDER_PATH = "/api/admin/config/email-provider";

type DeliveryAttempt = { channel: string; target: string; sent: boolean; error?: string };
type InvitationResponse = {
  success: boolean;
  member?: { id: number };
  invitation?: { created?: boolean; delivery?: DeliveryAttempt[] };
};
type EmailProviderConfig = Record<string, unknown> & { provider?: string };

const SMTP_CONFIG = {
  provider: "smtp",
  smtpHost: process.env.E2E_SMTP_HOST || "smtp.titan.email",
  smtpPort: Number(process.env.E2E_SMTP_PORT || 587),
  smtpUsername: process.env.E2E_SMTP_USER || "reservas@alqueriavillacarmen.com",
  smtpPassword: process.env.E2E_SMTP_PASS || "test-smtp-pass",
  smtpFromEmail: process.env.E2E_SMTP_FROM || "reservas@alqueriavillacarmen.com",
  smtpEncryption: "tls",
  isActive: true,
};

const GMAIL_CONFIG = {
  provider: "gmail",
  gmailFromEmail: process.env.E2E_GMAIL_FROM || "reservas@gmail.com",
  gmailAppPassword: process.env.E2E_GMAIL_APP_PASSWORD || "test-gmail-app-pass",
  isActive: true,
};

function emailAttempt(res: InvitationResponse): DeliveryAttempt | undefined {
  return res.invitation?.delivery?.find((d) => d.channel === "email");
}

test.describe("Miembros - Invitation emails use per-restaurant provider", () => {
  let originalConfig: EmailProviderConfig | null = null;

  test.beforeAll(async ({ browser }) => {
    // Snapshot current provider config so we can restore it afterwards.
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();
    const api = new TestApiClient(page);
    await page.goto("/app/miembros");
    const res = await api.get<{ success: boolean; config: EmailProviderConfig }>(EMAIL_PROVIDER_PATH);
    if (res.success) originalConfig = res.config;
    await context.close();
  });

  test.afterAll(async ({ browser }) => {
    if (!originalConfig) return;
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();
    const api = new TestApiClient(page);
    await page.goto("/app/miembros");
    await api.post(EMAIL_PROVIDER_PATH, originalConfig);
    await context.close();
  });

  test("SMTP: create member + resend route email through DB SMTP config", async ({ adminPage }) => {
    const api = new TestApiClient(adminPage);
    await adminPage.goto("/app/miembros");
    await adminPage.waitForLoadState("networkidle");

    // 1. Configure per-restaurant SMTP provider.
    const saved = await api.post<{ success: boolean; config: EmailProviderConfig }>(EMAIL_PROVIDER_PATH, SMTP_CONFIG);
    expect(saved.success).toBe(true);
    expect(saved.config.provider).toBe("smtp");

    // 2. Create a member with an email → invitation should be delivered by email.
    const ts = Date.now();
    const memberEmail = `e2e-smtp-${ts}@example.com`;
    const created = await api.post<InvitationResponse>("/api/admin/members", {
      firstName: `Smtp${ts}`,
      lastName: `Invite${ts}`,
      email: memberEmail,
      roleSlug: "admin",
      dni: `${ts}SMTP`,
    });
    expect(created.success).toBe(true);
    expect(created.invitation?.created).toBe(true);
    const att = emailAttempt(created);
    expect(att, "email delivery attempt must exist (provider path used)").toBeDefined();
    expect(att!.target).toBe(memberEmail);
    // With reachable SMTP creds it sends; otherwise the error must be a
    // transport error, never "email provider not configured".
    expect(att!.error ?? "").not.toContain("email provider not configured");

    // 3. Resend invitation → email channel present again.
    const resent = await api.post<InvitationResponse>(
      `/api/admin/members/${created.member!.id}/invitation/resend`,
      {},
    );
    expect(resent.success).toBe(true);
    const resendAtt = emailAttempt(resent);
    expect(resendAtt).toBeDefined();
    expect(resendAtt!.error ?? "").not.toContain("email provider not configured");
  });

  test("Gmail: create member routes email through DB Gmail config", async ({ adminPage }) => {
    const api = new TestApiClient(adminPage);
    await adminPage.goto("/app/miembros");
    await adminPage.waitForLoadState("networkidle");

    const saved = await api.post<{ success: boolean; config: EmailProviderConfig }>(EMAIL_PROVIDER_PATH, GMAIL_CONFIG);
    expect(saved.success).toBe(true);
    expect(saved.config.provider).toBe("gmail");

    const ts = Date.now();
    const memberEmail = `e2e-gmail-${ts}@example.com`;
    const created = await api.post<InvitationResponse>("/api/admin/members", {
      firstName: `Gmail${ts}`,
      lastName: `Invite${ts}`,
      email: memberEmail,
      roleSlug: "admin",
      dni: `${ts}GML`,
    });
    expect(created.success).toBe(true);
    const att = emailAttempt(created);
    expect(att, "email delivery attempt must exist for gmail provider").toBeDefined();
    expect(att!.target).toBe(memberEmail);
    // Provider path was used (Gmail), never the not-configured error.
    expect(att!.error ?? "").not.toContain("email provider not configured");
  });

  test("No active provider: invitation email reports not-configured (no env fallback)", async ({ adminPage }) => {
    const api = new TestApiClient(adminPage);
    await adminPage.goto("/app/miembros");
    await adminPage.waitForLoadState("networkidle");

    // Deactivate the provider.
    await api.post(EMAIL_PROVIDER_PATH, { ...SMTP_CONFIG, isActive: false });

    const ts = Date.now();
    const created = await api.post<InvitationResponse>("/api/admin/members", {
      firstName: `NoCfg${ts}`,
      lastName: `Invite${ts}`,
      email: `e2e-nocfg-${ts}@example.com`,
      roleSlug: "admin",
      dni: `${ts}NOC`,
    });
    expect(created.success).toBe(true);
    const att = emailAttempt(created);
    expect(att).toBeDefined();
    expect(att!.sent).toBe(false);
    expect(att!.error ?? "").toContain("email provider not configured");
  });
});
