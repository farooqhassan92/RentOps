"use client";
import { useActionState, useState, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import type { ActionResult } from "@/app/actions";
import { moneyInput } from "@/lib/domain";

type ActionFormProps = {
  action: (state: ActionResult, form: FormData) => Promise<ActionResult>;
  children?: ReactNode;
  submit?: string;
  className?: string;
  variant?: string;
  endpoint?: string;
  error?: string;
};

export function ActionForm(props: ActionFormProps) {
  if (props.endpoint) {
    return (
      <form
        action={props.endpoint}
        method="post"
        className={`action-form ${props.className || ""}`}
      >
        {props.children}
        {props.error && (
          <div role="alert" className="error-box">
            {props.error}
          </div>
        )}
        <button type="submit" className={`btn btn-${props.variant || "primary"}`}>
          {props.submit || "Save changes"}
        </button>
      </form>
    );
  }
  return <StatefulActionForm {...props} />;
}

function StatefulActionForm({
  action,
  children,
  submit = "Save changes",
  className = "",
  variant = "primary",
}: ActionFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className={`action-form ${className}`}>
      {children}
      {state.error && (
        <div role="alert" className="error-box">
          {state.error}
        </div>
      )}
      <button type="submit" className={`btn btn-${variant}`} disabled={pending}>
        {pending && <LoaderCircle size={16} className="spin" />}
        {pending ? "Saving…" : submit}
      </button>
    </form>
  );
}
export function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`field ${className}`}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function RentalPricing({
  vehicles,
  currency,
  initial,
}: {
  vehicles: {
    id: string;
    label: string;
    dailyRate: number;
    weeklyRate: number;
    monthlyRate: number;
    depositRequired: number;
  }[];
  currency: string;
  initial?: { vehicleId: string; rateUnit: string; unitRate: number; depositRequired: number };
}) {
  const [vehicleId, setVehicle] = useState(initial?.vehicleId || vehicles[0]?.id || "");
  const [unit, setUnit] = useState(initial?.rateUnit || "DAY");
  const [rate, setRate] = useState(
    moneyInput(initial?.unitRate ?? vehicles[0]?.dailyRate ?? 0, currency),
  );
  const [deposit, setDeposit] = useState(
    moneyInput(initial?.depositRequired ?? vehicles[0]?.depositRequired ?? 0, currency),
  );
  function change(id: string, u: string) {
    setVehicle(id);
    setUnit(u);
    const v = vehicles.find((v) => v.id === id);
    if (v) {
      setRate(
        moneyInput(
          u === "DAY" ? v.dailyRate : u === "WEEK" ? v.weeklyRate : v.monthlyRate,
          currency,
        ),
      );
      setDeposit(moneyInput(v.depositRequired, currency));
    }
  }
  return (
    <>
      <Field label="Vehicle">
        <select
          name="vehicleId"
          value={vehicleId}
          onChange={(e) => change(e.target.value, unit)}
          required
        >
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Rate plan">
        <select name="rateUnit" value={unit} onChange={(e) => change(vehicleId, e.target.value)}>
          <option value="DAY">Daily · per 24 hours</option>
          <option value="WEEK">Weekly · per 7 days</option>
          <option value="MONTH">Monthly · calendar month</option>
        </select>
      </Field>
      <Field
        label={`Rate per period (${currency})`}
        hint="Defaults to the vehicle rate. You can agree a different rate."
      >
        <input
          name="unitRate"
          inputMode="decimal"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          required
        />
      </Field>
      <Field label={`Required deposit (${currency})`}>
        <input
          name="depositRequired"
          inputMode="decimal"
          value={deposit}
          onChange={(e) => setDeposit(e.target.value)}
          required
        />
      </Field>
    </>
  );
}
