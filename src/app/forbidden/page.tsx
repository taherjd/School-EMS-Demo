import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-2xl font-semibold">Access denied</h1>
      <p className="text-gray-600">Your role does not have permission to view this page.</p>
      <Link href="/" className="text-brand underline">Go to your home page</Link>
    </main>
  );
}
