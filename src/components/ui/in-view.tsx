"use client";

import {
  motion,
  type Transition,
  type UseInViewOptions,
  useInView,
  type Variant,
} from "motion/react";
import { type ReactNode, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useMotionPreferences } from "./motion-preferences";

export type InViewProps = {
  children: ReactNode;
  variants?: {
    hidden: Variant;
    visible: Variant;
  };
  transition?: Transition;
  viewOptions?: UseInViewOptions;
  as?: React.ElementType;
  once?: boolean;
  className?: string;
  respectReducedMotion?: boolean;
};

const defaultVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

export function InView({
  children,
  variants = defaultVariants,
  transition,
  viewOptions,
  as = "div",
  once,
  className,
  respectReducedMotion = true,
}: InViewProps) {
  const { resolved } = useMotionPreferences();
  const isReducedMotion = respectReducedMotion && resolved === "reduced";
  const ref = useRef<Element>(null);
  const isInView = useInView(ref, viewOptions);

  const [isViewed, setIsViewed] = useState(false);

  const MotionComponent = motion[as as keyof typeof motion] as typeof as;
  const StaticComponent = as;

  if (isReducedMotion) {
    return (
      <StaticComponent
        data-inview-mode="static"
        className={cn("h-full", className)}
      >
        {children}
      </StaticComponent>
    );
  }

  return (
    <MotionComponent
      ref={ref}
      data-inview-mode="motion"
      initial="hidden"
      onAnimationComplete={() => {
        if (once) setIsViewed(true);
      }}
      animate={isInView || isViewed ? "visible" : "hidden"}
      variants={variants}
      transition={transition}
      className={cn("h-full", className)}
    >
      {children}
    </MotionComponent>
  );
}
