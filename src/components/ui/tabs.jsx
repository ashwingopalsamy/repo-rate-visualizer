import * as React from "react"
import { cva } from "class-variance-authority";
import { Tabs as TabsPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      orientation={orientation}
      className={cn("group/tabs flex gap-2 data-[orientation=horizontal]:flex-col", className)}
      {...props} />
  );
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex h-9 w-fit items-center justify-center rounded-lg bg-muted/80 border border-border/80 p-1 text-muted-foreground shadow-[inset_0_1px_1.5px_rgba(0,0,0,0.05)] dark:bg-muted/60 dark:border-border/70 dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)] group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col data-[variant=line]:rounded-none data-[variant=line]:border-0 data-[variant=line]:p-0 data-[variant=line]:shadow-none",
  {
    variants: {
      variant: {
        default: "",
        line: "gap-1 bg-transparent shadow-none border-0",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props} />
  );
}

function TabsTrigger({
  className,
  ...props
}) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-7 items-center justify-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium whitespace-nowrap text-muted-foreground transition-all duration-150 ease-out focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 hover:text-foreground hover:bg-background/40",
        "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:font-semibold data-[state=active]:border data-[state=active]:border-border/80 data-[state=active]:shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)] dark:data-[state=active]:bg-card dark:data-[state=active]:border-border/80 dark:data-[state=active]:shadow-[0_1px_3px_rgba(0,0,0,0.4),0_1px_2px_rgba(0,0,0,0.2)]",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
        className
      )}
      {...props} />
  );
}

function TabsContent({
  className,
  ...props
}) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props} />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
