import { cn } from "./utils";

interface CircularLoaderProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  label?: string;
}

const sizeClasses: Record<NonNullable<CircularLoaderProps["size"]>, string> = {
  sm: "h-5 w-5 border-2",
  md: "h-8 w-8 border-[3px]",
  lg: "h-12 w-12 border-4",
};

export function CircularLoader({
  className,
  size = "md",
  label = "Loading...",
}: CircularLoaderProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3", className)}>
      <div
        role="status"
        aria-label={label}
        className={cn(
          "rounded-full border-primary/20 border-t-primary animate-spin shadow-[0_0_24px_-14px_rgba(37,99,235,0.9)]",
          sizeClasses[size],
        )}
      />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
