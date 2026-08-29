import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("vike-react/usePageContext", () => ({
  usePageContext: () => mockPageContext,
}));

let mockPageContext: {
  bo: { session: { user: { role: string; roleImportance: number; appVersion?: string; email: string } } | null };
  data: Record<string, unknown>;
};

vi.mock("jotai", () => ({
  atom: (init: unknown) => ({ init }),
  useAtomValue: () => mockPageContext.bo?.session ?? null,
  useSetAtom: () => vi.fn(),
  useAtom: () => [null, vi.fn()],
}));

vi.mock("lucide-react", () => {
  const icon = () => <span data-testid="mock-icon" />;
  return {
    Loader2: icon,
    Mail: icon,
    Pencil: icon,
    RefreshCcw: icon,
    Trash2: icon,
    Upload: icon,
    ChevronDown: icon,
  };
});

const setUserVersion = vi.fn().mockResolvedValue({ success: true, user: { id: 5, appVersion: "0.2" } });
const membersPatch = vi.fn();
const membersUploadAvatar = vi.fn();
const membersResendInvitation = vi.fn();
const membersSendPasswordReset = vi.fn();
const membersDelete = vi.fn();

vi.mock("../../../../api/client", () => ({
  createClient: () => ({
    members: {
      patch: membersPatch,
      uploadAvatar: membersUploadAvatar,
      resendInvitation: membersResendInvitation,
      sendPasswordReset: membersSendPasswordReset,
      delete: membersDelete,
    },
    roles: { setUserVersion },
  }),
}));

vi.mock("./_shared/realtime", () => ({
  useMemberLive: () => ({ liveEntry: null, tick: 0 }),
  formatElapsedHHMMSS: () => "00:00:00",
}));

vi.mock("../../../../ui/feedback/useToasts", () => ({
  useToasts: () => ({ pushToast: vi.fn() }),
}));

vi.mock("../../../../ui/feedback/useErrorToast", () => ({
  useErrorToast: () => undefined,
}));

vi.mock("../../../../ui/widgets/roles/RoleIcon", () => ({
  RoleIcon: () => <span data-testid="mock-role-icon" />,
}));

import Page from "./+Page";

const member = {
  id: 7,
  boUserId: 5,
  firstName: "Ana",
  lastName: "Garcia",
  email: "ana@villacarmen.com",
  dni: "12345678A",
  bankAccount: null,
  phone: null,
  whatsappNumber: null,
  photoUrl: null,
  weeklyContractHours: 40,
};

function makeData() {
  mockPageContext = {
    bo: { session: { user: { role: "root", roleImportance: 100, appVersion: "0.2", email: "root@villacarmen.com" } } },
    data: {
      member,
      error: null,
      roles: [
        { id: 1, slug: "root", label: "Root", importance: 100, iconKey: "crown" },
        { id: 2, slug: "admin", label: "Admin", importance: 90, iconKey: "shield" },
      ],
      memberRole: { slug: "admin", label: "Admin", importance: 90, appVersion: "0.1" },
    },
  };
}

beforeEach(() => {
  setUserVersion.mockClear();
  makeData();
});

describe("Miembro detalle — A/B app version control", () => {
  it("root viewer sees the version Select for a member with boUser", async () => {
    await act(async () => {
      render(<Page />);
    });
    expect(screen.getByTestId("miembro-detail-version-select")).toBeTruthy();
    expect(screen.queryByTestId("miembro-detail-version-readonly")).toBeNull();
  });

  it("non-root viewer sees the readonly version badge instead of the Select", async () => {
    mockPageContext.bo!.session = { user: { role: "admin", roleImportance: 90, appVersion: "0.2", email: "admin@villacarmen.com" } };
    await act(async () => {
      render(<Page />);
    });
    expect(screen.getByTestId("miembro-detail-version-readonly")).toBeTruthy();
    expect(screen.queryByTestId("miembro-detail-version-select")).toBeNull();
  });

  it("changing the version calls roles.setUserVersion with the member's boUserId", async () => {
    await act(async () => {
      render(<Page />);
    });

    const trigger = screen.getByRole("button", { name: "Seleccionar version de app" });
    await act(async () => {
      fireEvent.click(trigger);
    });

    const option = await screen.findByRole("option", { name: /v0\.2/ });
    await act(async () => {
      fireEvent.click(option);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(setUserVersion).toHaveBeenCalledWith(5, "0.2");
  });
});
