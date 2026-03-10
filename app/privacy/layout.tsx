import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Coasty Privacy Policy. Learn how we protect your data with VM-level isolation, encrypted sessions, sandboxed execution environments, and enterprise-grade security for every AI agent session.",
  alternates: { canonical: "https://coasty.ai/privacy" },
}

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children
}
