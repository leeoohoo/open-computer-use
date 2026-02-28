"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { useCredits } from "@/lib/hooks/use-credits"
import { useUser } from "@/lib/user-store/provider"
import { Lightning, ShoppingCart, ArrowUp, CheckCircle, XCircle, Spinner, CreditCard, Receipt, Coins } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import { Check, X, Zap, ArrowRight } from "lucide-react"
import { CoastyIcon } from "@/components/icons/coasty"

const subscriptionPlans = [
  {
    id: "starter",
    name: "Starter",
    tier: "starter",
    price: 19,
    monthlyCredits: 200,
    agentMinutes: 20,
    description: "Saves ~6-12 hrs of manual work",
    features: [
      "1 virtual machine, persistent",
      "2x more credits than Free",
      "Advanced web search & data extraction",
      "Standard support (real humans, not bots)",
    ],
    popular: false,
  },
  {
    id: "professional",
    name: "Plus",
    tier: "professional",
    price: 50,
    monthlyCredits: 600,
    agentMinutes: 60,
    description: "Saves ~18-24 hrs of manual work",
    features: [
      "1 virtual machine, persistent",
      "3x more credits than Starter",
      "Advanced web search & data extraction",
      "Full API access (coming soon)",
      "Advanced data extraction at scale",
      "Priority support, 24hr response",
    ],
    popular: true,
  },
  {
    id: "enterprise",
    name: "Pro",
    tier: "enterprise",
    price: 100,
    monthlyCredits: 1500,
    agentMinutes: 150,
    description: "Saves ~24-36 hrs of manual work",
    features: [
      "1 virtual machine, persistent",
      "2.5x more credits than Plus",
      "Advanced web search & data extraction",
      "Full API access (coming soon)",
      "Advanced data extraction at scale",
      "Early access to new features",
      "SLA guarantee, 99.9% uptime",
      "Premium support, 12hr response",
    ],
    popular: false,
  },
]

const additionalCreditPackages = [
  {
    id: "boost-small",
    name: "Small Boost",
    credits: 500,
    price: 5,
    agentMinutes: 50,
    description: "Quick top-up",
  },
  {
    id: "boost-medium",
    name: "Medium Boost",
    credits: 2000,
    price: 18,
    agentMinutes: 200,
    description: "Standard refill",
    savings: "10% savings",
  },
  {
    id: "boost-large",
    name: "Large Boost",
    credits: 5000,
    price: 40,
    agentMinutes: 500,
    description: "Bulk purchase",
    savings: "20% savings",
  },
]

interface Transaction {
  id: string
  type: "purchase" | "usage" | "refund" | "bonus" | "subscription"
  amount: number
  balance_after: number
  created_at: string
  usage_description?: string
  price_paid?: number
}

interface UserSubscription {
  id: string
  status: string
  tier?: string
  current_period_end?: string
  cancel_at_period_end: boolean
  created_at?: string
}

export function BillingSection() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useUser()
  const { credits, loading: creditsLoading, refetch: refetchCredits } = useCredits()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loadingTransactions, setLoadingTransactions] = useState(true)
  const [purchasingPackage, setPurchasingPackage] = useState<string | null>(null)
  const [subscription, setSubscription] = useState<UserSubscription | null>(null)
  const [loadingSubscription, setLoadingSubscription] = useState(true)
  const [subscribingPlan, setSubscribingPlan] = useState<string | null>(null)
  const [showAllTransactions, setShowAllTransactions] = useState(false)
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([])
  const [loadingAllTransactions, setLoadingAllTransactions] = useState(false)

  // Fetch subscription status
  useEffect(() => {
    const fetchSubscription = async () => {
      if (!user) return

      try {
        const response = await fetch("/api/subscription/status")
        if (response.ok) {
          const data = await response.json()
          setSubscription(data.subscription)
        }
      } catch (error) {
        console.error("Error fetching subscription:", error)
      } finally {
        setLoadingSubscription(false)
      }
    }

    fetchSubscription()
  }, [user])

  // Check for success/cancel from Stripe
  useEffect(() => {
    const success = searchParams.get("payment_success")
    const canceled = searchParams.get("payment_canceled")
    const subscriptionSuccess = searchParams.get("subscription_success")

    if (success === "true") {
      toast.success("Payment successful! Your credits have been added.")
      refetchCredits()
      // Clear the URL params
      window.history.replaceState({}, '', window.location.pathname)
    } else if (subscriptionSuccess === "true") {
      toast.success("Subscription activated successfully!")
      refetchCredits()
      window.location.reload() // Reload to update subscription status
    } else if (canceled === "true") {
      toast.error("Payment was canceled. No charges were made.")
      // Clear the URL params
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [searchParams, refetchCredits])

  // Fetch transaction history
  useEffect(() => {
    const fetchTransactions = async () => {
      if (!user) return

      try {
        const response = await fetch("/api/credits/history?limit=5")
        if (!response.ok) throw new Error("Failed to fetch transactions")
        
        const data = await response.json()
        setTransactions(data.transactions)
      } catch (error) {
        console.error("Error fetching transactions:", error)
      } finally {
        setLoadingTransactions(false)
      }
    }

    fetchTransactions()
  }, [user])

  // Fetch all transactions when View All is clicked
  const fetchAllTransactions = async () => {
    if (!user || allTransactions.length > 0) return

    try {
      setLoadingAllTransactions(true)
      const response = await fetch("/api/credits/history?limit=100")
      if (!response.ok) throw new Error("Failed to fetch all transactions")
      
      const data = await response.json()
      setAllTransactions(data.transactions)
    } catch (error) {
      console.error("Error fetching all transactions:", error)
      toast.error("Failed to load all transactions")
    } finally {
      setLoadingAllTransactions(false)
    }
  }

  // Handle View All toggle
  const handleToggleViewAll = async () => {
    if (!showAllTransactions && allTransactions.length === 0) {
      await fetchAllTransactions()
    }
    setShowAllTransactions(!showAllTransactions)
  }

  const handleSubscribe = async (planId: string, tier: string, price: number) => {
    if (!user) {
      toast.error("Please sign in to subscribe")
      return
    }

    try {
      setSubscribingPlan(planId)
      
      const response = await fetch("/api/subscription/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          planId,
          tier,
          price,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to create subscription checkout")
      }

      const { url } = await response.json()
      
      if (url) {
        window.location.href = url
      }
    } catch (error) {
      console.error("Error creating subscription checkout:", error)
      toast.error("Failed to start subscription checkout. Please try again.")
    } finally {
      setSubscribingPlan(null)
    }
  }

  const handlePurchaseCredits = async (packageId: string, credits: number, price: number) => {
    if (!user) {
      toast.error("Please sign in to purchase credits")
      return
    }

    if (!subscription || subscription.status !== "active") {
      toast.error("You need an active subscription to purchase additional credits")
      return
    }

    try {
      setPurchasingPackage(packageId)
      
      const response = await fetch("/api/credits/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          packageId,
          credits,
          price,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to create checkout session")
      }

      const { url } = await response.json()
      
      if (url) {
        window.location.href = url
      }
    } catch (error) {
      console.error("Error creating checkout session:", error)
      toast.error("Failed to start checkout. Please try again.")
    } finally {
      setPurchasingPackage(null)
    }
  }

  const handleManageSubscription = async () => {
    try {
      const response = await fetch("/api/subscription/portal", {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error("Failed to create portal session")
      }

      const { url } = await response.json()
      
      if (url) {
        window.location.href = url
      }
    } catch (error) {
      console.error("Error creating portal session:", error)
      toast.error("Failed to open subscription management. Please try again.")
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "purchase":
        return <ShoppingCart className="h-4 w-4 text-green-500" />
      case "usage":
        return <ArrowUp className="h-4 w-4 text-blue-500" />
      case "refund":
        return <XCircle className="h-4 w-4 text-yellow-500" />
      case "bonus":
        return <CheckCircle className="h-4 w-4 text-purple-500" />
      default:
        return <Coins className="h-4 w-4" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Billing Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <CreditCard className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Billing & Usage</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Manage your usage and view transaction history
        </p>
      </div>

      <Separator />

      {/* Current Balance */}
      <Card className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-background border-2 border-primary/20 shadow-lg">
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-50" />
        
        <CardHeader className="relative pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <div className="p-1.5 rounded-full bg-primary/10">
              <CoastyIcon className="h-4 w-4 text-primary" />
            </div>
            Current Balance
          </CardTitle>
        </CardHeader>
        <CardContent className="relative">
          <div className="space-y-4">
            {/* Main balance display */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                    {creditsLoading ? (
                      <Spinner className="h-8 w-8 animate-spin text-primary" />
                    ) : (
                      (credits?.balance || 0).toLocaleString()
                    )}
                  </span>
                  <span className="text-sm font-medium text-muted-foreground">credits</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  AI Agent Credits Available
                </p>
              </div>
              
              {/* Visual indicator */}
              <div className="relative">
                <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <CoastyIcon className="h-8 w-8 text-primary opacity-80" />
                </div>
              </div>
            </div>
            
            {/* Credits breakdown */}
            <div className="pt-3 border-t border-primary/10">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Credits Remaining</span>
                <span className="text-xs font-medium text-foreground/70">
                  {(credits?.balance || 0).toLocaleString()} credits
                </span>
              </div>

              {/* Fun feedback message */}
              <div className="mt-4 relative">
                {/* Subtle glow effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 rounded-xl blur-lg" />

                <div className="relative p-4 bg-gradient-to-br from-background/95 to-background/80 backdrop-blur-sm border border-border/50 rounded-xl shadow-sm hover:shadow-md transition-all duration-300">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                      <CoastyIcon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <p className="text-sm font-medium text-foreground">
                        Having a blast? Running low? Facing issues?
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Email us your feedback (good or bad!) at{" "}
                        <a
                          href="mailto:founders@coasty.ai?subject=Feedback%20on%20Coasty"
                          className="font-medium text-primary hover:text-primary/80 underline underline-offset-2 decoration-primary/30 hover:decoration-primary/60 transition-all duration-200"
                        >
                          founders@coasty.ai
                        </a>
                        {" "}and we'll probably just reset your credits or bump you up for the month.
                        We're building trust here, one happy user at a time! 🎉
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subscription Plans */}
      {!subscription || subscription.status !== "active" ? (
        <div>
          <h4 className="text-sm font-semibold mb-2">Choose Your Plan</h4>
          <p className="text-xs text-muted-foreground mb-4">Subscribe to unlock AI features and get monthly credits</p>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-3 max-w-4xl mx-auto items-start">
            {subscriptionPlans.map((plan) => (
              <div key={plan.id} className="h-full">
                <div className={cn(
                  "relative h-full rounded-xl border p-5 transition-shadow duration-200",
                  plan.popular
                    ? "border-primary bg-primary/[0.03] shadow-sm shadow-primary/10"
                    : "border-border"
                )}>
                  {plan.popular && (
                    <div className="absolute -top-2.5 left-4">
                      <span className="rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-medium text-primary-foreground">
                        Most Popular
                      </span>
                    </div>
                  )}

                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-muted-foreground">{plan.name}</h3>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-3xl font-semibold tracking-tight">${plan.price}</span>
                      <span className="text-sm text-muted-foreground">/month</span>
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{plan.description}</p>
                  </div>

                  <div className="mb-4 flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
                    <CoastyIcon className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="text-sm font-medium">
                      {plan.monthlyCredits.toLocaleString()} credits
                      <span className="text-muted-foreground font-normal">/month</span>
                    </span>
                  </div>

                  <Button
                    className={cn(
                      "w-full mb-5",
                      !plan.popular && "hover:bg-primary hover:text-primary-foreground"
                    )}
                    variant={plan.popular ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleSubscribe(plan.id, plan.tier, plan.price)}
                    disabled={subscribingPlan === plan.id}
                  >
                    {subscribingPlan === plan.id ? (
                      <>
                        <Spinner className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        Subscribe Now
                        <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                      </>
                    )}
                  </Button>

                  <div className="space-y-2.5">
                    {plan.features.map((feature, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <Check className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                        <span className="text-xs text-muted-foreground">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Active Subscription Info - Compact Version */}
          <Card className="bg-gradient-to-br from-green-500/5 to-background border-2 border-green-500/20">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">
                      {(() => {
                        const activePlan = subscriptionPlans.find(p => p.tier === subscription.tier);
                        return activePlan?.name || "Active Plan";
                      })()}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      ${(() => {
                        const activePlan = subscriptionPlans.find(p => p.tier === subscription.tier);
                        return activePlan?.price || 0;
                      })()}/month • {(() => {
                        const activePlan = subscriptionPlans.find(p => p.tier === subscription.tier);
                        const monthlyCredits = activePlan?.monthlyCredits || 0;
                        return `${monthlyCredits.toLocaleString()} credits`;
                      })()}
                    </CardDescription>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleManageSubscription}
                  className="hover:bg-primary hover:text-primary-foreground"
                >
                  <CreditCard className="mr-1 h-3 w-3" />
                  Manage
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0 pb-4">
              <div className="space-y-3">
                {/* Renewal info */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Status</span>
                  <div className="flex items-center gap-1">
                    {subscription.cancel_at_period_end ? (
                      <>
                        <XCircle className="h-3 w-3 text-yellow-600" />
                        <span className="text-yellow-600">Cancels {subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : 'N/A'}</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        <span className="text-green-600">Renews {subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : 'N/A'}</span>
                      </>
                    )}
                  </div>
                </div>
                
                {/* Quick features list */}
                <div className="pt-2 border-t">
                  <details className="group">
                    <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors flex items-center gap-1">
                      <span>View plan features</span>
                      <ArrowRight className="h-3 w-3 transition-transform group-open:rotate-90" />
                    </summary>
                    <div className="mt-3 space-y-2">
                      {(() => {
                        const activePlan = subscriptionPlans.find(p => p.tier === subscription.tier);
                        return activePlan?.features.slice(0, 4).map((feature, idx) => (
                          <div key={idx} className="flex items-start gap-2">
                            <Check className="h-3 w-3 text-green-500 mt-0.5" />
                            <span className="text-xs text-muted-foreground">{feature}</span>
                          </div>
                        )) || [];
                      })()}
                      {(() => {
                        const activePlan = subscriptionPlans.find(p => p.tier === subscription.tier);
                        const remaining = (activePlan?.features.length || 0) - 4;
                        return remaining > 0 ? (
                          <span className="text-xs text-muted-foreground ml-5">+{remaining} more features</span>
                        ) : null;
                      })()}
                    </div>
                  </details>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Additional Minutes */}
          <div>
            <h4 className="text-sm font-medium mb-1">Need More Credits?</h4>
            <p className="text-xs text-muted-foreground mb-3">Purchase additional credits anytime</p>
            <div className="grid gap-4 sm:grid-cols-3">
              {additionalCreditPackages.map((pkg) => (
                <div key={pkg.id} className="group">
                  <Card
                    className={cn(
                      "relative h-full transition-all duration-300",
                      "border-2 hover:border-primary/30",
                      "hover:shadow-lg hover:shadow-primary/5",
                      "hover:-translate-y-1",
                      "bg-gradient-to-b from-background to-background/95"
                    )}
                  >
                    {/* Subtle glow effect on hover */}
                    <div className="absolute inset-0 bg-gradient-to-t from-primary/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg" />
                    
                    <CardHeader className="relative pb-3 pt-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm group-hover:text-primary transition-colors">{pkg.name}</CardTitle>
                        <span className="text-lg font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">${pkg.price}</span>
                      </div>
                      <CardDescription className="text-xs mt-1">
                        <span className="font-semibold text-primary">{pkg.credits.toLocaleString()} credits</span>
                        {pkg.savings && (
                          <Badge variant="secondary" className="ml-1 text-[10px] bg-green-500/10 text-green-600 border-green-500/20">
                            {pkg.savings}
                          </Badge>
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="relative pb-3">
                      <p className="text-xs text-muted-foreground">{pkg.description}</p>
                    </CardContent>
                    <CardFooter className="relative pt-0">
                      <Button
                        size="sm"
                        className={cn(
                          "w-full h-8 text-xs transition-all duration-200",
                          "hover:bg-primary hover:text-primary-foreground",
                          "hover:shadow-md hover:shadow-primary/20"
                        )}
                        variant="outline"
                        onClick={() => handlePurchaseCredits(pkg.id, pkg.credits, pkg.price)}
                        disabled={purchasingPackage === pkg.id}
                      >
                        {purchasingPackage === pkg.id ? (
                          <>
                            <Spinner className="mr-1 h-3 w-3 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            <span>Add Credits</span>
                            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
                          </div>
                        )}
                      </Button>
                    </CardFooter>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Recent Transactions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium">
            {showAllTransactions ? "Transaction History" : "Recent Transactions"}
          </h4>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={handleToggleViewAll}
            disabled={loadingAllTransactions}
          >
            {loadingAllTransactions ? (
              <Spinner className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <Receipt className="mr-1 h-3 w-3" />
            )}
            {loadingAllTransactions ? "Loading..." : showAllTransactions ? "Show Less" : "View All"}
          </Button>
        </div>
        
        <Card className={showAllTransactions ? "" : ""}>
          <CardContent className={showAllTransactions ? "p-0 max-h-[500px] overflow-y-auto" : "p-0"}>
            {(loadingTransactions || loadingAllTransactions) ? (
              <div className="flex justify-center py-6">
                <Spinner className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                No transactions yet
              </div>
            ) : (
              <div className="divide-y">
                {(showAllTransactions ? (allTransactions.length > 0 ? allTransactions : transactions) : transactions.slice(0, 5)).map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between px-4 py-3 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      {getTransactionIcon(transaction.type)}
                      <div>
                        <div className="font-medium capitalize">
                          {transaction.type}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(transaction.created_at)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={cn(
                        "font-medium",
                        transaction.amount > 0 ? "text-green-600 dark:text-green-500" : "text-red-600 dark:text-red-500"
                      )}>
                        {transaction.amount > 0 ? "+" : ""}{transaction.amount.toLocaleString()} credits
                      </div>
                      {transaction.price_paid && (
                        <div className="text-xs text-muted-foreground">
                          ${transaction.price_paid}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        {!showAllTransactions && transactions.length >= 5 && (
          <p className="text-xs text-muted-foreground text-center mt-2">
            Showing recent 5 transactions
          </p>
        )}
        {showAllTransactions && allTransactions.length > 0 && (
          <p className="text-xs text-muted-foreground text-center mt-2">
            Showing all {allTransactions.length} transactions
          </p>
        )}
      </div>
    </div>
  )
}