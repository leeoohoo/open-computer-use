import { cn } from "@/lib/utils";
import { Slot } from "@radix-ui/react-slot";
import { cva, VariantProps } from "class-variance-authority";
import React from "react";

interface RainbowButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

const rainbowButtonVariants = cva(
  cn(
    "relative cursor-pointer group transition-all animate-rainbow",
    "inline-flex items-center justify-center gap-2 shrink-0",
    "rounded-3xl outline-none focus-visible:ring-[3px] aria-invalid:border-destructive",
    "text-sm font-medium whitespace-nowrap",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
  ),
  {
    variants: {
      variant: {
        default:
          "border-0 bg-[linear-gradient(#121213,#121213),linear-gradient(rgba(18,18,19,0),rgba(18,18,19,0.6)_20%,#121213_50%,rgba(18,18,19,0.6)_80%,rgba(18,18,19,0)),linear-gradient(90deg,var(--color-1),var(--color-5),var(--color-3),var(--color-4),var(--color-2))] bg-[length:200%] text-primary-foreground [background-clip:padding-box,border-box,border-box] [background-origin:border-box] [border:calc(0.125rem)_solid_transparent] dark:bg-[linear-gradient(#fff,#fff),linear-gradient(rgba(0,0,0,0),rgba(255,255,255,0.6)_20%,#fff_50%,rgba(255,255,255,0.6)_80%,rgba(0,0,0,0)),linear-gradient(90deg,var(--color-1),var(--color-5),var(--color-3),var(--color-4),var(--color-2))]",
        outline:
          "border border-input border-b-transparent bg-[linear-gradient(135deg,rgba(255,255,255,0.98)_0%,rgba(255,255,255,0.92)_50%,rgba(255,255,255,0.85)_100%),linear-gradient(135deg,rgba(18,18,19,0.1)_0%,rgba(18,18,19,0.6)_70%,rgba(18,18,19,0.8)_100%),linear-gradient(45deg,var(--color-1)_0%,var(--color-5)_25%,var(--color-3)_50%,var(--color-4)_75%,var(--color-2)_100%),linear-gradient(225deg,var(--color-2)_0%,var(--color-4)_33%,var(--color-3)_66%,var(--color-1)_100%)] bg-[length:400%_400%,300%_300%,200%_200%,250%_250%] text-accent-foreground [background-clip:padding-box,border-box,border-box,border-box] [background-origin:border-box] hover:bg-[position:100%_100%,75%_75%,50%_50%,25%_25%] transition-all duration-700 ease-in-out dark:bg-[linear-gradient(135deg,rgba(10,10,10,0.98)_0%,rgba(10,10,10,0.92)_50%,rgba(10,10,10,0.85)_100%),linear-gradient(135deg,rgba(255,255,255,0.1)_0%,rgba(255,255,255,0.6)_70%,rgba(255,255,255,0.8)_100%),linear-gradient(45deg,var(--color-1)_0%,var(--color-5)_25%,var(--color-3)_50%,var(--color-4)_75%,var(--color-2)_100%),linear-gradient(225deg,var(--color-2)_0%,var(--color-4)_33%,var(--color-3)_66%,var(--color-1)_100%)]",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-11 px-4 sm:px-6 md:px-8",
        "lg-responsive": "h-10 sm:h-11 md:h-12 px-6 sm:px-8 md:px-10 lg:px-12",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

interface RainbowButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof rainbowButtonVariants> {
  asChild?: boolean;
}

const RainbowButton = React.forwardRef<HTMLButtonElement, RainbowButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        data-slot="button"
        className={cn(rainbowButtonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);

RainbowButton.displayName = "RainbowButton";

export { RainbowButton, rainbowButtonVariants, type RainbowButtonProps };
