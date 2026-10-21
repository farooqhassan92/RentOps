"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="standalone">
      <div className="panel form-panel">
        <h1>We couldn’t load this page.</h1>
        <p>Check your database connection and configuration, then try again.</p>
        <button className="btn btn-primary" onClick={reset}>
          Try again
        </button>
      </div>
    </div>
  );
}
