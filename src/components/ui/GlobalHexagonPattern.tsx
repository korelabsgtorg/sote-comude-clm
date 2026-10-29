"use client";

import { cn } from "@/lib/utils";
import { HexagonPattern } from "@/components/ui/hexagon-pattern";

export function GlobalHexagonPattern() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none"
    >
      <HexagonPattern
        hexagons={[
          [1, 1],
          [4, 4],
          [2, 2],
          [3, 4],
          [5, 4],
          [8, 2],
          [6, 3],
          [8, 5],
          [10, 10],
        ]}
        className={cn(
          "inset-0 skew-y-6",
          "stroke-neutral-300/50 fill-neutral-200/35 dark:stroke-white/[0.05] dark:fill-white/[0.04]",
          "mask-[radial-gradient(420px_circle_at_center,white,transparent)]",
          "[mask-image:radial-gradient(420px_circle_at_center,white,transparent)]",
          "[-webkit-mask-image:radial-gradient(420px_circle_at_center,white,transparent)]"
        )}
      />
    </div>
  );
}

export default GlobalHexagonPattern;
