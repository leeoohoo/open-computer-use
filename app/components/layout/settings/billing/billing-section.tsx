"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { useCredits } from "@/lib/hooks/use-credits"
import { useUser } from "@/lib/user-store/provider"
import { ShoppingCart, ArrowUp, CheckCircle, XCircle, Spinner, CreditCard, Receipt, Coins } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import { Check, Zap, ArrowRight, Clock, HardDrive } from "lucide-react"
import { CoastyIcon } from "@/components/icons/coasty"
import { RunFeedbackBar } from "@/app/components/chat/run-feedback-bar"

const subscriptionPlans = [
  {
    id: "lite",
    name: "Lite",
    tier: "lite",
    price: 9,
    monthlyCredits: 100,
    machines: 1,
    swarm: 2,
    description: "Light daily automation",
    features: [
      "1 VM (deleted after inactivity)",
      "2 agents in parallel",
      "Basic search",
      "Standard support (real humans)",
    ],
    popular: false,
  },
  {
    id: "starter",
    name: "Starter",
    tier: "starter",
    price: 19,
    monthlyCredits: 200,
    machines: 1,
    swarm: 3,
    description: "Automate tasks every day",
    features: [
      "1 always-on VM",
      "3 agents in parallel",
      "Advanced search & extraction",
      "Standard support (real humans)",
    ],
    popular: false,
  },
  {
    id: "professional",
    name: "Plus",
    tier: "professional",
    price: 50,
    monthlyCredits: 600,
    machines: 2,
    swarm: 6,
    description: "Scale complex workflows",
    features: [
      "2 always-on VMs",
      "6 agents in parallel",
      "Advanced search & extraction",
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
    machines: 3,
    swarm: 9,
    description: "Unlimited heavy automation",
    features: [
      "3 always-on VMs",
      "9 agents in parallel",
      "Advanced search & extraction",
      "Premium support, 12hr response",
    ],
    popular: false,
  },
]

const additionalCreditPackages = [
  {
    id: "boost-small",
    name: "Small Boost",
    credits: 100,
    price: 9,
    agentMinutes: 10,
    description: "Quick top-up",
  },
  {
    id: "boost-medium",
    name: "Medium Boost",
    credits: 300,
    price: 25,
    agentMinutes: 30,
    description: "Standard refill",
    savings: "8% savings",
  },
  {
    id: "boost-large",
    name: "Large Boost",
    credits: 600,
    price: 45,
    agentMinutes: 60,
    description: "Bulk purchase",
    savings: "17% savings",
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
  const [selectedPlan, setSelectedPlan] = useState(2) // default to Plus

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
      window.history.replaceState({}, '', window.location.pathname)
    } else if (subscriptionSuccess === "true") {
      toast.success("Subscription activated successfully!")
      refetchCredits()
      window.location.reload()
    } else if (canceled === "true") {
      toast.error("Payment was canceled. No charges were made.")
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

  const plan = subscriptionPlans[selectedPlan]

  return (
    <div className="space-y-8">
      {/* Current Balance */}
      <div className="rounded-xl border border-primary/20 bg-gradient-to-b from-primary/[0.04] to-transparent p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <CoastyIcon className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-muted-foreground">Current Balance</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-foreground">
                {creditsLoading ? (
                  <Spinner className="h-7 w-7 animate-spin text-primary" />
                ) : (
                  (credits?.balance || 0).toLocaleString()
                )}
              </span>
              <span className="text-sm text-muted-foreground">credits</span>
            </div>
          </div>
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <CoastyIcon className="h-6 w-6 text-primary" />
          </div>
        </div>

        {/* Feedback bar — earn credits by sharing feedback */}
        <div className="mt-4 pt-4 border-t border-primary/10">
          <RunFeedbackBar feedbackType="run" />
        </div>
      </div>

      {/* Subscription Plans */}
      {!subscription || subscription.status !== "active" ? (
        <div>
          <h4 className="text-base font-semibold mb-1">Choose Your Plan</h4>
          <p className="text-sm text-muted-foreground mb-6">Subscribe to unlock AI features and get monthly credits</p>

          {/* Plan pills */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {subscriptionPlans.map((p, i) => (
              <button
                key={p.name}
                onClick={() => setSelectedPlan(i)}
                className={cn(
                  "relative rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-1.5 px-4 py-2.5",
                  selectedPlan === i
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {p.name}
                <span className={cn(
                  "text-xs font-normal",
                  selectedPlan === i ? "text-primary-foreground/70" : "text-muted-foreground/60"
                )}>
                  ${p.price}
                </span>
                {p.popular && selectedPlan !== i && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Savings pill */}
          {(() => {
            const humanCost = plan.price === 9 ? 1000 : plan.price === 19 ? 1500 : plan.price === 50 ? 3000 : 5000
            const moneySaved = (humanCost - plan.price).toLocaleString()
            const timeSaved = plan.price === 9 ? "3-6 hrs" : plan.price === 19 ? "6-12 hrs" : plan.price === 50 ? "18-24 hrs" : "24-36 hrs"
            const multiplier = plan.price === 9 ? "111x" : plan.price === 19 ? "79x" : plan.price === 50 ? "60x" : "50x"
            return (
              <div className="flex justify-center mb-6">
                <div className="inline-flex items-center gap-3 rounded-full border border-border bg-muted/40 px-4 py-2">
                  <span className="text-xs text-muted-foreground">
                    Save <span className="font-semibold text-foreground">${moneySaved}/mo</span> vs human
                  </span>
                  <span className="h-3 w-px bg-border" />
                  <span className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{timeSaved}</span> saved monthly
                  </span>
                  <span className="h-3 w-px bg-border" />
                  <span className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{multiplier}</span> cheaper
                  </span>
                </div>
              </div>
            )
          })()}

          {/* Plan card + features */}
          <div className={cn(
            "relative rounded-xl border p-6",
            plan.popular
              ? "border-primary/30 bg-gradient-to-b from-primary/[0.06] to-primary/[0.02] shadow-sm shadow-primary/10"
              : "border-border"
          )}>
            {plan.popular && (
              <div className="absolute -top-2.5 left-4">
                <span className="rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-medium text-primary-foreground">
                  Most Popular
                </span>
              </div>
            )}

            <div className="flex items-start justify-between mb-5">
              <div>
                <div className="flex items-center gap-2">
                  <CoastyIcon className="h-5 w-5 text-primary" />
                  <h3 className="text-sm font-semibold text-primary">Coasty {plan.name}</h3>
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-4xl font-semibold tracking-tight text-foreground">${plan.price}</span>
                  <span className="text-sm text-muted-foreground">/month</span>
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">{plan.description}</p>
              </div>
            </div>

            <div className="mb-3 flex items-center gap-2 rounded-lg bg-primary/[0.08] border border-primary/10 px-3 py-2">
              <Zap className="h-3.5 w-3.5 text-primary flex-shrink-0" />
              <span className="text-sm font-medium text-foreground">
                {plan.monthlyCredits.toLocaleString()} credits<span className="text-muted-foreground font-normal">/month</span>
              </span>
            </div>

            {/* Machines highlight */}
            <div className="mb-5 flex items-center gap-2 rounded-lg bg-violet-500/[0.08] border border-violet-500/15 px-3 py-2">
              <HardDrive className="h-3.5 w-3.5 text-violet-500 flex-shrink-0" />
              <span className="text-sm font-medium text-foreground">
                {plan.id === "lite" ? "1 VM (deleted after inactivity)" : `${plan.machines} always-on VM${plan.machines > 1 ? "s" : ""}`}
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
                  Subscribe to {plan.name}
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </>
              )}
            </Button>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {plan.features.map((feature, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <Check className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Active Subscription */}
          <div className="rounded-xl border border-green-500/20 bg-gradient-to-b from-green-500/[0.04] to-transparent p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">
                    {(() => {
                      const activePlan = subscriptionPlans.find(p => p.tier === subscription.tier)
                      return activePlan?.name || "Active Plan"
                    })()}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    ${(() => {
                      const activePlan = subscriptionPlans.find(p => p.tier === subscription.tier)
                      return activePlan?.price || 0
                    })()}/month
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleManageSubscription}
                className="hover:bg-primary hover:text-primary-foreground"
              >
                <CreditCard className="mr-1.5 h-3.5 w-3.5" />
                Manage
              </Button>
            </div>

            <div className="mt-4 pt-3 border-t border-green-500/10 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Status</span>
              <div className="flex items-center gap-1.5">
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

            {/* Plan features collapsible */}
            <details className="mt-3 group">
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors flex items-center gap-1">
                View plan features
                <ArrowRight className="h-3 w-3 transition-transform group-open:rotate-90" />
              </summary>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(() => {
                  const activePlan = subscriptionPlans.find(p => p.tier === subscription.tier)
                  return activePlan?.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <Check className="h-3 w-3 text-green-500 mt-0.5" />
                      <span className="text-xs text-muted-foreground">{feature}</span>
                    </div>
                  )) || []
                })()}
              </div>
            </details>
          </div>

          {/* Additional Credits */}
          <div>
            <h4 className="text-base font-semibold mb-1">Need More Credits?</h4>
            <p className="text-sm text-muted-foreground mb-4">Purchase additional credits anytime</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {additionalCreditPackages.map((pkg) => (
                <div
                  key={pkg.id}
                  className="rounded-xl border border-border p-4 hover:border-primary/30 hover:shadow-sm transition-all duration-200"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-foreground">{pkg.name}</span>
                    <span className="text-lg font-bold text-foreground">${pkg.price}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mb-3">
                    <Zap className="h-3.5 w-3.5 text-primary" />
                    <span className="text-sm font-medium text-primary">{pkg.credits.toLocaleString()} credits</span>
                    {pkg.savings && (
                      <Badge variant="secondary" className="text-[10px] bg-green-500/10 text-green-600 border-green-500/20 ml-1">
                        {pkg.savings}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">{pkg.description}</p>
                  <Button
                    size="sm"
                    className="w-full hover:bg-primary hover:text-primary-foreground"
                    variant="outline"
                    onClick={() => handlePurchaseCredits(pkg.id, pkg.credits, pkg.price)}
                    disabled={purchasingPackage === pkg.id}
                  >
                    {purchasingPackage === pkg.id ? (
                      <>
                        <Spinner className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        Add Credits
                        <ArrowRight className="ml-1.5 h-3 w-3" />
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Transactions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-base font-semibold">
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

        <div className={cn(
          "rounded-xl border border-border overflow-hidden",
          showAllTransactions && "max-h-[500px] overflow-y-auto"
        )}>
          {(loadingTransactions || loadingAllTransactions) ? (
            <div className="flex justify-center py-8">
              <Spinner className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No transactions yet
            </div>
          ) : (
            <div>
              {(showAllTransactions ? (allTransactions.length > 0 ? allTransactions : transactions) : transactions.slice(0, 5)).map((transaction, i, arr) => (
                <div
                  key={transaction.id}
                  className={cn(
                    "flex items-center justify-between px-4 py-3",
                    i < arr.length - 1 && "border-b border-border",
                    i % 2 === 1 && "bg-muted/20"
                  )}
                >
                  <div className="flex items-center gap-3">
                    {getTransactionIcon(transaction.type)}
                    <div>
                      <div className="text-sm font-medium capitalize">{transaction.type}</div>
                      <div className="text-xs text-muted-foreground">{formatDate(transaction.created_at)}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={cn(
                      "text-sm font-medium",
                      transaction.amount > 0 ? "text-green-600 dark:text-green-500" : "text-red-600 dark:text-red-500"
                    )}>
                      {transaction.amount > 0 ? "+" : ""}{transaction.amount.toLocaleString()} credits
                    </div>
                    {transaction.price_paid && (
                      <div className="text-xs text-muted-foreground">${transaction.price_paid}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
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
