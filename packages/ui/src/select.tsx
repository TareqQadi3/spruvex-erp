import { forwardRef, type SelectHTMLAttributes } from "react";

import { cn } from "./cn";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

/** Styled native select — keyboard/RTL friendly without a dropdown lib. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Select.displayName = "Select";
