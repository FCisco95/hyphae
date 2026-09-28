"use client";

// A page that failed to render says so, and offers another try; it never shows partial numbers.
export default function ErrorPage({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <section className="notice state">
      <p>This page couldn't be shown. Nothing is shown rather than a guess.</p>
      <button type="button" onClick={() => retry()}>
        Try again
      </button>
    </section>
  );
}
