import Link from "next/link";
import { Shell } from "@/components/shell";
import { Dashboard, FleetCollection, RentalTable, Stat } from "@/components/dashboard";
import { Badge, PageHeader, Panel } from "@/components/ui";
import { CarFront, Wallet, Wrench, CalendarDays } from "lucide-react";
export const dynamic = "force-dynamic";
export default async function Demo({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string; layout?: string }>;
}) {
  const { view = "dashboard", q = "", layout } = await searchParams;
  const business = {
    name: "Coastal Car Rental",
    branchName: "Main office",
    currency: "USD",
    timezone: "UTC",
  };
  const fleet = [
    {
      id: "sample-1",
      make: "Toyota",
      model: "Corolla",
      year: 2025,
      plate: "CR 2401",
      category: "Sedan",
      odometer: 18450,
      fuelPercent: 85,
      dailyRate: 4500,
      displayState: "AVAILABLE",
    },
    {
      id: "sample-2",
      make: "Kia",
      model: "Sportage",
      year: 2025,
      plate: "CR 3108",
      category: "SUV",
      odometer: 12680,
      fuelPercent: 70,
      dailyRate: 7200,
      displayState: "ACTIVE",
    },
    {
      id: "sample-3",
      make: "Volkswagen",
      model: "Golf",
      year: 2024,
      plate: "CR 1923",
      category: "Compact",
      odometer: 24120,
      fuelPercent: 100,
      dailyRate: 5200,
      displayState: "AVAILABLE",
    },
    {
      id: "sample-4",
      make: "Hyundai",
      model: "Tucson",
      year: 2025,
      plate: "CR 4450",
      category: "SUV",
      odometer: 8900,
      fuelPercent: 90,
      dailyRate: 6800,
      displayState: "ACTIVE",
    },
    {
      id: "sample-5",
      make: "Ford",
      model: "Focus",
      year: 2024,
      plate: "CR 4820",
      category: "Compact",
      odometer: 32100,
      fuelPercent: 50,
      dailyRate: 4200,
      displayState: "MAINTENANCE",
    },
    {
      id: "sample-6",
      make: "Skoda",
      model: "Octavia",
      year: 2025,
      plate: "CR 2150",
      category: "Sedan",
      odometer: 11400,
      fuelPercent: 100,
      dailyRate: 5500,
      displayState: "AVAILABLE",
    },
  ];
  const names = ["Olivia Bennett", "James Wilson", "Sofia Martinez"];
  const active = names.slice(0, 2).map((name, i) => ({
    id: `sample-r${i}`,
    state: "ACTIVE",
    startAt: new Date(Date.now() - (i + 2) * 86400000),
    endAt: new Date(Date.now() + (i + 1) * 86400000),
    customer: { name },
    vehicle: { ...fleet[i === 0 ? 1 : 3] },
  }));
  const data = {
    fleet,
    active,
    upcoming: [
      {
        ...active[0],
        id: "sample-upcoming",
        state: "CONFIRMED",
        startAt: new Date(Date.now() + 2 * 86400000),
        customer: { name: names[2] },
      },
    ],
    available: 3,
    overdue: 0,
    receivable: 84500,
    held: 100000,
  };
  let content: React.ReactNode;
  switch (view) {
    case "vehicles":
      content = (
        <>
          <PageHeader
            eyebrow="VEHICLES"
            title="Fleet"
            description="A read-only look at a six-vehicle workspace."
            action={
              <Link className="btn btn-primary" href="/sign-up">
                Start your own fleet
              </Link>
            }
          />
          <FleetCollection
            vehicles={fleet.filter((vehicle) =>
              `${vehicle.make} ${vehicle.model} ${vehicle.plate}`
                .toLowerCase()
                .includes(q.toLowerCase()),
            )}
            currency="USD"
            demo
            layout={layout}
            filters={{ q }}
          />
        </>
      );
      break;
    case "rentals":
      content = (
        <>
          <PageHeader
            title="Rentals & reservations"
            description="Sample active rentals and an upcoming reservation."
          />
          <Panel title="Active rentals">
            <RentalTable rentals={[...active, ...data.upcoming]} timezone="UTC" demo />
          </Panel>
        </>
      );
      break;
    case "customers":
      content = (
        <>
          <PageHeader
            title="Customers"
            description="Sample customer records. Real documents are private to each workspace."
          />
          <Panel>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Type</th>
                    <th>Rentals</th>
                  </tr>
                </thead>
                <tbody>
                  {names.map((n, i) => (
                    <tr key={n}>
                      <td>
                        <span className="table-main">{n}</span>
                      </td>
                      <td>Individual</td>
                      <td>{[4, 2, 1][i]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      );
      break;
    case "finance":
      content = (
        <>
          <PageHeader
            title="Finance"
            description="Sample figures show how invoices and refundable deposits stay separate."
          />
          <div className="stat-grid">
            <Stat
              label="Net billed, including tax"
              value="$4,680.00"
              note="Sample invoices less credits"
              icon={Wallet}
            />
            <Stat
              label="Payments collected"
              value="$3,835.00"
              note="Excludes deposits"
              icon={Wallet}
            />
            <Stat
              label="Outstanding balance"
              value="$845.00"
              note="Unpaid invoice balances"
              icon={CalendarDays}
            />
            <Stat
              label="Deposits held"
              value="$1,000.00"
              note="Refundable customer funds"
              icon={Wallet}
            />
          </div>
          <Panel title="Sample invoices">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Customer</th>
                    <th>Total</th>
                    <th>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>INV-000018</td>
                    <td>Olivia Bennett</td>
                    <td>$504.00</td>
                    <td>$504.00</td>
                  </tr>
                  <tr>
                    <td>INV-000017</td>
                    <td>James Wilson</td>
                    <td>$476.00</td>
                    <td>$341.00</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      );
      break;
    case "maintenance":
      content = (
        <>
          <PageHeader
            title="Maintenance"
            description="Schedule servicing without overlapping a rental."
          />
          <Panel title="Sample work order">
            <div className="detail-body">
              <div className="summary-row">
                <strong>Ford Focus · CR 4820</strong>
                <Badge value="IN_PROGRESS" />
              </div>
              <p className="section-note">
                Oil and filter service · Coastal Auto Service
                <br />
                Estimated cost: $180.00
                <br />
                The vehicle is blocked from new bookings during its service allocation.
              </p>
            </div>
          </Panel>
        </>
      );
      break;
    case "reports":
      content = (
        <>
          <PageHeader
            title="Reports"
            description="Illustrative figures for a sample reporting period."
          />
          <div className="stat-grid">
            <Stat
              label="Fleet utilization"
              value="64%"
              note="Actual rental time / rentable time"
              icon={CarFront}
            />
            <Stat
              label="Net billed revenue"
              value="$4,200"
              note="Excludes tax and deposits"
              icon={Wallet}
            />
            <Stat
              label="Maintenance cost"
              value="$380"
              note="Recorded completed work"
              icon={Wrench}
            />
            <Stat
              label="Direct contribution"
              value="$3,820"
              note="Revenue less maintenance"
              icon={Wallet}
            />
          </div>
          <Panel title="Reporting overview">
            <p className="chart-note">
              Live reports show vehicle utilization, revenue, recorded maintenance costs, and direct
              contribution. These are operational figures, not statutory financial statements.
            </p>
          </Panel>
        </>
      );
      break;
    default:
      content = <Dashboard business={business} data={data} demo />;
  }
  return (
    <Shell business={business} demo demoView={view}>
      {content}
    </Shell>
  );
}
