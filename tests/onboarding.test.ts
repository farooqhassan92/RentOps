import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  configured: vi.fn(),
  createBusiness: vi.fn(),
  publicError: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/auth", () => ({ configured: mocks.configured }));
vi.mock("@/lib/service", () => ({
  createBusiness: mocks.createBusiness,
  publicError: mocks.publicError,
}));

import { POST } from "../src/app/api/onboarding/route";

function submission(origin = "http://localhost:3000") {
  return new NextRequest("http://127.0.0.1:3000/api/onboarding", {
    method: "POST",
    headers: { host: "localhost:3000", origin },
    body: new URLSearchParams({
      name: "Test Rentals",
      branchName: "Main",
      country: "Ukraine",
      currency: "USD",
      timezone: "Europe/Kyiv",
      taxRate: "5.5",
      turnaroundMinutes: "120",
      invoicePrefix: "INV",
      ownerClerkId: "untrusted-owner",
    }),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.configured.mockReturnValue(true);
  mocks.auth.mockResolvedValue({ userId: "authenticated-owner" });
  mocks.createBusiness.mockResolvedValue({ id: "saved-business" });
  mocks.publicError.mockReturnValue("Enter a valid business name.");
});

describe("business onboarding", () => {
  it("commits the authenticated owner's business before a document redirect to dashboard", async () => {
    const response = await POST(submission());
    expect(mocks.createBusiness).toHaveBeenCalledWith(
      "authenticated-owner",
      expect.objectContaining({ name: "Test Rentals", taxBps: 550, turnaroundMinutes: 120 }),
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:3000/dashboard");
  });

  it("shows save errors on onboarding instead of navigating to the dashboard", async () => {
    mocks.createBusiness.mockRejectedValue(new Error("Invalid input"));
    const response = await POST(submission());
    const location = new URL(response.headers.get("location")!);
    expect(response.status).toBe(303);
    expect(location.pathname).toBe("/onboarding");
    expect(location.searchParams.get("error")).toBe("Enter a valid business name.");
  });

  it("sends expired sessions to sign-in without writing a business", async () => {
    mocks.auth.mockResolvedValue({ userId: null });
    const response = await POST(submission());
    expect(response.status).toBe(303);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/sign-in");
    expect(mocks.createBusiness).not.toHaveBeenCalled();
  });

  it("rejects cross-origin submissions before authentication or database access", async () => {
    const response = await POST(submission("https://another-site.example"));
    expect(response.status).toBe(403);
    expect(mocks.auth).not.toHaveBeenCalled();
    expect(mocks.createBusiness).not.toHaveBeenCalled();
  });

  it("rejects malformed origins without a server error", async () => {
    const response = await POST(submission("null"));
    expect(response.status).toBe(403);
    expect(mocks.createBusiness).not.toHaveBeenCalled();
  });
});
