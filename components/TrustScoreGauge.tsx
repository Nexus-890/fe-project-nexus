const RADIUS = 40;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const ARC = CIRCUMFERENCE * 0.75;

const scoreColor = (score: number) => (score >= 70 ? "text-success" : score >= 40 ? "text-warning" : "text-destructive");

export function TrustScoreGauge({ score, size = "md" }: { score: number; size?: "sm" | "md" }) {
  const value = Math.min(100, Math.max(0, Math.round(score)));
  const small = size === "sm";
  const stroke = small ? 12 : 8;
  return (
    <div
      role="meter"
      aria-label="Trust score"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      className={`flex shrink-0 flex-col items-center ${scoreColor(value)}`}
    >
      <div className={`relative ${small ? "size-6" : "size-24"}`}>
        <svg viewBox="0 0 100 100" className="size-full" aria-hidden="true">
          <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="var(--muted)" strokeWidth={stroke}
            strokeLinecap="round" strokeDasharray={`${ARC} ${CIRCUMFERENCE}`} transform="rotate(135 50 50)" />
          <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="currentColor" strokeWidth={stroke}
            strokeLinecap="round" strokeDasharray={`${(ARC * value) / 100} ${CIRCUMFERENCE}`} transform="rotate(135 50 50)" />
        </svg>
        <span className={`absolute inset-0 flex items-center justify-center font-bold leading-none tabular-nums ${small ? "text-[9px]" : "text-3xl"}`}>
          {value}
          <span className="sr-only">/100</span>
        </span>
      </div>
      {!small && <span className="-mt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Trust score</span>}
    </div>
  );
}
