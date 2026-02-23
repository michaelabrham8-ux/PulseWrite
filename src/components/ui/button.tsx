import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--pw-primary) focus-visible:ring-offset-2 focus-visible:ring-offset-(--pw-bg-dark) disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer",
    {
        variants: {
            variant: {
                default:
                    "bg-(--pw-primary) text-white shadow-md hover:bg-(--pw-primary-hover) hover:shadow-lg hover:shadow-(--pw-glow)",
                secondary:
                    "bg-(--pw-bg-input) text-(--pw-text) border border-(--pw-border) hover:bg-(--pw-border) hover:border-(--pw-text-muted)",
                ghost:
                    "text-(--pw-text-muted) hover:text-(--pw-text) hover:bg-(--pw-bg-input)",
                outline:
                    "border border-(--pw-border) bg-transparent text-(--pw-text) hover:bg-(--pw-bg-input) hover:border-(--pw-primary)",
            },
            size: {
                default: "h-10 px-4 py-2",
                sm: "h-8 rounded-md px-3 text-xs",
                lg: "h-11 rounded-lg px-6 text-base",
                icon: "h-9 w-9",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
);

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : "button";
        return (
            <Comp
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                {...props}
            />
        );
    }
);
Button.displayName = "Button";

export { Button, buttonVariants };
