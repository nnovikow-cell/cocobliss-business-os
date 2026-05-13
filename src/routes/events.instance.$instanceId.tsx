import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { InstanceDetail } from "@/components/events/instance-detail";

export const Route = createFileRoute("/events/instance/$instanceId")({
  component: InstancePage,
});

function InstancePage() {
  const { instanceId } = Route.useParams();
  return (
    <AppShell>
      <header className="mb-4 flex items-center gap-2">
        <Link to="/events/schedule" className="rounded-full p-2 hover:bg-muted" aria-label="Back to schedule">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-black tracking-tight">Event details</h1>
      </header>
      <InstanceDetail instanceId={instanceId} />
    </AppShell>
  );
}