"use client";

import { useEffect } from "react";

export default function RouteError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error("Route error", error.digest ?? error.message);
  }, [error]);
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="max-w-md text-sm text-gray-600">
        The page could not be loaded. Try again, and if the problem persists contact the system administrator
        {error.digest ? ` quoting reference ${error.digest}` : ""}.
      </p>
      <button onClick={() => retry()} className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white">Try again</button>
    </main>
  );
}
