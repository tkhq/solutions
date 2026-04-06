"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/cn"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 backdrop-blur-sm border",
  {
    variants: {
      variant: {
        default:
          "bg-primary/90 text-primary-foreground border-primary/50 hover:bg-primary shadow-sm",
        destructive:
          "bg-destructive/90 text-destructive-foreground border-destructive/50 hover:bg-destructive shadow-sm",
        outline:
          "border-input bg-background/50 backdrop-blur-md hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary/80 text-secondary-foreground border-secondary/50 backdrop-blur-md hover:bg-secondary",
        ghost:
          "border-transparent hover:bg-accent/50 hover:text-accent-foreground backdrop-blur-sm",
        link: "text-primary underline-offset-4 hover:underline border-transparent",
      },
      size: {
        default: "h-10 px-4 py-2 rounded-md",
        sm: "h-9 px-3 rounded-md",
        lg: "h-11 px-8 rounded-md",
        icon: "h-10 w-10 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
