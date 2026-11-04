import React from "react";
import { Button as ShadcnButton } from "./button";
import { cn } from "cn";

//setup chỉ accept 5 loại này
type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";

//setup chỉ accept 3 loại này
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = Omit<
  React.ComponentProps<typeof ShadcnButton>, //lây toàn bộ props mà shadcnButton đang hỗ trợ trừ variant và size
  "variant" | "size"
> & {
  // tự định nghĩa lại variant, size, loading,...
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

function ButtonCustom({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  children, // nội dung nằm giữa button
  ...props
}: ButtonProps) {
  return (
    <ShadcnButton
      variant="ghost"
      disabled={disabled || loading} // true/false
      className={cn(
        //Base
        "font-medium transition-colors",

        //variant
        variant === "primary" &&
          "bg-primary text-primary-foreground hover:bg-primary-hover",
        variant === "secondary" &&
          "bg-secondary text-secondary-foreground hover:bg-secondary-hover",
        variant === "outline" &&
          "border border-gray-300 bg-background-100 text-gray-1000 hover:bg-gray-100",
        variant === "ghost" &&
          "bg-transparent text-gray-1000 hover:bg-gray-100",
        variant === "danger" &&
          "bg-destructive text-destructive-foreground hover:bg-destructive-hover",

        //sizes

        size === "sm" && "h-8 rounded-sm px-3 text-button-12",
        size === "md" && "h-10 rounded-sm px-4 text-button-14",
        size === "lg" && "h-12 rounded-md px-6 text-button-12",
        className,
      )}
      {...props}
    >
      {loading && (
        <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </ShadcnButton>
  );
}

export default ButtonCustom;
