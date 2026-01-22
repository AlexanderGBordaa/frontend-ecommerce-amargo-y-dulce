"use client";

type Props = {
  value: number;
  onChange: (value: number) => void;
};

export default function StarRating({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className="text-2xl focus:outline-none"
        >
          <span
            className={
              star <= value
                ? "text-yellow-400"
                : "text-neutral-300"
            }
          >
            ★
          </span>
        </button>
      ))}
    </div>
  );
}
