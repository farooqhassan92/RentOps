import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CarFront,
  Clock3,
  Fuel,
  Gauge,
  Grid2X2,
  List,
  Wallet,
} from "lucide-react";
import { AddLink, Badge, CarIllustration, Empty, PageHeader, Panel, ViewLink } from "./ui";
import { dateLabel, money } from "@/lib/domain";

type FleetItem = {
  id: string;
  make: string;
  model: string;
  year: number;
  plate: string;
  category: string;
  odometer: number;
  fuelPercent: number;
  dailyRate: number;
  displayState: string;
};
type RentalItem = {
  id: string;
  state: string;
  startAt: Date;
  endAt: Date;
  customer: { name: string };
  vehicle: { make: string; model: string; plate: string };
};
type FleetProps = { vehicles: FleetItem[]; currency: string; demo?: boolean };

export function Stat({
  label,
  value,
  note,
  icon: Icon,
  tone = "blue",
}: {
  label: string;
  value: ReactNode;
  note: ReactNode;
  icon: typeof CarFront;
  tone?: "blue" | "green" | "amber" | "violet";
}) {
  return (
    <div className={`stat-card stat-${tone}`}>
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-icon">
          <Icon size={19} strokeWidth={1.8} />
        </span>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-foot">{note}</div>
    </div>
  );
}

export function VehicleCards({ vehicles, currency, demo = false }: FleetProps) {
  const colors = ["#9aaec8", "#c1c9d3", "#9dafa8", "#a5b1cb", "#b5b2be", "#b7c2cb"];
  return (
    <div className="vehicle-grid">
      {vehicles.map((vehicle, index) => (
        <article className="vehicle-card" key={vehicle.id}>
          <div className="vehicle-visual">
            <Badge value={vehicle.displayState} />
            <span className="vehicle-class">{vehicle.category}</span>
            <CarIllustration color={colors[index % colors.length]} />
          </div>
          <div className="vehicle-card-content">
            <div className="vehicle-title">
              <div>
                <h3>
                  {vehicle.make} {vehicle.model}
                </h3>
                <p>
                  {vehicle.year} · {vehicle.plate}
                </p>
              </div>
              <CarFront size={17} />
            </div>
            <div className="vehicle-specs">
              <span>
                <Gauge size={14} />
                {vehicle.odometer.toLocaleString()} km
              </span>
              <span>
                <Fuel size={14} />
                {vehicle.fuelPercent}%
              </span>
            </div>
            <div className="vehicle-card-bottom">
              <strong>
                {money(vehicle.dailyRate, currency)}
                <small>/ day</small>
              </strong>
              <Link href={demo ? "/sign-up" : `/vehicles/${vehicle.id}`}>
                {demo ? "Get started" : "View details"}
                <ArrowUpRight size={15} />
              </Link>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export function VehicleList({
  vehicles,
  currency,
  demo = false,
  compact = false,
}: FleetProps & { compact?: boolean }) {
  return (
    <div className={`table-wrap${compact ? " compact-fleet" : ""}`}>
      <table>
        <thead>
          <tr>
            <th>Vehicle</th>
            <th>Status</th>
            {!compact && <th>Odometer</th>}
            <th>Daily rate</th>
            <th>
              <span className="sr-only">Details</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {vehicles.map((vehicle) => (
            <tr key={vehicle.id}>
              <td>
                <div className="vehicle-cell">
                  <span className="vehicle-thumb">
                    <CarIllustration color="#a5b6cc" />
                  </span>
                  <div>
                    <span className="table-main">
                      {vehicle.make} {vehicle.model}
                    </span>
                    <span className="table-sub">
                      {vehicle.plate} · {vehicle.category}
                    </span>
                  </div>
                </div>
              </td>
              <td>
                <Badge value={vehicle.displayState} />
              </td>
              {!compact && <td className="numeric">{vehicle.odometer.toLocaleString()} km</td>}
              <td className="numeric table-main-value">{money(vehicle.dailyRate, currency)}</td>
              <td>
                {demo ? (
                  <span className="sample-cell">Sample</span>
                ) : (
                  <Link
                    className="row-action"
                    href={`/vehicles/${vehicle.id}`}
                    aria-label={`View ${vehicle.make} ${vehicle.model}, ${vehicle.plate}`}
                  >
                    <ArrowUpRight size={17} />
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FleetCollection({
  vehicles,
  currency,
  demo = false,
  layout = "table",
  filters = {},
}: FleetProps & {
  layout?: string;
  filters?: Record<string, string | undefined>;
}) {
  function layoutHref(value: string) {
    const params = new URLSearchParams();
    for (const [key, entry] of Object.entries(filters)) if (entry) params.set(key, entry);
    if (demo) params.set("view", "vehicles");
    params.set("layout", value);
    return `${demo ? "/demo" : "/vehicles"}?${params}`;
  }
  const cards = layout === "cards";
  return (
    <>
      <div className="fleet-results-bar">
        <span>
          {vehicles.length} {vehicles.length === 1 ? "vehicle" : "vehicles"}
        </span>
        <div className="view-switch" aria-label="Fleet display">
          <Link
            aria-label="Table view"
            aria-current={!cards ? "page" : undefined}
            href={layoutHref("table")}
          >
            <List size={17} />
          </Link>
          <Link
            aria-label="Card view"
            aria-current={cards ? "page" : undefined}
            href={layoutHref("cards")}
          >
            <Grid2X2 size={16} />
          </Link>
        </div>
      </div>
      {!vehicles.length ? (
        <Panel>
          <Empty
            title="No vehicles found"
            description="Try a different search or clear your filters."
          />
        </Panel>
      ) : cards ? (
        <VehicleCards vehicles={vehicles} currency={currency} demo={demo} />
      ) : (
        <Panel>
          <VehicleList vehicles={vehicles} currency={currency} demo={demo} />
        </Panel>
      )}
    </>
  );
}

export function RentalTable({
  rentals,
  timezone,
  demo = false,
}: {
  rentals: RentalItem[];
  timezone: string;
  demo?: boolean;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Customer</th>
            <th>Vehicle</th>
            <th>Return date</th>
            <th>Status</th>
            {!demo && (
              <th>
                <span className="sr-only">Details</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rentals.map((rental) => (
            <tr key={rental.id}>
              <td>
                <div className="person">
                  <span className="avatar">
                    {rental.customer.name
                      .split(" ")
                      .map((name) => name[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                  <strong className="table-main">{rental.customer.name}</strong>
                </div>
              </td>
              <td>
                <span className="table-main">
                  {rental.vehicle.make} {rental.vehicle.model}
                </span>
                <small className="table-sub">{rental.vehicle.plate}</small>
              </td>
              <td>
                <span className="table-main">
                  {dateLabel(rental.endAt, timezone, "dd MMM yyyy")}
                </span>
                <small className="table-sub">{dateLabel(rental.endAt, timezone, "HH:mm")}</small>
              </td>
              <td>
                <Badge
                  value={
                    rental.state === "ACTIVE" && rental.endAt < new Date()
                      ? "OVERDUE"
                      : rental.state
                  }
                />
              </td>
              {!demo && (
                <td>
                  <Link
                    aria-label={`Open rental for ${rental.customer.name}`}
                    className="row-action"
                    href={`/rentals/${rental.id}`}
                  >
                    <ArrowUpRight size={17} />
                  </Link>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type DashboardProps = {
  business: { currency: string; timezone: string };
  data: {
    fleet: FleetItem[];
    active: RentalItem[];
    upcoming: RentalItem[];
    available: number;
    overdue: number;
    receivable: number;
    held: number;
  };
  demo?: boolean;
};

export function Dashboard({ business, data, demo = false }: DashboardProps) {
  const total = data.fleet.filter((vehicle) => vehicle.displayState !== "INACTIVE").length;
  const other = Math.max(0, total - data.available - data.active.length);
  const route = (pathname: string) => (demo ? `/demo?view=${pathname.slice(1)}` : pathname);

  return (
    <>
      <PageHeader
        eyebrow={dateLabel(new Date(), business.timezone, "EEEE, dd MMMM yyyy")}
        title="Dashboard"
        description="An overview of your fleet, rentals, and finances."
        action={<AddLink href={demo ? "/sign-up" : "/rentals/new"}>New reservation</AddLink>}
      />
      {data.overdue > 0 && (
        <div className="notice notice-danger">
          {data.overdue} {data.overdue === 1 ? "rental is" : "rentals are"} overdue.{" "}
          <Link href={route("/rentals")}>Review active rentals →</Link>
        </div>
      )}
      <div className="stat-grid">
        <Stat
          label="Available vehicles"
          value={
            <>
              {data.available}
              <small>/ {total}</small>
            </>
          }
          note={
            <>
              <span className="live-dot" />
              Ready to rent
            </>
          }
          icon={CarFront}
          tone="blue"
        />
        <Stat
          label="Active rentals"
          value={data.active.length}
          note={
            <span className={data.overdue ? "danger-text" : "positive"}>
              {data.overdue ? `${data.overdue} overdue returns` : "All returns on schedule"}
            </span>
          }
          icon={CalendarDays}
          tone="violet"
        />
        <Stat
          label="Outstanding balance"
          value={money(data.receivable, business.currency)}
          note="Unpaid invoice balances"
          icon={Wallet}
          tone="amber"
        />
        <Stat
          label="Deposits held"
          value={money(data.held, business.currency)}
          note="Refundable customer funds"
          icon={Clock3}
          tone="green"
        />
      </div>
      <div className="dashboard-grid">
        <Panel
          title="Active rentals"
          subtitle="Upcoming returns, ordered by date."
          action={<ViewLink href={route("/rentals")} />}
        >
          {data.active.length ? (
            <>
              <RentalTable
                rentals={data.active.slice(0, 5)}
                timezone={business.timezone}
                demo={demo}
              />
              <div className="table-footer">
                <span>
                  {data.active.length} active {data.active.length === 1 ? "rental" : "rentals"}
                </span>
                <span>Times in {business.timezone}</span>
              </div>
            </>
          ) : (
            <Empty
              title="No active rentals"
              description="Create a reservation to get started."
              href={demo ? "/sign-up" : "/rentals/new"}
              label="New reservation"
            />
          )}
        </Panel>
        <Panel title="Fleet availability" subtitle="Current status across your fleet.">
          <div className="fleet-health">
            <div className="health-number">
              {data.available}
              <span>of {total} vehicles available</span>
            </div>
            <div
              className="health-bar"
              role="img"
              aria-label={`${data.available} available, ${data.active.length} on rent, ${other} reserved or unavailable`}
            >
              <span className="available" style={{ flex: data.available }} />
              <span className="rented" style={{ flex: data.active.length }} />
              <span className="other" style={{ flex: other }} />
            </div>
            <div className="health-row">
              <span>
                <i className="legend-dot available" />
                Available
              </span>
              <strong>{data.available}</strong>
            </div>
            <div className="health-row">
              <span>
                <i className="legend-dot rented" />
                On rent
              </span>
              <strong>{data.active.length}</strong>
            </div>
            <div className="health-row">
              <span>
                <i className="legend-dot other" />
                Reserved / unavailable
              </span>
              <strong>{other}</strong>
            </div>
            <Link className="fleet-health-link" href={route("/vehicles")}>
              Manage fleet
              <ArrowRight size={15} />
            </Link>
          </div>
        </Panel>
      </div>
      <div className="dashboard-grid dashboard-bottom">
        <Panel
          title="Fleet overview"
          subtitle="Vehicle status and standard daily rates."
          action={<ViewLink href={route("/vehicles")} children="View fleet" />}
        >
          {data.fleet.length ? (
            <VehicleList
              vehicles={data.fleet.slice(0, 4)}
              currency={business.currency}
              demo={demo}
              compact
            />
          ) : (
            <Empty
              title="No vehicles added"
              description="Add your first vehicle and set its rental rates."
              href="/vehicles/new"
              label="Add vehicle"
            />
          )}
        </Panel>
        <Panel title="Upcoming pickups" subtitle="Confirmed reservations to prepare.">
          {data.upcoming.length ? (
            <ul className="pickup-list">
              {data.upcoming.slice(0, 4).map((rental) => (
                <li key={rental.id}>
                  <span className="pickup-icon">
                    <CalendarDays size={19} />
                  </span>
                  <div>
                    <strong>{rental.customer.name}</strong>
                    <span>
                      {rental.vehicle.make} {rental.vehicle.model}
                    </span>
                    <small>{dateLabel(rental.startAt, business.timezone, "dd MMM, HH:mm")}</small>
                  </div>
                  {!demo && (
                    <Link
                      className="row-action"
                      aria-label={`Open pickup for ${rental.customer.name}`}
                      href={`/rentals/${rental.id}`}
                    >
                      <ArrowUpRight size={17} />
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="small-empty">
              <CalendarDays size={24} />
              <strong>No upcoming pickups</strong>
              <p>Confirmed reservations will appear here.</p>
            </div>
          )}
          <div className="panel-bottom-link">
            <ViewLink href={route("/rentals")}>View reservations</ViewLink>
          </div>
        </Panel>
      </div>
    </>
  );
}
