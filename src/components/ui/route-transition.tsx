"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { MOTION_TRANSITIONS, MOTION_VARIANTS } from "@/lib/motion-system";
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
        initial={MOTION_VARIANTS.modalInOut.hidden}
        animate={MOTION_VARIANTS.modalInOut.visible}
        exit={MOTION_VARIANTS.modalInOut.exit}
        transition={MOTION_TRANSITIONS.base}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};
