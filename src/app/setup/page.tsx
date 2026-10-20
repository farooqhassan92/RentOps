import Link from "next/link";
import { Brand } from "@/components/shell";
export default function Setup() {
  return (
    <div className="standalone">
      <Brand />
      <div className="panel form-panel">
        <div className="eyebrow">CONNECT YOUR WORKSPACE</div>
        <h1>Connect your services</h1>
        <p>RentOps is ready to connect to your authentication and database services.</p>
        <ol className="setup-list">
          <li>
            Copy <code>.env.example</code> to <code>.env.local</code>.
          </li>
          <li>
            Set your PostgreSQL <code>DATABASE_URL</code> and run <code>npm run db:migrate</code>.
          </li>
          <li>Add your Clerk publishable and secret keys. Enable public sign-up in Clerk.</li>
          <li>Restart the app, create an account, and set up your business.</li>
        </ol>
        <p className="muted">
          No account or business data is created until these services are connected. See the project
          README for local database setup.
        </p>
        <Link href="/demo" className="btn btn-primary">
          Explore the read-only preview
        </Link>
      </div>
    </div>
  );
}
