"use client";

export interface QuantityPickerProps {
  value: number;
  onChange: (value: number) => void;
}

export function QuantityPicker({ value, onChange }: QuantityPickerProps) {
  const setQuantity = (next: number) => onChange(Math.max(1, Math.floor(next)));

  return (
    <div
      className="inline-flex min-h-11 items-center rounded-md border border-border"
      aria-label="Quantity"
    >
      <button
        type="button"
        aria-label="Decrease quantity"
        disabled={value <= 1}
        onClick={() => setQuantity(value - 1)}
        className="inline-flex min-h-11 min-w-11 items-center justify-center px-3 text-lg disabled:cursor-not-allowed disabled:text-gray-500"
      >
        −
      </button>
      <input
        aria-label="Quantity"
        type="number"
        min={1}
        step={1}
        value={value}
        onChange={(event) => setQuantity(Number(event.target.value) || 1)}
        className="box-border h-11 w-14 appearance-none border-x border-border px-0 text-center text-sm leading-5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <button
        type="button"
        aria-label="Increase quantity"
        onClick={() => setQuantity(value + 1)}
        className="inline-flex min-h-11 min-w-11 items-center justify-center px-3 text-lg"
      >
        +
      </button>
    </div>
  );
}

export default QuantityPicker;
