import Link from "next/link";

export default function NotFound() {
  return (
    <div className="space-y-4 pt-6">
      <h1 className="font-serif text-2xl font-semibold">Page not found.</h1>
      <p className="text-muted">That page, chapter, or conversation doesn&apos;t exist.</p>
      <div className="flex gap-4 text-sm">
        <Link href="/" className="text-accent hover:underline">
          Ask a question
        </Link>
        <Link href="/read" className="text-accent hover:underline">
          Browse the Bible
        </Link>
      </div>
    </div>
  );
}
