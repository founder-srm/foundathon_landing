import type { SpringOptions, Transition, Variants } from "motion/react";

export const MOTION_DURATIONS = {
  base: 0.22,
  fast: 0.14,
  slow: 0.36,
  xl: 0.52,
} as const;

export const MOTION_EASINGS = {
  emphasized: [0.22, 1, 0.36, 1],
  standard: [0.2, 0, 0, 1],
} as const;

export const MOTION_SPRINGS = {
  cursor: {
    damping: 38,
    mass: 0.45,
    stiffness: 520,
  } satisfies SpringOptions,
  hover: {
    damping: 28,
    mass: 0.5,
    stiffness: 380,
  } satisfies SpringOptions,
} as const;

export const MOTION_TRANSITIONS = {
  base: {
    duration: MOTION_DURATIONS.base,
    ease: MOTION_EASINGS.standard,
  } satisfies Transition,
  fast: {
    duration: MOTION_DURATIONS.fast,
    ease: MOTION_EASINGS.standard,
  } satisfies Transition,
  slow: {
    duration: MOTION_DURATIONS.slow,
    ease: MOTION_EASINGS.standard,
  } satisfies Transition,
  xl: {
    duration: MOTION_DURATIONS.xl,
    ease: MOTION_EASINGS.emphasized,
  } satisfies Transition,
} as const;

export const MOTION_VARIANTS = {
  fadeBlurIn: {
    hidden: { filter: "blur(6px)", opacity: 0, scale: 0.988, y: 26 },
    visible: { filter: "blur(0px)", opacity: 1, scale: 1, y: 0 },
  } satisfies Variants,
  fadeLiftIn: {
    hidden: { filter: "blur(7px)", opacity: 0, scale: 0.982, y: 32 },
    visible: { filter: "blur(0px)", opacity: 1, scale: 1, y: 0 },
  } satisfies Variants,
  fadeUpSoft: {
    hidden: { filter: "blur(4px)", opacity: 0, scale: 0.992, y: 20 },
    visible: { filter: "blur(0px)", opacity: 1, scale: 1, y: 0 },
  } satisfies Variants,
  modalInOut: {
    exit: { filter: "blur(3px)", opacity: 0, scale: 0.982, y: -10 },
    hidden: { filter: "blur(4px)", opacity: 0, scale: 0.986, y: 18 },
    visible: { filter: "blur(0px)", opacity: 1, scale: 1, y: 0 },
  } satisfies Variants,
  staggerItem: {
    hidden: { filter: "blur(3px)", opacity: 0, scale: 0.994, y: 14 },
    visible: { filter: "blur(0px)", opacity: 1, scale: 1, y: 0 },
  } satisfies Variants,
} as const;

export const staggerContainer = ({
  delayChildren = 0.02,
  staggerChildren = 0.06,
}: {
  delayChildren?: number;
  staggerChildren?: number;
} = {}) =>
  ({
    hidden: {},
    visible: {
      transition: {
        delayChildren,
        staggerChildren,
      },
    },
  }) satisfies Variants;
