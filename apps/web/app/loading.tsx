// Shown while an audit page reads the API (each read gives up after 3 seconds).
export default function Loading() {
  return (
    <p className="loading state" role="status">
      Reading the audit data…
    </p>
  );
}
