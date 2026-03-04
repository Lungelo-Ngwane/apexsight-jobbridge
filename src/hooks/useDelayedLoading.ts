import { useEffect, useState } from "react";

export function useDelayedLoading(isLoading: boolean, delayMs = 200): boolean {
  const [showDelayedLoading, setShowDelayedLoading] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setShowDelayedLoading(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setShowDelayedLoading(true);
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [isLoading, delayMs]);

  return showDelayedLoading;
}
