// The gentle reminder shown under answers and in the passage panel.
export function ContextNote({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs leading-relaxed text-muted ${className}`}>
      Berean is a study aid, not a pastor. Read each passage in its full context, and talk with
      your church community about what you find.
    </p>
  );
}
