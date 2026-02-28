import { LayoutApp } from "@/app/components/layout/layout-app";
import { SchedulesContent } from "@/app/components/schedules/schedules-content";

export const dynamic = "force-dynamic";

export default function SchedulesPage() {
  return (
    <LayoutApp>
      <SchedulesContent />
    </LayoutApp>
  );
}
