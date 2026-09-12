import type { ElementType, ReactNode } from "react";

/**
 * Shared application shell width + horizontal padding.
 * Use for the global header and all primary page content so left edges align.
 */
export const appContainerClassName =
  "mx-auto w-full max-w-7xl px-4 sm:px-6";

type AppContainerProps = {
  children: ReactNode;
  className?: string;
  as?: ElementType;
};

export function AppContainer({
  children,
  className,
  as: Tag = "div",
}: AppContainerProps) {
  return (
    <Tag
      className={
        className
          ? `${appContainerClassName} ${className}`
          : appContainerClassName
      }
    >
      {children}
    </Tag>
  );
}
