"use client"

import { ChatContainer } from "@/app/components/chat/chat-container"
import { LayoutApp } from "@/app/components/layout/layout-app"
import { MessagesProvider } from "@/lib/chat-store/messages/provider"
import { LandingPage } from "@/app/components/landing/landing-page"
import { Toaster } from "@/components/ui/sonner"
import { PaymentHandler } from "@/app/components/payment-handler"
import { ReferralProcessor } from "@/app/components/referral/referral-processor"

export function HomeClient({ isAuthenticated }: { isAuthenticated: boolean }) {
  // Landing page doesn't need sidebar
  if (!isAuthenticated) {
    return (
      <>
        <Toaster position="top-center" />
        <LandingPage />
      </>
    )
  }

  // Authenticated app has its own SidebarProvider in LayoutApp
  return (
    <>
      <Toaster position="top-center" />
      <PaymentHandler />
      <ReferralProcessor />
      <MessagesProvider>
        <LayoutApp>
          <ChatContainer />
        </LayoutApp>
      </MessagesProvider>
    </>
  )
}