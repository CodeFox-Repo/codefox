import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <p className="font-mono text-sm tracking-[0.12em] text-muted-foreground">
        404
      </p>
      <p className="font-medium text-foreground">This page does not exist</p>
      <Link
        href="/"
        className="rounded-lg border border-border px-4 py-2 font-mono text-xs text-foreground transition-colors hover:border-primary"
      >
        Back to CodeFox
      </Link>
    </div>
  );
}
