export function LoadingOverlay({ label }: { label: string }) {
  return (
    <div className="overlay" role="status">
      <div className="spinner" />
      <p>{label}</p>
    </div>
  );
}
