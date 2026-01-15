import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary";

export function Button(
  props: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }
) {
  const { variant = "primary", className = "", ...rest } = props;

  const base = "rounded-md px-4 py-2 text-sm font-medium transition";
  const styles =
    variant === "primary"
      ? "bg-red-600 text-white hover:bg-red-700"
      : "border bg-white text-neutral-900 hover:bg-neutral-50";

  return <button className={`${base} ${styles} ${className}`} {...rest} />;
}
