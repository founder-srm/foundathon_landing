"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useMotionPreferences } from "./motion-preferences";

export const RouteTransition = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname();
  const { resolved } = useMotionPreferences();
  const isReducedMotion = resolved === "reduced";

  if (isReducedMotion) {
    return <div data-route-transition="off">{children}</div>;
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        data-route-transition="on"
        initial={{ opacity: 0, y: 8, filter: "blur(2px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        exit={{ opacity: 0, y: -6, filter: "blur(2px)" }}
        transition={{
          duration: 0.22,
          ease: [0.2, 0, 0, 1],
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};
