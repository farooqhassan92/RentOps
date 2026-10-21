import Link from "next/link";
export default function NotFound() {
  return (
    <div className="standalone">
      <div className="panel form-panel">
        <div className="eyebrow">404 · NOT FOUND</div>
        <h1>This record isn’t here.</h1>
        <p>It may not exist, or it belongs to another workspace.</p>
        <Link className="btn btn-primary" href="/dashboard">
          Back to overview
        </Link>
      </div>
    </div>
  );
}
