import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CarFront,
  Check,
  LayoutDashboard,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import { Brand } from "@/components/shell";
import { Badge } from "@/components/ui";

const features = [
  {
    icon: CarFront,
    title: "Fleet management",
    description:
      "See vehicle availability, track documents, and schedule maintenance from one place.",
  },
  {
    icon: CalendarDays,
    title: "Complete rental workflows",
    description: "Manage reservations, contracts, inspections, and returns with a clear next step.",
  },
  {
    icon: Wallet,
    title: "Connected rental finances",
    description: "Keep invoices, payments, and refundable deposits organized against each rental.",
  },
];

function ProductPreview() {
  return (
    <div>
      <div className="product-preview" aria-label="Illustrative RentOps dashboard">
        <div className="preview-browser">
          <i />
          <i />
          <i />
          <span>RentOps / Dashboard</span>
        </div>
        <div className="preview-app">
          <div className="preview-nav" aria-hidden="true">
            <span>
              <CarFront size={18} />
            </span>
            <LayoutDashboard size={18} />
            <CarFront size={18} />
            <CalendarDays size={18} />
            <Users size={18} />
            <Wallet size={18} />
          </div>
          <div className="preview-body">
            <div className="preview-heading">
              <strong>Dashboard</strong>
              <span>Coastal Car Rental</span>
            </div>
            <div className="preview-metrics">
              <div>
                <small>Available vehicles</small>
                <strong>
                  3 <span className="muted preview-metric-context">/ 6</span>
                </strong>
              </div>
              <div>
                <small>Active rentals</small>
                <strong>2</strong>
              </div>
              <div>
                <small>Outstanding</small>
                <strong>$845</strong>
              </div>
            </div>
            <div className="preview-table">
              <div className="preview-table-head">
                <span>Fleet overview</span>
                <span>6 vehicles</span>
              </div>
              <div className="preview-table-row">
                <strong>Toyota Corolla</strong>
                <Badge value="AVAILABLE" />
              </div>
              <div className="preview-table-row">
                <strong>Kia Sportage</strong>
                <Badge value="ACTIVE" />
              </div>
              <div className="preview-table-row">
                <strong>Volkswagen Golf</strong>
                <Badge value="AVAILABLE" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <small className="sample-caption">Illustrative workspace with sample data</small>
    </div>
  );
}

export default function Home() {
  return (
    <div className="landing">
      <header>
        <Brand />
        <nav>
          <Link href="#features">Features</Link>
          <Link href="/sign-in">Sign in</Link>
          <Link className="btn btn-primary" href="/sign-up">
            Get started
            <ArrowUpRight size={16} />
          </Link>
        </nav>
      </header>
      <main>
        <div className="landing-copy">
          <div className="eyebrow">
            <ShieldCheck size={13} />
            CAR RENTAL MANAGEMENT, SIMPLIFIED
          </div>
          <h1>
            Your rental business.
            <br />
            <em>One organized workspace.</em>
          </h1>
          <p>
            Manage your fleet, reservations, customers, and finances with the clarity your business
            needs. Built for independent rental operators.
          </p>
          <div className="hero-actions">
            <Link className="btn btn-primary" href="/sign-up">
              Create your workspace
              <ArrowRight size={17} />
            </Link>
            <Link className="btn btn-secondary" href="/demo">
              Explore the demo
            </Link>
          </div>
          <div className="hero-checks">
            <span>
              <Check size={15} />
              One owner, one branch
            </span>
            <span>
              <Check size={15} />
              Your own private workspace
            </span>
          </div>
        </div>
        <ProductPreview />
      </main>
      <section className="landing-features" id="features" aria-label="Features">
        {features.map(({ icon: Icon, title, description }) => (
          <article key={title}>
            <span className="feature-icon">
              <Icon size={21} strokeWidth={1.7} />
            </span>
            <h3>{title}</h3>
            <p>{description}</p>
          </article>
        ))}
      </section>
      <footer>
        <Brand />
        <span>Built for everyday rental operations.</span>
      </footer>
    </div>
  );
}
