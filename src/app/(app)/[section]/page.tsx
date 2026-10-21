import Link from "next/link";
import { notFound } from "next/navigation";
import { randomUUID } from "node:crypto";
import { CarFront, CalendarDays, Wallet, Wrench } from "lucide-react";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { overview } from "@/lib/overview";
import { money, dateLabel, invoiceBalance, localInput, dateTime, buffered } from "@/lib/domain";
import { AddLink, Badge, Empty, PageHeader, Panel, SearchForm, ViewLink } from "@/components/ui";
import { FleetCollection, RentalTable, Stat } from "@/components/dashboard";
import { ActionForm, Field } from "@/components/forms";
import { maintenanceAction, maintenanceStateAction } from "@/app/actions";
type Query = {
  q?: string;
  state?: string;
  from?: string;
  to?: string;
  days?: string;
  layout?: string;
};
export default async function SectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<Query>;
}) {
  const { section } = await params;
  const q = await searchParams;
  if (
    !["vehicles", "customers", "rentals", "finance", "maintenance", "reports", "calendar"].includes(
      section,
    )
  )
    notFound();
  const b = await requireBusiness();
  if (section === "vehicles") {
    const data = await overview(b.id);
    let fleet = data.fleet.filter(
      (v) =>
        `${v.make} ${v.model} ${v.plate}`.toLowerCase().includes((q.q || "").toLowerCase()) &&
        (!q.state || v.displayState === q.state),
    );
    let error = "";
    if (q.from && q.to)
      try {
        const start = dateTime(q.from, b.timezone);
        const end = dateTime(q.to, b.timezone);
        if (end <= start) throw new Error("End must be after start.");
        const conflicts = await db.allocation.findMany({
          where: {
            businessId: b.id,
            active: true,
            startAt: { lt: buffered(end, b.turnaroundMinutes) },
            endAt: { gt: start },
          },
          select: { vehicleId: true },
        });
        const ids = new Set(conflicts.map((c) => c.vehicleId));
        fleet = fleet.filter(
          (v) =>
            v.state !== "INACTIVE" &&
            !ids.has(v.id) &&
            !data.active.some((r) => r.vehicleId === v.id && r.endAt < new Date()),
        );
      } catch {
        error = "Enter a valid availability period in your business timezone.";
        fleet = [];
      }
    return (
      <>
        <PageHeader
          eyebrow="VEHICLES"
          title="Fleet"
          description={`${data.fleet.length} vehicles · Rates in ${b.currency}.`}
          action={<AddLink href="/vehicles/new">Add vehicle</AddLink>}
        />
        <SearchForm placeholder="Search make, model, or plate" value={q.q}>
          <select name="state" defaultValue={q.state || ""} aria-label="Vehicle status">
            <option value="">All statuses</option>
            {["AVAILABLE", "ACTIVE", "RESERVED", "MAINTENANCE", "TURNAROUND", "INACTIVE"].map(
              (s) => (
                <option key={s} value={s}>
                  {s.toLowerCase()}
                </option>
              ),
            )}
          </select>
        </SearchForm>
        <Panel
          title="Check availability"
          subtitle={`Select pickup and return times · ${b.timezone}`}
        >
          <form method="get" className="toolbar" style={{ padding: "0 23px 20px" }}>
            <Field label="Pickup">
              <input name="from" type="datetime-local" defaultValue={q.from} required />
            </Field>
            <Field label="Return">
              <input name="to" type="datetime-local" defaultValue={q.to} required />
            </Field>
            <button className="btn btn-secondary">Find vehicles</button>
            <Link className="text-link" href="/vehicles">
              Reset
            </Link>
          </form>
        </Panel>
        <div style={{ height: 22 }} />
        {error && <div className="error-box">{error}</div>}
        {fleet.length ? (
          <FleetCollection
            vehicles={fleet}
            currency={b.currency}
            layout={q.layout}
            filters={{ q: q.q, state: q.state, from: q.from, to: q.to }}
          />
        ) : (
          <Panel>
            <Empty
              title="No vehicles found"
              description="Add a vehicle or adjust your search and availability dates."
              href="/vehicles/new"
              label="Add vehicle"
            />
          </Panel>
        )}
      </>
    );
  }
  if (section === "customers") {
    const customers = await db.customer.findMany({
      where: {
        businessId: b.id,
        ...(q.q
          ? {
              OR: [
                { name: { contains: q.q, mode: "insensitive" as const } },
                { phone: { contains: q.q } },
                { company: { contains: q.q, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      include: { _count: { select: { rentals: true } } },
      orderBy: { name: "asc" },
      take: 100,
    });
    return (
      <>
        <PageHeader
          eyebrow="CUSTOMER MANAGEMENT"
          title="Customers"
          description="Contact details, driving documents, and rental history."
          action={<AddLink href="/customers/new">Add customer</AddLink>}
        />
        <SearchForm placeholder="Search name, company, or phone" value={q.q} />
        <Panel>
          {customers.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Contact</th>
                    <th>Licence expiry</th>
                    <th>Rentals</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link className="table-main table-link" href={`/customers/${c.id}`}>
                          {c.name}
                        </Link>
                        <small className="table-sub">{c.company || "Individual"}</small>
                      </td>
                      <td>
                        {c.phone}
                        <small className="table-sub">{c.email}</small>
                      </td>
                      <td>{c.licenseExpiry.toISOString().slice(0, 10)}</td>
                      <td>{c._count.rentals}</td>
                      <td>
                        <ViewLink href={`/customers/${c.id}`}>Open</ViewLink>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="No customers found"
              description="Add a customer before creating their first rental."
              href="/customers/new"
              label="Add customer"
            />
          )}
        </Panel>
        <p className="chart-note">Showing up to 100 matches. Use search to find older records.</p>
      </>
    );
  }
  if (section === "rentals") {
    const states = [
      "QUOTE",
      "CONFIRMED",
      "ACTIVE",
      "RETURNED",
      "CLOSED",
      "CANCELLED",
      "NO_SHOW",
    ] as const;
    const state = states.find((s) => s === q.state);
    const rentals = await db.rental.findMany({
      where: {
        businessId: b.id,
        ...(state ? { state } : {}),
        ...(q.q
          ? {
              OR: [
                { customer: { name: { contains: q.q, mode: "insensitive" as const } } },
                { vehicle: { plate: { contains: q.q, mode: "insensitive" as const } } },
              ],
            }
          : {}),
      },
      include: { vehicle: true, customer: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return (
      <>
        <PageHeader
          eyebrow="RENTAL MANAGEMENT"
          title="Rentals & reservations"
          description="Manage quotes, reservations, and active rental agreements."
          action={
            <div className="inline-actions">
              <Link className="btn btn-secondary" href="/calendar">
                Fleet calendar
              </Link>
              <AddLink href="/rentals/new">New reservation</AddLink>
            </div>
          }
        />
        <SearchForm placeholder="Search customer or plate" value={q.q}>
          <select name="state" defaultValue={state || ""} aria-label="Rental status">
            <option value="">All statuses</option>
            {states.map((s) => (
              <option key={s} value={s}>
                {s.toLowerCase().replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </SearchForm>
        <Panel>
          {rentals.length ? (
            <RentalTable rentals={rentals} timezone={b.timezone} />
          ) : (
            <Empty
              title="No rentals here yet"
              description="Create a quote, review its price, then confirm a vehicle reservation."
              href="/rentals/new"
              label="Create reservation"
            />
          )}
        </Panel>
        <p className="chart-note">Showing the latest 100 matches.</p>
      </>
    );
  }
  if (section === "finance") {
    const data = await overview(b.id);
    const invoices = await db.invoice.findMany({
      where: { businessId: b.id },
      include: { rental: { include: { customer: true } } },
      orderBy: { issuedAt: "desc" },
      take: 100,
    });
    const billed = data.invoices.reduce(
      (n, i) => n + (i.kind === "INVOICE" ? i.total : -i.total),
      0,
    );
    const cash = data.transactions.reduce(
      (n, t) => n + (t.kind === "PAYMENT" ? t.amount : t.kind === "PAYMENT_REFUND" ? -t.amount : 0),
      0,
    );
    return (
      <>
        <PageHeader
          eyebrow="BILLING & PAYMENTS"
          title="Finance"
          description="Invoices, payments, and deposits stay connected to each rental."
          action={
            <Link className="btn btn-secondary" href="/api/export?type=invoices">
              Export invoices
            </Link>
          }
        />
        <div className="stat-grid">
          <Stat
            label="Net billed, including tax"
            value={money(billed, b.currency)}
            note="Invoices less credit notes · all time"
            icon={Wallet}
          />
          <Stat
            label="Rental payments collected"
            value={money(cash, b.currency)}
            note="External payments less refunds"
            icon={Wallet}
          />
          <Stat
            label="Outstanding invoices"
            value={money(data.receivable, b.currency)}
            note="Positive invoice balances"
            icon={CalendarDays}
          />
          <Stat
            label="Deposits held"
            value={money(data.held, b.currency)}
            note="Separate from rental revenue"
            icon={Wallet}
          />
        </div>
        <Panel
          title="Issued documents"
          subtitle="Latest 100 invoices and credit notes. Open a rental to record payments or adjustments."
        >
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Customer</th>
                  <th>Issued</th>
                  <th>Total</th>
                  <th>Balance</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <span className="table-main">{i.number}</span>
                      <small className="table-sub">
                        {i.kind.replaceAll("_", " ").toLowerCase()}
                      </small>
                    </td>
                    <td>{i.rental.customer.name}</td>
                    <td>{dateLabel(i.issuedAt, b.timezone, "dd MMM yyyy")}</td>
                    <td>
                      {i.kind === "CREDIT_NOTE" ? "−" : ""}
                      {money(i.total, b.currency)}
                    </td>
                    <td>
                      {i.kind === "INVOICE"
                        ? money(invoiceBalance(i, data.invoices, data.transactions), b.currency)
                        : "—"}
                    </td>
                    <td>
                      <ViewLink href={`/rentals/${i.rentalId}`}>Rental</ViewLink>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!invoices.length && (
            <Empty
              title="Your finances start with a rental"
              description="Invoices are issued at checkout and for monthly billing periods."
            />
          )}
        </Panel>
        <div className="inline-actions" style={{ marginTop: 20 }}>
          {["credit-notes", "payments", "deposits"].map((type) => (
            <Link className="btn btn-secondary" key={type} href={`/api/export?type=${type}`}>
              Export {type.replaceAll("-", " ")}
            </Link>
          ))}
        </div>
      </>
    );
  }
  if (section === "maintenance") {
    const [work, vehicles] = await Promise.all([
      db.maintenance.findMany({
        where: { businessId: b.id },
        include: { vehicle: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      db.vehicle.findMany({
        where: { businessId: b.id, state: { not: "INACTIVE" } },
        orderBy: { plate: "asc" },
      }),
    ]);
    const alerts = vehicles.filter(
      (v) =>
        (v.serviceDueDate && v.serviceDueDate <= new Date()) ||
        (v.serviceDueKm !== null && v.odometer >= v.serviceDueKm) ||
        !v.insuranceExpiry ||
        v.insuranceExpiry <= new Date() ||
        !v.registrationExpiry ||
        v.registrationExpiry <= new Date(),
    );
    return (
      <>
        <PageHeader
          eyebrow="FLEET OPERATIONS"
          title="Maintenance"
          description="Schedule work, record costs, and protect vehicle availability."
        />
        {alerts.length > 0 && (
          <div className="notice">
            {alerts.length} vehicles need a service or document review.{" "}
            {alerts.map((v) => v.plate).join(", ")}. Update due dates on each vehicle after
            servicing.
          </div>
        )}
        <div className="detail-grid">
          <Panel title="Work orders" subtitle="Open jobs block the vehicle’s scheduled time.">
            {work.map((w) => (
              <details className="accordion" key={w.id}>
                <summary>
                  {w.title} · {w.vehicle.plate} <Badge value={w.state} />
                </summary>
                <p className="section-note">
                  {dateLabel(w.startAt, b.timezone)} → {dateLabel(w.endAt, b.timezone)}
                  <br />
                  {w.supplier} · {w.notes}
                </p>
                {["SCHEDULED", "IN_PROGRESS"].includes(w.state) ? (
                  <ActionForm action={maintenanceStateAction} submit="Update work order">
                    <input type="hidden" name="id" value={w.id} />
                    <Field label="Status">
                      <select name="state">
                        <option value="IN_PROGRESS">In progress</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="CANCELLED">Cancelled</option>
                      </select>
                    </Field>
                    <Field label={`Recorded cost (${b.currency})`}>
                      <input
                        name="cost"
                        inputMode="decimal"
                        defaultValue={(
                          w.cost /
                          10 **
                            (new Intl.NumberFormat("en", {
                              style: "currency",
                              currency: b.currency,
                            }).resolvedOptions().maximumFractionDigits ?? 2)
                        ).toFixed(
                          new Intl.NumberFormat("en", {
                            style: "currency",
                            currency: b.currency,
                          }).resolvedOptions().maximumFractionDigits,
                        )}
                        required
                      />
                    </Field>
                  </ActionForm>
                ) : (
                  <p className="section-note">Recorded cost: {money(w.cost, b.currency)}</p>
                )}
              </details>
            ))}
            {!work.length && (
              <Empty
                title="Keep things running smoothly"
                description="Schedule your first maintenance job using the form."
              />
            )}
          </Panel>
          <Panel title="Schedule maintenance">
            <div className="detail-body">
              {vehicles.length ? (
                <ActionForm action={maintenanceAction} submit="Schedule work">
                  <Field label="Vehicle">
                    <select name="vehicleId">
                      {vehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.plate} · {v.make} {v.model}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Work required">
                    <input name="title" placeholder="Oil and filter service" required />
                  </Field>
                  <Field label={`Start · ${b.timezone}`}>
                    <input
                      type="datetime-local"
                      name="startAt"
                      defaultValue={localInput(new Date(), b.timezone)}
                      required
                    />
                  </Field>
                  <Field label="End">
                    <input type="datetime-local" name="endAt" required />
                  </Field>
                  <Field label="Supplier">
                    <input name="supplier" />
                  </Field>
                  <Field label={`Cost (${b.currency})`}>
                    <input name="cost" inputMode="decimal" defaultValue="0" required />
                  </Field>
                  <Field label="Notes">
                    <textarea name="notes" />
                  </Field>
                </ActionForm>
              ) : (
                <p className="section-note">Add a vehicle first.</p>
              )}
            </div>
          </Panel>
        </div>
      </>
    );
  }
  if (section === "calendar") {
    let start = new Date();
    try {
      if (q.from) start = dateTime(`${q.from}T00:00`, b.timezone);
    } catch {
      /* use today */
    }
    const end = new Date(start.getTime() + 14 * 86400000);
    const [vehicles, allocations] = await Promise.all([
      db.vehicle.findMany({
        where: { businessId: b.id, state: { not: "INACTIVE" } },
        orderBy: { plate: "asc" },
      }),
      db.allocation.findMany({
        where: { businessId: b.id, active: true, startAt: { lt: end }, endAt: { gt: start } },
      }),
    ]);
    const days = Array.from({ length: 14 }, (_, n) => new Date(start.getTime() + n * 86400000));
    return (
      <>
        <PageHeader
          title="Fleet calendar"
          description="A 14-day planning view. Blue: rental allocation; amber: maintenance."
          action={<AddLink href="/rentals/new">New reservation</AddLink>}
        />
        <form className="toolbar">
          <input
            name="from"
            type="date"
            defaultValue={localInput(start, b.timezone).slice(0, 10)}
            style={{ width: 180 }}
          />
          <button className="btn btn-secondary">Change dates</button>
        </form>
        <Panel>
          <div className="calendar">
            <table>
              <thead>
                <tr>
                  <th>Vehicle</th>
                  {days.map((d) => (
                    <th key={d.toISOString()}>{dateLabel(d, b.timezone, "dd MMM")}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vehicles.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <Link href={`/vehicles/${v.id}`}>
                        {v.plate}
                        <small className="table-sub">
                          {v.make} {v.model}
                        </small>
                      </Link>
                    </td>
                    {days.map((d) => {
                      const a = allocations.find(
                        (a) =>
                          a.vehicleId === v.id &&
                          a.startAt < new Date(d.getTime() + 86400000) &&
                          a.endAt > d,
                      );
                      return (
                        <td
                          key={d.toISOString()}
                          className={
                            a ? (a.kind === "MAINTENANCE" ? "service" : "occupied") : "free"
                          }
                        >
                          {a ? (
                            a.rentalId ? (
                              <Link href={`/rentals/${a.rentalId}`}>Rental</Link>
                            ) : (
                              "Service"
                            )
                          ) : (
                            "·"
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </>
    );
  }
  // Reports: explicit period and cash/revenue separation.
  const days = [30, 90, 365].includes(Number(q.days)) ? Number(q.days) : 30;
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  const [invoices, transactions, work, vehicles, allocations, inspections] = await Promise.all([
    db.invoice.findMany({
      where: { businessId: b.id, issuedAt: { gte: start, lte: end } },
      include: { rental: { select: { vehicleId: true } } },
    }),
    db.moneyTransaction.findMany({
      where: { businessId: b.id, createdAt: { gte: start, lte: end } },
    }),
    db.maintenance.findMany({
      where: { businessId: b.id, state: "COMPLETED", endAt: { gte: start, lte: end } },
    }),
    db.vehicle.findMany({ where: { businessId: b.id } }),
    db.allocation.findMany({
      where: {
        businessId: b.id,
        kind: "MAINTENANCE",
        startAt: { lt: end },
        endAt: { gt: start },
        maintenance: { state: { not: "CANCELLED" } },
      },
    }),
    db.inspection.findMany({ where: { businessId: b.id }, orderBy: { createdAt: "asc" } }),
  ]);
  const net = invoices.reduce((n, i) => n + (i.kind === "INVOICE" ? i.subtotal : -i.subtotal), 0);
  const cash = transactions.reduce(
    (n, t) => n + (t.kind === "PAYMENT" ? t.amount : t.kind === "PAYMENT_REFUND" ? -t.amount : 0),
    0,
  );
  const cost = work.reduce((n, w) => n + w.cost, 0);
  const ms = (s: Date, e: Date) =>
    Math.max(0, Math.min(e.getTime(), end.getTime()) - Math.max(s.getTime(), start.getTime()));
  const rows = vehicles.map((v) => {
    const vehicleInspections = inspections.filter((i) => i.vehicleId === v.id);
    let rented = 0;
    for (const i of vehicleInspections.filter((i) =>
      ["CHECKOUT", "REPLACEMENT_IN"].includes(i.kind),
    )) {
      const returned = vehicleInspections.find(
        (o) =>
          o.rentalId === i.rentalId &&
          ["RETURN", "REPLACEMENT_OUT"].includes(o.kind) &&
          o.createdAt >= i.createdAt,
      );
      rented += ms(i.createdAt, returned?.createdAt || end);
    }
    const downtime = allocations
      .filter((a) => a.vehicleId === v.id)
      .reduce((n, a) => n + ms(a.startAt, a.endAt), 0);
    const capacity = Math.max(0, end.getTime() - Math.max(v.createdAt.getTime(), start.getTime()));
    return {
      ...v,
      rented,
      downtime,
      utilization: capacity > downtime ? Math.min(100, (100 * rented) / (capacity - downtime)) : 0,
      revenue: invoices
        .filter((i) => i.rental.vehicleId === v.id)
        .reduce((n, i) => n + (i.kind === "INVOICE" ? i.subtotal : -i.subtotal), 0),
      cost: work.filter((w) => w.vehicleId === v.id).reduce((n, w) => n + w.cost, 0),
    };
  });
  return (
    <>
      <PageHeader
        eyebrow="PERFORMANCE"
        title="Reports"
        description={`Last ${days} days · ${dateLabel(start, b.timezone, "dd MMM yyyy")} to ${dateLabel(end, b.timezone, "dd MMM yyyy")}.`}
      />
      <form className="toolbar">
        <select name="days" defaultValue={days} aria-label="Reporting period">
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="365">Last 365 days</option>
        </select>
        <button className="btn btn-secondary">Update period</button>
      </form>
      <div className="stat-grid">
        <Stat
          label="Net billed revenue"
          value={money(net, b.currency)}
          note="Excludes tax and refundable deposits"
          icon={Wallet}
        />
        <Stat
          label="Rental payments collected"
          value={money(cash, b.currency)}
          note="External receipts less refunds"
          icon={Wallet}
        />
        <Stat
          label="Maintenance cost"
          value={money(cost, b.currency)}
          note="Completed work in the period"
          icon={Wrench}
        />
        <Stat
          label="Direct contribution"
          value={money(net - cost, b.currency)}
          note="Revenue less recorded maintenance"
          icon={CarFront}
        />
      </div>
      <Panel
        title="Fleet performance"
        subtitle="Utilization uses actual handover-to-return time over fleet age in the period, less scheduled maintenance."
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Utilization</th>
                <th>On-rent days</th>
                <th>Downtime days</th>
                <th>Revenue</th>
                <th>Direct costs</th>
                <th>Contribution</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.id}>
                  <td>
                    <Link href={`/vehicles/${v.id}`}>
                      {v.make} {v.model}
                      <small className="table-sub">{v.plate}</small>
                    </Link>
                  </td>
                  <td>{v.utilization.toFixed(1)}%</td>
                  <td>{(v.rented / 86400000).toFixed(1)}</td>
                  <td>{(v.downtime / 86400000).toFixed(1)}</td>
                  <td>{money(v.revenue, b.currency)}</td>
                  <td>{money(v.cost, b.currency)}</td>
                  <td>{money(v.revenue - v.cost, b.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="chart-note">
          Contribution excludes acquisition, depreciation, insurance, overhead, and tax; it is not
          accounting profit. Replacement-rental revenue is attributed to the final assigned vehicle.
          Current archival status does not reconstruct historical non-rentable time.
        </p>
      </Panel>
    </>
  );
}
