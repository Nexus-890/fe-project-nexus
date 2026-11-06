import { Clock3 } from "lucide-react";

function CountdownTimer({ seconds }: { seconds: number }) {
  const value = Math.max(0, Math.ceil(seconds));
  const time = `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;

  return (
    <div className={`flex flex-wrap items-center justify-center gap-2 rounded-sm px-4 py-3 text-sm ${value ? "bg-primary/5 text-foreground" : "bg-muted text-muted-foreground"}`}>
      <Clock3 size={16} aria-hidden="true" />
      <span>{value ? "Complete payment in" : "Payment time ended"}</span>
      <span role="timer" aria-label="Time remaining" data-testid="payment-countdown" className="font-mono text-label-18 tabular-nums">{time}</span>
    </div>
  );
}

export default CountdownTimer;
