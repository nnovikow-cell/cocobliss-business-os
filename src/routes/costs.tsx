import { createFileRoute } from "@tanstack/react-router";
import { Calculator } from "lucide-react";
import { PlaceholderModule } from "@/components/app/placeholder-module";

export const Route = createFileRoute("/costs")({
  component: () => (
    <PlaceholderModule
      title="Cost Calculator"
      description="Recipes, COGS, and margin analysis. Coming in a future release."
      icon={Calculator}
    />
  ),
});