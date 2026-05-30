import * as React from "react";

import { cn } from "./utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "resize-y border-input bg-input-background placeholder:text-muted-foreground",
        "flex min-h-[120px] w-full rounded-lg border px-3.5 py-3 text-[15px] shadow-inner shadow-black/[0.03]",
        "transition-[color,box-shadow,border-color] outline-none field-sizing-content",
        "focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/20",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/15",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
