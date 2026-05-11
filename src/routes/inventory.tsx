import { createFileRoute } from "@tanstack/react-router";
import { Boxes } from "lucide-react";
import { PlaceholderModule } from "@/components/app/placeholder-module";

export const Route = createFileRoute("/inventory")({
  component: () => (
    <PlaceholderModule
      title="Inventory"
      description="Track stock for shakes, paletas, and supplies. Coming in a future release."
      icon={Boxes}
    />
  ),
});