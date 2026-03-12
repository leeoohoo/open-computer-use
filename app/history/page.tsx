import { LayoutApp } from "@/app/components/layout/layout-app";
import { HistoryContent } from "@/app/components/history/history-content";

export const dynamic = "force-dynamic";

export default function HistoryPage() {
  return (
    <LayoutApp>
      <HistoryContent />
    </LayoutApp>
  );
}
