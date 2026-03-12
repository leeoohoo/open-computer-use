import { LayoutApp } from "@/app/components/layout/layout-app"
import { ReferralContent } from "@/app/components/referral/referral-content"

export const dynamic = "force-dynamic"

export default function ReferralPage() {
  return (
    <LayoutApp>
      <ReferralContent />
    </LayoutApp>
  )
}
