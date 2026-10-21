import Link from "next/link";
import { notFound } from "next/navigation";
import { randomUUID } from "node:crypto";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  money,
  moneyInput,
  quote,
  dateLabel,
  heldDeposit,
  invoiceBalance,
  rentalBalance,
} from "@/lib/domain";
import { ActionForm, Field } from "@/components/forms";
import {
  BusinessForm,
  CustomerForm,
  Files,
  RentalForm,
  VehicleForm,
} from "@/components/record-forms";
import {
  Badge,
  CarIllustration,
  Empty,
  InspectionFields,
  PageHeader,
  Panel,
  ViewLink,
} from "@/components/ui";
import { RentalTable } from "@/components/dashboard";
import { creditAction, moneyAction, rentalCommandAction, vehicleStateAction } from "@/app/actions";

export default async function RecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string; id: string }>;
  searchParams: Promise<{ vehicle?: string }>;
}) {
  const { section, id } = await params;
  const query = await searchParams;
  if (!["vehicles", "customers", "rentals"].includes(section)) notFound();
  const b = await requireBusiness();
  if (id === "new") {
    if (section === "vehicles")
      return (
        <>
          <PageHeader
            title="Add a vehicle"
            description="Add vehicle details, standard rates, and document expiry dates."
          />
          <div className="panel form-panel">
            <VehicleForm currency={b.currency} />
          </div>
        </>
      );
    if (section === "customers")
      return (
        <>
          <PageHeader
            title="Add a customer"
            description="Add contact details and driving licence information."
          />
          <div className="panel form-panel">
            <CustomerForm />
          </div>
        </>
      );
    const [vehicles, customers] = await Promise.all([
      db.vehicle.findMany({
        where: { businessId: b.id, state: { not: "INACTIVE" } },
        orderBy: { plate: "asc" },
      }),
      db.customer.findMany({ where: { businessId: b.id }, orderBy: { name: "asc" } }),
    ]);
    return (
      <>
        <PageHeader
          eyebrow="RESERVATIONS"
          title="New reservation"
          description="Start with a quote. Confirm it when the details are agreed."
        />
        {!vehicles.length || !customers.length ? (
          <Panel>
            <Empty
              title="Two things before your first rental"
              description="You need at least one vehicle and one customer to create a reservation."
            />
            <div className="inline-actions" style={{ justifyContent: "center", paddingBottom: 30 }}>
              <Link className="btn btn-primary" href="/vehicles/new">
                Add vehicle
              </Link>
              <Link className="btn btn-secondary" href="/customers/new">
                Add customer
              </Link>
            </div>
          </Panel>
        ) : (
          <div className="panel form-panel">
            <RentalForm
              business={b}
              vehicles={vehicles}
              customers={customers}
              selectedVehicle={query.vehicle}
            />
          </div>
        )}
      </>
    );
  }
  const attachments = await db.attachment.findMany({
    where: {
      businessId: b.id,
      entityType:
        section === "vehicles" ? "vehicle" : section === "customers" ? "customer" : "rental",
      entityId: id,
    },
    orderBy: { createdAt: "desc" },
  });
  if (section === "vehicles") {
    const vehicle = await db.vehicle.findFirst({ where: { id, businessId: b.id } });
    if (!vehicle) notFound();
    const rentals = await db.rental.findMany({
      where: {
        businessId: b.id,
        OR: [{ vehicleId: id }, { inspections: { some: { vehicleId: id } } }],
      },
      include: { vehicle: true, customer: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    return (
      <>
        <PageHeader
          eyebrow={vehicle.plate}
          title={`${vehicle.make} ${vehicle.model}`}
          description={`${vehicle.year} · ${vehicle.category} · ${vehicle.odometer.toLocaleString()} km`}
          action={
            <Link className="btn btn-primary" href={`/rentals/new?vehicle=${id}`}>
              Create reservation
            </Link>
          }
        />
        <div className="detail-grid">
          <div className="stack">
            <Panel title="Vehicle details">
              <div className="detail-body">
                <VehicleForm vehicle={vehicle} currency={b.currency} />
              </div>
            </Panel>
            <Panel title="Recent rentals">
              <RentalTable rentals={rentals} timezone={b.timezone} />
            </Panel>
          </div>
          <div className="stack">
            <Panel title="Fleet status">
              <div className="detail-body">
                <CarIllustration />
                <Badge value={vehicle.state === "ACTIVE" ? "READY" : vehicle.state} />
                <p className="section-note" style={{ marginTop: 15 }}>
                  Ready status means operationally prepared. Confirmed bookings and active rentals
                  still control availability.
                </p>
                <ActionForm
                  action={vehicleStateAction}
                  submit={
                    vehicle.state === "INACTIVE"
                      ? "Restore vehicle"
                      : vehicle.state === "TURNAROUND"
                        ? "Mark vehicle ready"
                        : "Archive vehicle"
                  }
                  variant="secondary"
                >
                  <input type="hidden" name="id" value={id} />
                  <input
                    type="hidden"
                    name="state"
                    value={vehicle.state === "ACTIVE" ? "INACTIVE" : "ACTIVE"}
                  />
                </ActionForm>
              </div>
            </Panel>
            <Panel title="Documents & photos">
              <div className="detail-body">
                <Files attachments={attachments} entityType="vehicle" entityId={id} />
              </div>
            </Panel>
          </div>
        </div>
      </>
    );
  }
  if (section === "customers") {
    const customer = await db.customer.findFirst({ where: { id, businessId: b.id } });
    if (!customer) notFound();
    const rentals = await db.rental.findMany({
      where: { businessId: b.id, customerId: id },
      include: { vehicle: true, customer: true },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    return (
      <>
        <PageHeader
          eyebrow="CUSTOMER RECORD"
          title={customer.name}
          description={customer.company || "Individual customer"}
        />
        <div className="detail-grid">
          <div className="stack">
            <Panel title="Contact and driving details">
              <div className="detail-body">
                <CustomerForm customer={customer} />
              </div>
            </Panel>
            <Panel title="Rental history">
              <RentalTable rentals={rentals} timezone={b.timezone} />
            </Panel>
          </div>
          <Panel title="Documents">
            <div className="detail-body">
              <Files attachments={attachments} entityType="customer" entityId={id} />
            </div>
          </Panel>
        </div>
      </>
    );
  }
  const r = await db.rental.findFirst({
    where: { id, businessId: b.id },
    include: {
      vehicle: true,
      customer: true,
      invoices: { orderBy: { issuedAt: "asc" } },
      transactions: { orderBy: { createdAt: "desc" } },
      inspections: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!r) notFound();
  const price = quote(r, b.timezone);
  const held = heldDeposit(r.transactions);
  const balance = rentalBalance(r.invoices, r.transactions);
  const [vehicles, customers] =
    r.state === "QUOTE"
      ? await Promise.all([
          db.vehicle.findMany({ where: { businessId: b.id, state: { not: "INACTIVE" } } }),
          db.customer.findMany({ where: { businessId: b.id } }),
        ])
      : [[], []];
  const replacements =
    r.state === "ACTIVE"
      ? await db.vehicle.findMany({
          where: { businessId: b.id, state: "ACTIVE", id: { not: r.vehicleId } },
        })
      : [];
  const Command = ({
    command,
    submit,
    children,
    variant = "primary",
  }: {
    command: string;
    submit: string;
    children?: React.ReactNode;
    variant?: string;
  }) => (
    <ActionForm action={rentalCommandAction} submit={submit} variant={variant}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="command" value={command} />
      {children}
    </ActionForm>
  );
  return (
    <>
      <PageHeader
        eyebrow={`RENTAL · ${id.slice(-8).toUpperCase()}`}
        title={r.customer.name}
        description={`${r.vehicle.make} ${r.vehicle.model} · ${r.vehicle.plate}`}
        action={
          <div className="inline-actions">
            <Badge value={r.state === "ACTIVE" && r.endAt < new Date() ? "OVERDUE" : r.state} />
            <a
              className="btn btn-secondary"
              href={`/api/documents/contract/${id}`}
              target="_blank"
              rel="noreferrer"
            >
              Print contract
            </a>
          </div>
        }
      />
      <div className="detail-grid">
        <div className="stack">
          <Panel title="The agreement">
            <div className="detail-body">
              <dl className="key-values">
                <div>
                  <dt>Pickup</dt>
                  <dd>{dateLabel(r.startAt, b.timezone)}</dd>
                </div>
                <div>
                  <dt>Expected return</dt>
                  <dd>{dateLabel(r.endAt, b.timezone)}</dd>
                </div>
                <div>
                  <dt>Rate plan</dt>
                  <dd>
                    {money(r.unitRate, b.currency)} / {r.rateUnit.toLowerCase()}
                  </dd>
                </div>
                <div>
                  <dt>Included distance</dt>
                  <dd>
                    {r.includedKm.toLocaleString()} km · {money(r.extraKmRate, b.currency)} / extra
                    km
                  </dd>
                </div>
                <div>
                  <dt>Required deposit</dt>
                  <dd>{money(r.depositRequired, b.currency)}</dd>
                </div>
                <div>
                  <dt>Tax rate</dt>
                  <dd>{r.taxBps / 100}%</dd>
                </div>
                {r.actualReturnAt && (
                  <div>
                    <dt>Actual return</dt>
                    <dd>{dateLabel(r.actualReturnAt, b.timezone)}</dd>
                  </div>
                )}
              </dl>
              {r.notes && (
                <p className="section-note" style={{ marginTop: 20 }}>
                  {r.notes}
                </p>
              )}
            </div>
            {r.state === "QUOTE" && (
              <>
                <details className="accordion">
                  <summary>Edit quote</summary>
                  <RentalForm business={b} vehicles={vehicles} customers={customers} rental={r} />
                </details>
                <div className="detail-body">
                  <Command command="confirm" submit="Confirm reservation" />
                </div>
              </>
            )}
            {r.state === "CONFIRMED" && (
              <details open className="accordion">
                <summary>Vehicle handover</summary>
                <p className="section-note">
                  Record the deposit below, verify documents, and complete your inspection. Upload
                  photos under Documents & photos.
                </p>
                <Command command="checkout" submit="Complete checkout">
                  <InspectionFields
                    odometer={r.vehicle.odometer}
                    fuelPercent={r.vehicle.fuelPercent}
                  />
                </Command>
              </details>
            )}
            {r.state === "ACTIVE" && (
              <details className="accordion">
                <summary>Return this vehicle</summary>
                <p className="section-note">
                  Physical return releases the vehicle to turnaround, even if money is still owed.
                  Extra mileage and late charges are calculated automatically. Early returns retain
                  agreed charges; use a credit note for an approved reduction.
                </p>
                <Command command="return" submit="Complete vehicle return">
                  <InspectionFields
                    odometer={r.vehicle.odometer}
                    fuelPercent={r.vehicle.fuelPercent}
                  />
                  <div className="form-grid">
                    <Field label={`Fuel charge, net (${b.currency})`}>
                      <input name="fuelCharge" inputMode="decimal" defaultValue="0" required />
                    </Field>
                    <Field label={`Damage charge, net (${b.currency})`}>
                      <input name="damageCharge" inputMode="decimal" defaultValue="0" required />
                    </Field>
                  </div>
                  <Field label="Reason for additional charges">
                    <textarea name="reason" />
                  </Field>
                </Command>
              </details>
            )}
            {["CONFIRMED", "ACTIVE"].includes(r.state) && (
              <details className="accordion">
                <summary>Extend rental</summary>
                <Command command="extend" submit="Confirm extension">
                  <Field label={`New return time · ${b.timezone}`}>
                    <input type="datetime-local" name="endAt" required />
                  </Field>
                  <p className="section-note">
                    The agreed rate is retained. Availability is checked before extending; active
                    rentals receive any additional invoice.
                  </p>
                </Command>
              </details>
            )}
            {r.state === "ACTIVE" &&
              !r.inspections.some((i) => i.kind === "REPLACEMENT_OUT") &&
              replacements.length > 0 && (
                <details className="accordion">
                  <summary>Replace vehicle</summary>
                  <Command command="replace" submit="Confirm replacement">
                    <Field label="Replacement vehicle">
                      <select name="vehicleId">
                        {replacements.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.plate} · {v.make} {v.model}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <p className="section-note">
                      One replacement per rental is supported. Pricing stays unchanged. Confirm the
                      incoming odometer against the replacement vehicle.
                    </p>
                    <h3>Outgoing vehicle</h3>
                    <InspectionFields
                      prefix="out_"
                      odometer={r.vehicle.odometer}
                      fuelPercent={r.vehicle.fuelPercent}
                    />
                    <h3>Incoming vehicle</h3>
                    <InspectionFields prefix="in_" odometer={0} fuelPercent={100} />
                    <Field label="Replacement reason">
                      <textarea name="reason" required />
                    </Field>
                  </Command>
                </details>
              )}
            {["QUOTE", "CONFIRMED"].includes(r.state) && (
              <details className="accordion">
                <summary>Cancel or mark no-show</summary>
                <p className="section-note">
                  Cancellation releases the reservation. Any held deposit must be refunded before
                  financial closeout.
                </p>
                <Command command="cancel" submit="Cancel reservation" variant="danger" />
                {r.state === "CONFIRMED" && (
                  <div style={{ marginTop: 12 }}>
                    <Command command="no-show" submit="Mark as no-show" variant="secondary" />
                  </div>
                )}
              </details>
            )}
            {["RETURNED", "CANCELLED", "NO_SHOW"].includes(r.state) && (
              <div className="detail-body">
                <p className="section-note">
                  Close the rental when every invoice is settled and no deposit remains.
                </p>
                <Command command="close" submit="Close rental financially" />
              </div>
            )}
          </Panel>
          <Panel
            title="Invoices & credit notes"
            subtitle="Issued documents are preserved. Record payments against an invoice."
          >
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>Total</th>
                    <th>Balance</th>
                    <th>Print</th>
                  </tr>
                </thead>
                <tbody>
                  {r.invoices.map((i) => (
                    <tr key={i.id}>
                      <td>
                        <span className="table-main">{i.number}</span>
                        <small className="table-sub">{i.description.slice(0, 50)}</small>
                      </td>
                      <td>
                        {i.kind === "CREDIT_NOTE" ? "−" : ""}
                        {money(i.total, b.currency)}
                      </td>
                      <td>
                        {i.kind === "INVOICE"
                          ? money(invoiceBalance(i, r.invoices, r.transactions), b.currency)
                          : "—"}
                      </td>
                      <td>
                        <a
                          className="text-link"
                          href={`/api/documents/invoice/${i.id}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          PDF
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!r.invoices.length && (
              <p className="chart-note">The first invoice is issued at checkout.</p>
            )}
            {r.invoices.some((i) => i.kind === "INVOICE") && r.state !== "CLOSED" && (
              <details className="accordion">
                <summary>Issue a credit note</summary>
                <ActionForm action={creditAction} submit="Issue credit note">
                  <input type="hidden" name="rentalId" value={id} />
                  <input type="hidden" name="requestKey" value={randomUUID()} />
                  <Field label="Original invoice">
                    <select name="invoiceId">
                      {r.invoices
                        .filter((i) => i.kind === "INVOICE")
                        .map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.number} · {money(i.subtotal, b.currency)} net
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field label={`Credit subtotal, excluding tax (${b.currency})`}>
                    <input name="subtotal" inputMode="decimal" required />
                  </Field>
                  <Field label="Reason">
                    <input name="reason" required maxLength={1000} />
                  </Field>
                </ActionForm>
              </details>
            )}
          </Panel>
          <Panel title="Payment & deposit history">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Transaction</th>
                    <th>Amount</th>
                    <th>Method / reference</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {r.transactions.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <span className="table-main">
                          {t.kind.replaceAll("_", " ").toLowerCase()}
                        </span>
                        <small className="table-sub">{dateLabel(t.createdAt, b.timezone)}</small>
                      </td>
                      <td>{money(t.amount, b.currency)}</td>
                      <td>
                        {t.method.toLowerCase()}
                        <small className="table-sub">{t.reference}</small>
                      </td>
                      <td>
                        <a
                          className="text-link"
                          href={`/api/documents/receipt/${t.id}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Receipt
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!r.transactions.length && <p className="chart-note">No transactions recorded yet.</p>}
          </Panel>
          <Panel title="Inspection history">
            {r.inspections.map((i) => (
              <details className="accordion" key={i.id}>
                <summary>
                  {i.kind.replaceAll("_", " ").toLowerCase()} · {dateLabel(i.createdAt, b.timezone)}
                </summary>
                <p className="section-note">
                  {i.odometer.toLocaleString()} km · fuel / charge {i.fuelPercent}%<br />
                  {i.condition}
                </p>
              </details>
            ))}
            {!r.inspections.length && (
              <p className="chart-note">Inspections appear after checkout and return.</p>
            )}
          </Panel>
        </div>
        <div className="stack">
          <Panel title="Rental summary">
            <div className="detail-body">
              <div className="summary-row">
                <span>Base rental, net</span>
                <strong>{money(price.base, b.currency)}</strong>
              </div>
              <div className="summary-row">
                <span>Extras / discount</span>
                <strong>{money(r.extras - r.discount, b.currency)}</strong>
              </div>
              <div className="summary-row">
                <span>Tax</span>
                <strong>{money(price.tax, b.currency)}</strong>
              </div>
              <div className="summary-row total">
                <span>Agreed estimate</span>
                <strong>{money(price.total, b.currency)}</strong>
              </div>
              <p className="section-note" style={{ marginTop: 12 }}>
                Excludes return charges. Monthly invoices round tax per billing period. Monthly
                billing stops at the agreed end; overdue days are billed at return at 1/30 of the
                monthly rate per started day.
              </p>
              <div className="summary-row">
                <span>Invoice balance</span>
                <strong>{money(balance, b.currency)}</strong>
              </div>
              <div className="summary-row">
                <span>Deposit held</span>
                <strong>{money(held, b.currency)}</strong>
              </div>
            </div>
          </Panel>
          {!["QUOTE", "CLOSED"].includes(r.state) && (
            <Panel title="Record a transaction">
              <div className="detail-body">
                <ActionForm action={moneyAction} submit="Record transaction">
                  <input type="hidden" name="rentalId" value={id} />
                  <input type="hidden" name="requestKey" value={randomUUID()} />
                  <Field label="Transaction type">
                    <select name="kind">
                      <option value="DEPOSIT_RECEIVED">Receive deposit</option>
                      <option value="PAYMENT">Receive invoice payment</option>
                      <option value="DEPOSIT_APPLIED">Apply deposit to invoice</option>
                      <option value="DEPOSIT_REFUND">Refund deposit</option>
                      <option value="DEPOSIT_RESTORED">
                        Restore credited deposit to held funds
                      </option>
                      <option value="PAYMENT_REFUND">Refund invoice overpayment</option>
                    </select>
                  </Field>
                  <Field label="Invoice" hint="Leave blank for deposit receipt or deposit refund.">
                    <select name="invoiceId">
                      <option value="">No invoice — deposit only</option>
                      {r.invoices
                        .filter((i) => i.kind === "INVOICE")
                        .map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.number} · balance{" "}
                            {money(invoiceBalance(i, r.invoices, r.transactions), b.currency)}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field label={`Amount (${b.currency})`}>
                    <input name="amount" inputMode="decimal" required />
                  </Field>
                  <Field label="Method">
                    <select name="method">
                      <option value="CASH">Cash</option>
                      <option value="BANK">Bank transfer</option>
                      <option value="CARD">External card terminal</option>
                    </select>
                  </Field>
                  <Field label="External reference">
                    <input name="reference" maxLength={200} />
                  </Field>
                  <Field label="Reason" hint="Required for refunds and deposit deductions.">
                    <input name="reason" maxLength={1000} />
                  </Field>
                </ActionForm>
              </div>
            </Panel>
          )}
          <Panel title="Documents & photos">
            <div className="detail-body">
              <Files attachments={attachments} entityType="rental" entityId={id} />
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
