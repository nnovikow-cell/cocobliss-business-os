import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { PlaceholderModule } from "@/components/app/placeholder-module";

export const Route = createFileRoute("/meetings")({
  component: () => (
    <PlaceholderModule
      title="Meetings & Decisions"
      description="Capture meeting notes, decisions, and action items."
      icon={Users}
    />
  ),
});