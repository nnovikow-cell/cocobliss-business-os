import { type ReactNode, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { InstanceDetail } from "./instance-detail";

/**
 * Wraps a trigger element. On mobile → navigates to the full-page route.
 * On desktop → opens a right-side Sheet with the detail.
 */
export function InstanceDetailTrigger({
  instanceId, onChanged, children,
}: {
  instanceId: string;
  onChanged?: () => void;
  children: (open: () => void) => ReactNode;
}) {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleOpen = () => {
    if (isMobile) {
      navigate({ to: "/events/instance/$instanceId", params: { instanceId } });
    } else {
      setOpen(true);
    }
  };

  return (
    <>
      {children(handleOpen)}
      {!isMobile && (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="right"
            className="w-full overflow-y-auto sm:max-w-lg"
          >
            <div className="pt-2">
              <InstanceDetail
                instanceId={instanceId}
                onChanged={onChanged}
                onClose={() => setOpen(false)}
              />
            </div>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}