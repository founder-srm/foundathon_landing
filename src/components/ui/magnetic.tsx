"use client";

import {
  motion,
  type SpringOptions,
  useMotionValue,
  useSpring,
} from "motion/react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useMotionPreferences } from "./motion-preferences";

const SPRING_CONFIG = { stiffness: 26.7, damping: 4.1, mass: 0.2 };

export type MagneticProps = {
  children: React.ReactNode;
  intensity?: number;
  range?: number;
  actionArea?: "self" | "parent" | "global";
  springOptions?: SpringOptions;
};

export function Magnetic({
  children,
  intensity = 0.6,
  range = 100,
  actionArea = "self",
  springOptions = SPRING_CONFIG,
}: MagneticProps) {
  const { resolved } = useMotionPreferences();
  const isReducedMotion = resolved === "reduced";
  const [isHovered, setIsHovered] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springX = useSpring(x, springOptions);
  const springY = useSpring(y, springOptions);

  // biome-ignore lint/correctness/useExhaustiveDependencies: all deps will break logic
  useEffect(() => {
    if (isReducedMotion) {
      x.set(0);
      y.set(0);
      return;
    }

    const calculateDistance = (e: MouseEvent) => {
      if (ref.current) {
        const rect = ref.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const distanceX = e.clientX - centerX;
        const distanceY = e.clientY - centerY;

        const absoluteDistance = Math.sqrt(distanceX ** 2 + distanceY ** 2);

        if (isHovered && absoluteDistance <= range) {
          const scale = 1 - absoluteDistance / range;
          x.set(distanceX * intensity * scale);
          y.set(distanceY * intensity * scale);
        } else {
          x.set(0);
          y.set(0);
        }
      }
    };

    document.addEventListener("mousemove", calculateDistance);

    return () => {
      document.removeEventListener("mousemove", calculateDistance);
    };
  }, [isReducedMotion, ref, isHovered, intensity, range]);

  useEffect(() => {
    if (isReducedMotion) {
      setIsHovered(false);
      return;
    }

    if (actionArea === "parent" && ref.current?.parentElement) {
      const parent = ref.current.parentElement;

      const handleParentEnter = () => setIsHovered(true);
      const handleParentLeave = () => setIsHovered(false);

      parent.addEventListener("mouseenter", handleParentEnter);
      parent.addEventListener("mouseleave", handleParentLeave);

      return () => {
        parent.removeEventListener("mouseenter", handleParentEnter);
        parent.removeEventListener("mouseleave", handleParentLeave);
      };
    } else if (actionArea === "global") {
      setIsHovered(true);
    }
  }, [actionArea, isReducedMotion]);

  const handleMouseEnter = () => {
    if (actionArea === "self" && !isReducedMotion) {
      setIsHovered(true);
    }
  };

  const handleMouseLeave = () => {
    if (actionArea === "self" && !isReducedMotion) {
      setIsHovered(false);
      x.set(0);
      y.set(0);
    }
  };

  if (isReducedMotion) {
    return (
      <div ref={ref} data-magnetic-mode="static">
        {children}
      </div>
    );
  }

  return (
    <motion.div
      ref={ref}
      data-magnetic-mode="motion"
      onMouseEnter={actionArea === "self" ? handleMouseEnter : undefined}
      onMouseLeave={actionArea === "self" ? handleMouseLeave : undefined}
      style={{
        x: springX,
        y: springY,
      }}
    >
      {children}
    </motion.div>
  );
}
