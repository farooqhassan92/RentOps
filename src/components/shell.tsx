"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { UserButton } from "@clerk/nextjs";
import {
  ArrowUpRight,
  BarChart3,
  Building2,
  CalendarDays,
  CarFront,
  ChevronRight,
  LayoutDashboard,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
  Wrench,
  X,
} from "lucide-react";

const links = [
  ["/dashboard", "Dashboard", LayoutDashboard],
  ["/vehicles", "Fleet", CarFront],
  ["/rentals", "Rentals", CalendarDays],
  ["/customers", "Customers", Users],
  ["/finance", "Finance", Wallet],
  ["/maintenance", "Maintenance", Wrench],
  ["/reports", "Reports", BarChart3],
] as const;

export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="RentOps home">
      <span className="brand-mark">
        <CarFront size={22} strokeWidth={1.8} />
      </span>
      <span>RentOps</span>
    </Link>
  );
}

type ShellProps = {
  business: { name: string; branchName: string; currency: string };
  children: ReactNode;
  demo?: boolean;
  demoView?: string;
};

export function Shell({ business, children, demo = false, demoView = "dashboard" }: ShellProps) {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const sectionName =
    links.find(([href]) => (demo ? href === `/${demoView}` : pathname.startsWith(href)))?.[1] ||
    (pathname === "/calendar" ? "Fleet calendar" : "Settings");
  const settingsHref = demo ? "/setup" : "/settings";

  function closeMenu() {
    dialog.current?.close();
    setMenuOpen(false);
  }

  function sidebarContent() {
    return (
      <>
        <div className="sidebar-brand">
          <Brand />
        </div>
        <div className="workspace">
          <span className="workspace-icon">
            <Building2 size={19} />
          </span>
          <div>
            <strong>{business.name}</strong>
            <small>{business.branchName}</small>
          </div>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Workspace navigation">
          {links.map(([href, label, Icon]) => {
            const active = demo ? href === `/${demoView}` : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={demo ? `/demo?view=${href.slice(1)}` : href}
                onClick={closeMenu}
                className={`nav-link${active ? " active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={19} strokeWidth={1.7} />
                {label}
                {active && <span className="nav-active-dot" />}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="workspace-note">
            <ShieldCheck size={19} />
            <div>
              <strong>Your private workspace</strong>
              <p>One owner. One branch.</p>
            </div>
          </div>
          <Link
            className={`nav-link${pathname === "/settings" ? " active" : ""}`}
            href={settingsHref}
            onClick={closeMenu}
          >
            <Settings size={19} strokeWidth={1.7} />
            Settings
          </Link>
          <div className="owner-profile">
            <span className="avatar">{business.name.slice(0, 1)}</span>
            <div>
              <strong>Business owner</strong>
              <small>{demo ? "Sample workspace" : business.branchName}</small>
            </div>
            <span className="owner-role">Owner</span>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar">{sidebarContent()}</aside>
      <dialog
        id="mobile-navigation"
        className="mobile-sidebar"
        ref={dialog}
        aria-label="Main navigation"
        onClose={() => setMenuOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeMenu();
        }}
      >
        <button
          className="mobile-close icon-button"
          onClick={closeMenu}
          aria-label="Close navigation"
        >
          <X size={20} />
        </button>
        {sidebarContent()}
      </dialog>
      <div className="main-area">
        <header className="topbar">
          <div className="topbar-location">
            <button
              className="mobile-menu icon-button"
              aria-label="Open navigation"
              aria-controls="mobile-navigation"
              aria-expanded={menuOpen}
              onClick={() => {
                dialog.current?.showModal();
                setMenuOpen(true);
              }}
            >
              <Menu size={21} />
            </button>
            <div className="breadcrumb">
              <span>Workspace</span>
              <ChevronRight size={13} />
              <strong>{sectionName}</strong>
            </div>
          </div>
          <div className="topbar-right">
            <form className="global-search" action={demo ? "/demo" : "/vehicles"}>
              {demo && <input type="hidden" name="view" value="vehicles" />}
              <Search size={16} aria-hidden="true" />
              <input name="q" aria-label="Search fleet" placeholder="Search fleet…" />
              <button type="submit" aria-label="Search fleet">
                <ChevronRight size={15} />
              </button>
            </form>
            <span className="branch-tag">
              <span className="live-dot" />
              {business.branchName}
            </span>
            <span className="currency-tag">{business.currency}</span>
            {!demo && <UserButton />}
          </div>
        </header>
        {demo && (
          <div className="demo-banner">
            <span>
              <span className="demo-tag">PREVIEW</span>Read-only preview · All names and figures are
              sample data.
            </span>
            <Link href="/sign-up">
              Create your workspace
              <ArrowUpRight size={14} />
            </Link>
          </div>
        )}
        <main className="main-content" id="main-content">
          {children}
        </main>
        <footer className="app-footer">
          <span>RentOps</span>
          <span>Fleet management, simplified.</span>
        </footer>
      </div>
    </div>
  );
}
