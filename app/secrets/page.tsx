import { LayoutApp } from "@/app/components/layout/layout-app"
import { SecretsContent } from "@/app/components/secrets/secrets-content"

export const dynamic = "force-dynamic"

export default function SecretsPage() {
  return (
    <LayoutApp>
      <SecretsContent />
    </LayoutApp>
  )
}
