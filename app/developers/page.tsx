import { LayoutApp } from "@/app/components/layout/layout-app"
import { DevelopersContent } from "@/app/components/developers/developers-content"

export const dynamic = "force-dynamic"

export default function DevelopersPage() {
  return (
    <LayoutApp>
      <DevelopersContent />
    </LayoutApp>
  )
}
