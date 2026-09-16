"use client";

export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "3rem", textAlign: "center" }}>
        <h1>Something went wrong</h1>
        <p>The application hit an unexpected error{error.digest ? ` (reference ${error.digest})` : ""}.</p>
        <button onClick={() => retry()} style={{ padding: "0.5rem 1rem" }}>Try again</button>
      </body>
    </html>
  );
}
