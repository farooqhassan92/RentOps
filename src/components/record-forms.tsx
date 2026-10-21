import { ActionForm, Field, RentalPricing } from "./forms";
import {
  customerAction,
  onboardingAction,
  rentalAction,
  settingsAction,
  vehicleAction,
  attachmentAction,
} from "@/app/actions";
import type { Business, Customer, Vehicle, Rental, Attachment } from "@/generated/prisma/client";
import { localInput, moneyInput } from "@/lib/domain";
const d = (value?: Date | null) => value?.toISOString().slice(0, 10) || "";
export function BusinessForm({ business, error }: { business?: Business; error?: string }) {
  return (
    <ActionForm
      action={business ? settingsAction : onboardingAction}
      endpoint={business ? undefined : "/api/onboarding"}
      error={error}
      submit={business ? "Save workspace settings" : "Create my workspace"}
    >
      <div className="form-section">
        <h2>Your business</h2>
        <div className="form-grid">
          <Field label="Business name">
            <input
              name="name"
              defaultValue={business?.name}
              placeholder="Your rental company"
              required
              maxLength={200}
            />
          </Field>
          <Field label="Branch name">
            <input
              name="branchName"
              defaultValue={business?.branchName}
              placeholder="Main office"
              required
            />
          </Field>
          <Field label="Country">
            <input
              name="country"
              defaultValue={business?.country}
              placeholder="Country of operation"
              required
            />
          </Field>
          <Field label="Currency" hint="Cannot change after vehicles or rentals are added.">
            <select name="currency" defaultValue={business?.currency || "USD"}>
              {Intl.supportedValuesOf("currency").map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Timezone" hint="Rental times use this timezone.">
            <input
              name="timezone"
              list="timezones"
              defaultValue={business?.timezone || "UTC"}
              required
            />
            <datalist id="timezones">
              {["UTC", ...Intl.supportedValuesOf("timeZone")].map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </Field>
          <Field label="Contact email">
            <input name="email" type="email" defaultValue={business?.email} />
          </Field>
          <Field label="Phone">
            <input name="phone" defaultValue={business?.phone} />
          </Field>
          <Field label="Address">
            <input name="address" defaultValue={business?.address} />
          </Field>
        </div>
      </div>
      <div className="form-section">
        <h2>Rental and invoice defaults</h2>
        <div className="form-grid">
          <Field label="Tax rate (%)" hint="Tax is added to the agreed net charges.">
            <input
              name="taxRate"
              type="number"
              min="0"
              max="100"
              step="0.01"
              defaultValue={(business?.taxBps || 0) / 100}
              required
            />
          </Field>
          <Field label="Tax / business registration number">
            <input name="taxId" defaultValue={business?.taxId} />
          </Field>
          <Field label="Invoice prefix">
            <input
              name="invoicePrefix"
              defaultValue={business?.invoicePrefix || "INV"}
              required
              pattern="[A-Z0-9-]{1,12}"
            />
          </Field>
          <Field label="Turnaround buffer (minutes)">
            <input
              type="number"
              name="turnaroundMinutes"
              min="0"
              max="1440"
              defaultValue={business?.turnaroundMinutes ?? 120}
              required
            />
          </Field>
          <Field
            label="Contract terms"
            className="full"
            hint="Saved onto each quote. Have terms and invoice requirements reviewed for your country before live use."
          >
            <textarea
              name="contractTerms"
              defaultValue={business?.contractTerms}
              rows={5}
              placeholder="Your agreed rental conditions, fuel policy, insurance excess, and return requirements."
              maxLength={15000}
            />
          </Field>
        </div>
      </div>
    </ActionForm>
  );
}
export function VehicleForm({ vehicle, currency }: { vehicle?: Vehicle; currency: string }) {
  return (
    <ActionForm action={vehicleAction} submit={vehicle ? "Save vehicle" : "Add vehicle"}>
      {vehicle && <input type="hidden" name="id" value={vehicle.id} />}
      <div className="form-section">
        <h2>Vehicle details</h2>
        <div className="form-grid">
          <Field label="Registration plate">
            <input name="plate" defaultValue={vehicle?.plate} required maxLength={30} />
          </Field>
          <Field label="VIN">
            <input name="vin" defaultValue={vehicle?.vin || ""} maxLength={40} />
          </Field>
          <Field label="Make">
            <input name="make" defaultValue={vehicle?.make} placeholder="Toyota" required />
          </Field>
          <Field label="Model">
            <input name="model" defaultValue={vehicle?.model} placeholder="Corolla" required />
          </Field>
          <Field label="Year">
            <input
              name="year"
              type="number"
              defaultValue={vehicle?.year || new Date().getUTCFullYear()}
              min="1950"
              max={new Date().getUTCFullYear() + 2}
              required
            />
          </Field>
          <Field label="Category">
            <input
              name="category"
              list="categories"
              defaultValue={vehicle?.category || "Economy"}
              required
            />
            <datalist id="categories">
              {["Economy", "Compact", "Sedan", "SUV", "Luxury", "Van", "Electric"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </datalist>
          </Field>
          <Field label="Color">
            <input name="color" defaultValue={vehicle?.color} />
          </Field>
          <Field label="Odometer (km)">
            <input
              name="odometer"
              type="number"
              defaultValue={vehicle?.odometer || 0}
              min={vehicle?.odometer || 0}
              required
            />
          </Field>
          <Field label="Fuel / charge (%)">
            <input
              name="fuelPercent"
              type="number"
              min="0"
              max="100"
              defaultValue={vehicle?.fuelPercent ?? 100}
              required
            />
          </Field>
        </div>
      </div>
      <div className="form-section">
        <h2>Standard rates · {currency}</h2>
        <div className="form-grid">
          {[
            ["dailyRate", "Daily rate"],
            ["weeklyRate", "Weekly rate"],
            ["monthlyRate", "Monthly rate"],
            ["depositRequired", "Required deposit"],
          ].map(([name, label]) => (
            <Field key={name} label={label}>
              <input
                name={name}
                inputMode="decimal"
                defaultValue={
                  vehicle
                    ? moneyInput(vehicle[name as "dailyRate"], currency)
                    : name === "depositRequired"
                      ? "0"
                      : ""
                }
                required
              />
            </Field>
          ))}
        </div>
      </div>
      <div className="form-section">
        <h2>Documents and servicing</h2>
        <div className="form-grid">
          <Field label="Registration expiry">
            <input
              type="date"
              name="registrationExpiry"
              defaultValue={d(vehicle?.registrationExpiry)}
            />
          </Field>
          <Field label="Insurance expiry">
            <input type="date" name="insuranceExpiry" defaultValue={d(vehicle?.insuranceExpiry)} />
          </Field>
          <Field label="Next service date">
            <input type="date" name="serviceDueDate" defaultValue={d(vehicle?.serviceDueDate)} />
          </Field>
          <Field label="Next service odometer (km)">
            <input
              type="number"
              name="serviceDueKm"
              defaultValue={vehicle?.serviceDueKm || ""}
              min="0"
            />
          </Field>
          <Field label="Notes" className="full">
            <textarea name="notes" defaultValue={vehicle?.notes} />
          </Field>
        </div>
      </div>
    </ActionForm>
  );
}
export function CustomerForm({ customer }: { customer?: Customer }) {
  return (
    <ActionForm action={customerAction} submit={customer ? "Save customer" : "Add customer"}>
      {customer && <input type="hidden" name="id" value={customer.id} />}
      <div className="form-grid">
        <Field label="Full name">
          <input name="name" defaultValue={customer?.name} required />
        </Field>
        <Field label="Company (optional)">
          <input name="company" defaultValue={customer?.company} />
        </Field>
        <Field label="Email">
          <input name="email" type="email" defaultValue={customer?.email} />
        </Field>
        <Field label="Phone">
          <input name="phone" defaultValue={customer?.phone} required />
        </Field>
        <Field label="Driving licence number">
          <input name="licenseNumber" defaultValue={customer?.licenseNumber} required />
        </Field>
        <Field label="Driving licence expiry">
          <input
            name="licenseExpiry"
            type="date"
            defaultValue={d(customer?.licenseExpiry)}
            required
          />
        </Field>
        <Field label="Address" className="full">
          <input name="address" defaultValue={customer?.address} />
        </Field>
        <Field label="Notes" className="full">
          <textarea name="notes" defaultValue={customer?.notes} />
        </Field>
      </div>
    </ActionForm>
  );
}
export function RentalForm({
  business,
  vehicles,
  customers,
  rental,
  selectedVehicle,
}: {
  business: Business;
  vehicles: Vehicle[];
  customers: Customer[];
  rental?: Rental;
  selectedVehicle?: string;
}) {
  const start = new Date();
  const end = new Date(start.getTime() + 3 * 86400000);
  const selected = vehicles.find((v) => v.id === selectedVehicle);
  return (
    <ActionForm action={rentalAction} submit={rental ? "Update quote" : "Create quote"}>
      {rental && <input type="hidden" name="id" value={rental.id} />}
      <div className="form-section">
        <h2>Customer and dates</h2>
        <div className="form-grid">
          <Field label="Customer" className="full">
            <select name="customerId" defaultValue={rental?.customerId} required>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.company ? ` · ${c.company}` : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label={`Pickup · ${business.timezone}`}>
            <input
              name="startAt"
              type="datetime-local"
              defaultValue={localInput(rental?.startAt || start, business.timezone)}
              required
            />
          </Field>
          <Field label={`Return · ${business.timezone}`}>
            <input
              name="endAt"
              type="datetime-local"
              defaultValue={localInput(rental?.endAt || end, business.timezone)}
              required
            />
          </Field>
        </div>
      </div>
      <div className="form-section">
        <h2>Vehicle and agreed pricing</h2>
        <div className="form-grid">
          <RentalPricing
            vehicles={vehicles.map((v) => ({ ...v, label: `${v.make} ${v.model} · ${v.plate}` }))}
            currency={business.currency}
            initial={
              rental ||
              (selected
                ? {
                    vehicleId: selected.id,
                    rateUnit: "DAY",
                    unitRate: selected.dailyRate,
                    depositRequired: selected.depositRequired,
                  }
                : undefined)
            }
          />
          <Field label={`Extras, net (${business.currency})`}>
            <input
              name="extras"
              inputMode="decimal"
              defaultValue={moneyInput(rental?.extras || 0, business.currency)}
              required
            />
          </Field>
          <Field label={`Discount, net (${business.currency})`}>
            <input
              name="discount"
              inputMode="decimal"
              defaultValue={moneyInput(rental?.discount || 0, business.currency)}
              required
            />
          </Field>
          <Field
            label="Included kilometres (whole rental)"
            hint="Enter the complete allowance; zero means every kilometre is chargeable if a rate is set."
          >
            <input
              name="includedKm"
              type="number"
              min="0"
              defaultValue={rental?.includedKm ?? 1000}
              required
            />
          </Field>
          <Field label={`Extra kilometre rate, net (${business.currency})`}>
            <input
              name="extraKmRate"
              inputMode="decimal"
              defaultValue={moneyInput(rental?.extraKmRate || 0, business.currency)}
              required
            />
          </Field>
          <Field label="Notes" className="full">
            <textarea name="notes" defaultValue={rental?.notes} />
          </Field>
        </div>
      </div>
      <p className="section-note">
        Tax: {business.taxBps / 100}%. Quotes do not block availability. Review the calculated
        price, then confirm the reservation. Daily and weekly periods round up; partial calendar
        months are prorated. Early returns retain agreed charges; issue a credit note for any
        approved reduction.
      </p>
    </ActionForm>
  );
}
export function Files({
  attachments,
  entityType,
  entityId,
}: {
  attachments: Attachment[];
  entityType: string;
  entityId: string;
}) {
  return (
    <>
      <ul className="file-list">
        {attachments.map((a) => (
          <li key={a.id}>
            <a href={`/api/files/${a.id}`} target="_blank" rel="noreferrer">
              {a.filename}
            </a>
            <span className="muted">{Math.ceil(a.size / 1024)} KB</span>
          </li>
        ))}
      </ul>
      <div className="upload-box">
        <ActionForm action={attachmentAction} submit="Upload document">
          <input type="hidden" name="entityType" value={entityType} />
          <input type="hidden" name="entityId" value={entityId} />
          <Field label="Photos or signed documents" hint="JPG, PNG, WebP, or PDF · maximum 10 MB">
            <input
              name="file"
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              required
            />
          </Field>
        </ActionForm>
      </div>
    </>
  );
}
