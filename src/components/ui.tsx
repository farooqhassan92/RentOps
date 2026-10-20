import Link from "next/link";
import { ArrowUpRight, CarFront, Plus, Search } from "lucide-react";
import type { ReactNode } from "react";
import { Field } from "./forms";
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function AddLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link className="btn btn-primary" href={href}>
      <Plus size={17} />
      {children}
    </Link>
  );
}
export function Badge({ value }: { value: string }) {
  const labels: Record<string, string> = {
    ACTIVE: "On rent",
    AVAILABLE: "Available",
    READY: "Ready",
    TURNAROUND: "Turnaround",
    INACTIVE: "Archived",
    CONFIRMED: "Confirmed",
    RETURNED: "Returned",
    CLOSED: "Closed",
    QUOTE: "Quote",
    CANCELLED: "Cancelled",
    NO_SHOW: "No-show",
    SCHEDULED: "Scheduled",
    IN_PROGRESS: "In progress",
    COMPLETED: "Completed",
    OVERDUE: "Overdue",
    MAINTENANCE: "Maintenance",
    RESERVED: "Reserved",
  };
  return (
    <span className={`badge badge-${value.toLowerCase().replaceAll("_", "-")}`}>
      <i />
      {labels[value] || value.replaceAll("_", " ").toLowerCase()}
    </span>
  );
}
export function Empty({
  title,
  description,
  href,
  label,
}: {
  title: string;
  description: string;
  href?: string;
  label?: string;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <CarFront size={26} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {href && <AddLink href={href}>{label || "Get started"}</AddLink>}
    </div>
  );
}
export function SearchForm({
  placeholder,
  value,
  children,
}: {
  placeholder: string;
  value?: string;
  children?: ReactNode;
}) {
  return (
    <form className="toolbar" method="get">
      <div className="search-input">
        <Search size={17} />
        <input aria-label={placeholder} name="q" defaultValue={value} placeholder={placeholder} />
      </div>
      {children}
      <button className="btn btn-secondary">Search</button>
    </form>
  );
}
export function Panel({
  title,
  subtitle,
  children,
  action,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {title && (
        <div className="panel-heading">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
export function ViewLink({ href, children = "View all" }: { href: string; children?: ReactNode }) {
  return (
    <Link className="text-link" href={href}>
      {children}
      <ArrowUpRight size={15} />
    </Link>
  );
}
export function InspectionFields({
  odometer,
  fuelPercent,
  prefix = "",
}: {
  odometer: number;
  fuelPercent: number;
  prefix?: string;
}) {
  return (
    <>
      <div className="form-grid">
        <Field label="Odometer (km)">
          <input
            type="number"
            name={prefix + "odometer"}
            defaultValue={odometer}
            min={odometer}
            required
          />
        </Field>
        <Field label="Fuel / charge (%)">
          <input
            type="number"
            name={prefix + "fuelPercent"}
            defaultValue={fuelPercent}
            min="0"
            max="100"
            required
          />
        </Field>
      </div>
      <Field label="Condition and damage notes">
        <textarea
          name={prefix + "condition"}
          placeholder="Record existing marks, damage, cleanliness, and equipment."
          required
          maxLength={3000}
        />
      </Field>
      <div className="checklist">
        {["exterior", "interior", "equipment"].map((item) => (
          <label key={item}>
            <input type="checkbox" name={prefix + item} required />
            {item === "exterior"
              ? "Exterior inspected"
              : item === "interior"
                ? "Interior inspected"
                : "Keys and equipment checked"}
          </label>
        ))}
      </div>
    </>
  );
}
export function CarIllustration({
  color = "#b7bec5",
  compact = false,
}: {
  color?: string;
  compact?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 360 160"
      className={compact ? "car-art compact" : "car-art"}
      role="img"
      aria-label="Vehicle illustration"
    >
      <ellipse cx="182" cy="131" rx="142" ry="9" fill="#000" opacity=".07" />
      <path
        d="M34 94 60 84 94 49Q102 41 123 40h95q22 0 38 20l27 24 34 9q14 4 15 17v12H26v-15q0-9 8-13"
        fill={color}
      />
      <path d="m100 48-31 37h97V47h-43q-15 0-23 1m76-1v38h92l-24-24q-12-14-29-14" fill="#344150" />
      <path d="m111 49-29 33h12l30-33m55 0v33h8V49" fill="#fff" opacity=".17" />
      <path d="M30 101h35l-7 13H28m281-14h20v11h-26" fill="#f8eee2" />
      <path
        d="M107 93h29m55 0h29"
        stroke="#23303d"
        opacity=".45"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path d="M165 47v71m112-30 5 24M67 87l-3 20" stroke="#000" opacity=".12" fill="none" />
      <path d="M27 119h303" stroke="#374151" strokeWidth="7" />
      <circle cx="88" cy="120" r="24" fill="#23303a" />
      <circle cx="88" cy="120" r="13" fill="#cbd0d4" />
      <circle cx="88" cy="120" r="6" fill="#6d7780" />
      <circle cx="270" cy="120" r="24" fill="#23303a" />
      <circle cx="270" cy="120" r="13" fill="#cbd0d4" />
      <circle cx="270" cy="120" r="6" fill="#6d7780" />
    </svg>
  );
}
