import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { Slot } from "radix-ui";
import type * as React from "react";
import { cn } from "@/lib/utils";

const fnButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md border border-transparent border-b-4 font-bold transition-[transform,box-shadow,background-color,border-color,color,opacity] duration-[var(--motion-duration-fast)] ease-[var(--motion-ease-standard)] hover:shadow-sm active:translate-y-[1px] active:border-b-1 active:py-[calc(var(--fn-btn-py)+1.5px)] active:shadow-none disabled:pointer-events-none disabled:opacity-60",
  {
    variants: {
      tone: {
        blue: "bg-fnblue/80 border-fnblue text-white",
        green: "bg-fngreen/80 border-fngreen text-white",
        red: "bg-fnred/80 border-fnred text-white",
        yellow: "bg-fnyellow/80 border-fnyellow text-foreground",
        gray: "bg-background border-foreground/30 text-foreground hover:bg-gray-100",
      },
      kind: {
        solid: "",
        nav: "border-0 bg-transparent px-2 py-1 font-semibold hover:bg-foreground/10 hover:translate-y-0 hover:shadow-none active:translate-y-0 active:border-b-0 active:py-1",
      },
      size: {
        xs: "[--fn-btn-py:0.25rem] px-2 py-[var(--fn-btn-py)] text-[10px] uppercase tracking-[0.1em]",
        sm: "[--fn-btn-py:0.5rem] px-3 py-[var(--fn-btn-py)] text-sm",
        md: "[--fn-btn-py:0.5rem] px-4 py-[var(--fn-btn-py)] text-sm",
        lg: "[--fn-btn-py:0.75rem] px-6 py-[var(--fn-btn-py)] text-xl",
      },
    },
    compoundVariants: [
      {
        kind: "nav",
        tone: "blue",
        className: "text-foreground",
      },
    ],
    defaultVariants: {
      tone: "blue",
      kind: "solid",
      size: "md",
    },
  },
);

type FnButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof fnButtonVariants> & {
    asChild?: boolean;
    loading?: boolean;
    loadingText?: string;
  };

function FnButton({
  children,
  className,
  tone,
  kind,
  size,
  asChild = false,
  loading = false,
  loadingText,
  disabled,
  ...props
}: FnButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  const isDisabled = !asChild && (disabled || loading);

  return (
    <Comp
      className={cn(fnButtonVariants({ tone, kind, size }), className)}
      aria-busy={loading || undefined}
      disabled={isDisabled}
      {...props}
    >
      {loading && !asChild ? (
        <>
          <Loader2 size={16} className="animate-spin" />
          {loadingText ?? "Loading..."}
        </>
      ) : (
        children
      )}
    </Comp>
  );
}

export { FnButton };
