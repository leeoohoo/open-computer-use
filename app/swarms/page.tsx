import { LayoutApp } from "@/app/components/layout/layout-app";
import { SwarmsContent } from "@/app/components/swarms/swarms-content";

export const dynamic = "force-dynamic";

export default function SwarmsPage() {
  return (
    <LayoutApp>
      <SwarmsContent />
    </LayoutApp>
  );
}
