import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Coasty Terms of Service. Read the terms governing use of the Coasty AI employee platform, computer-using agent, and desktop application.",
  alternates: { canonical: "https://coasty.ai/terms" },
}

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children
}
