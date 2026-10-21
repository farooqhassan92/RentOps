"use client";

import { SignOutButton, useUser } from "@clerk/nextjs";
import { ChevronDown, LogOut, UserRound, ArrowLeftRight } from "lucide-react";

export function OnboardingAccount() {
  const { user, isLoaded } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  const name = user?.fullName || email || "Your account";

  return (
    <details
      className="onboarding-account"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.currentTarget.open = false;
          event.currentTarget.querySelector("summary")?.focus();
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
      }}
    >
      <summary aria-label="Account options">
        <span className="onboarding-avatar" aria-hidden="true">
          {user ? name.slice(0, 1).toUpperCase() : <UserRound size={17} />}
        </span>
        <span className="onboarding-account-name">{name}</span>
        <ChevronDown size={15} aria-hidden="true" />
      </summary>
      <div className="onboarding-account-menu">
        <div className="onboarding-account-identity">
          <span>Signed in as</span>
          <strong>{email || name}</strong>
        </div>
        <SignOutButton redirectUrl="/sign-in">
          <button type="button" disabled={!isLoaded}>
            <ArrowLeftRight size={16} aria-hidden="true" />
            Use another account
          </button>
        </SignOutButton>
        <SignOutButton redirectUrl="/">
          <button type="button" disabled={!isLoaded}>
            <LogOut size={16} aria-hidden="true" />
            Sign out
          </button>
        </SignOutButton>
      </div>
    </details>
  );
}
