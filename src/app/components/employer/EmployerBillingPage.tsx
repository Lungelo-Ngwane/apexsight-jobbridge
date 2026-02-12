import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { 
  CreditCard,
  Crown,
  Zap,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  Calendar,
  Download,
  FileText,
  DollarSign,
  ArrowUpRight,
  Building2,
  Users,
  Briefcase
} from "lucide-react";
import { Progress } from "@/app/components/ui/progress";

export function EmployerBillingPage() {
  const currentPlan = {
    name: "Professional",
    price: "R 4,999",
    period: "per month",
    icon: Zap,
    features: [
      "50 active job postings",
      "Unlimited candidate views",
      "Advanced analytics",
      "Priority support",
      "Team collaboration (5 users)"
    ],
    usage: {
      jobs: { used: 32, total: 50 },
      users: { used: 3, total: 5 }
    },
    renewalDate: "March 15, 2026",
    status: "Active"
  };

  const invoices = [
    {
      id: "INV-2026-002",
      date: "Feb 1, 2026",
      amount: "R 4,999",
      status: "Paid",
      downloadUrl: "#"
    },
    {
      id: "INV-2026-001",
      date: "Jan 1, 2026",
      amount: "R 4,999",
      status: "Paid",
      downloadUrl: "#"
    },
    {
      id: "INV-2025-012",
      date: "Dec 1, 2025",
      amount: "R 4,999",
      status: "Paid",
      downloadUrl: "#"
    },
    {
      id: "INV-2025-011",
      date: "Nov 1, 2025",
      amount: "R 2,499",
      status: "Paid",
      downloadUrl: "#"
    }
  ];

  const availablePlans = [
    {
      name: "Starter",
      icon: Building2,
      price: "R 2,499",
      period: "per month",
      description: "Perfect for small businesses",
      features: [
        "10 active job postings",
        "100 candidate views/month",
        "Basic analytics",
        "Email support",
        "1 user"
      ],
      color: "from-gray-500 to-gray-600"
    },
    {
      name: "Professional",
      icon: Zap,
      price: "R 4,999",
      period: "per month",
      description: "Most popular for growing teams",
      features: [
        "50 active job postings",
        "Unlimited candidate views",
        "Advanced analytics",
        "Priority support",
        "Team collaboration (5 users)"
      ],
      color: "from-blue-500 to-blue-600",
      current: true,
      popular: true
    },
    {
      name: "Enterprise",
      icon: Crown,
      price: "Custom",
      period: "contact sales",
      description: "For large organizations",
      features: [
        "Unlimited job postings",
        "Unlimited candidate views",
        "Custom analytics & reporting",
        "Dedicated account manager",
        "Unlimited users",
        "API access",
        "Custom integrations"
      ],
      color: "from-purple-500 to-purple-600"
    }
  ];

  return (
    <div className="min-h-full bg-gradient-to-br from-gray-50 via-emerald-50/20 to-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Billing & Subscription</h1>
              <p className="text-sm text-gray-600">Manage your plan, billing, and invoices</p>
            </div>
            <Button 
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg shadow-blue-500/30"
            >
              <Crown className="w-4 h-4 mr-2" />
              Upgrade Plan
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Current Plan */}
            <Card className="relative overflow-hidden border-0 shadow-xl shadow-blue-200/50">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-blue-600 opacity-[0.08]" />
              <div className="relative p-8">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                      <currentPlan.icon className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h2 className="text-2xl font-bold text-gray-900">{currentPlan.name} Plan</h2>
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                          {currentPlan.status}
                        </Badge>
                      </div>
                      <p className="text-gray-600">
                        <span className="text-2xl font-bold text-gray-900">{currentPlan.price}</span>
                        <span className="text-sm ml-2">{currentPlan.period}</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  {/* Jobs Usage */}
                  <div className="p-4 bg-white rounded-xl border border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Briefcase className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium text-gray-700">Job Postings</span>
                      </div>
                      <span className="text-sm font-bold text-gray-900">
                        {currentPlan.usage.jobs.used} / {currentPlan.usage.jobs.total}
                      </span>
                    </div>
                    <Progress 
                      value={(currentPlan.usage.jobs.used / currentPlan.usage.jobs.total) * 100} 
                      className="h-2"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      {currentPlan.usage.jobs.total - currentPlan.usage.jobs.used} slots remaining
                    </p>
                  </div>

                  {/* Users Usage */}
                  <div className="p-4 bg-white rounded-xl border border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-purple-600" />
                        <span className="text-sm font-medium text-gray-700">Team Members</span>
                      </div>
                      <span className="text-sm font-bold text-gray-900">
                        {currentPlan.usage.users.used} / {currentPlan.usage.users.total}
                      </span>
                    </div>
                    <Progress 
                      value={(currentPlan.usage.users.used / currentPlan.usage.users.total) * 100} 
                      className="h-2"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      {currentPlan.usage.users.total - currentPlan.usage.users.used} seats available
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 mb-6">
                  <div className="flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 mb-1">Next billing date</p>
                      <p className="text-sm text-gray-600">{currentPlan.renewalDate}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mb-6">
                  <p className="text-sm font-medium text-gray-700 mb-3">Plan includes:</p>
                  {currentPlan.features.map((feature, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      <span className="text-sm text-gray-700">{feature}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-3">
                  <Button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white">
                    <Crown className="w-4 h-4 mr-2" />
                    Upgrade to Enterprise
                  </Button>
                  <Button variant="outline" className="border-gray-300">
                    Change Plan
                  </Button>
                  <Button variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                    Cancel Subscription
                  </Button>
                </div>
              </div>
            </Card>

            {/* Payment Method */}
            <Card className="p-6 border-gray-200 shadow-md">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Payment Method</h3>
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="w-12 h-12 bg-gradient-to-br from-gray-700 to-gray-900 rounded-lg flex items-center justify-center shadow-md">
                  <CreditCard className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Visa ending in 4242</p>
                  <p className="text-sm text-gray-600">Expires 12/2028</p>
                </div>
                <Button variant="outline" size="sm" className="border-gray-300">
                  Update
                </Button>
              </div>
            </Card>

            {/* Recent Invoices */}
            <Card className="p-6 border-gray-200 shadow-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Recent Invoices</h3>
                <Button variant="outline" size="sm" className="gap-2 border-gray-300">
                  <Download className="w-4 h-4" />
                  Download All
                </Button>
              </div>
              <div className="space-y-3">
                {invoices.map((invoice) => (
                  <div 
                    key={invoice.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white rounded-lg border border-gray-200 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-gray-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{invoice.id}</p>
                        <p className="text-xs text-gray-600">{invoice.date}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-900">{invoice.amount}</p>
                        <Badge className="bg-emerald-100 text-emerald-700 text-xs border-emerald-200">
                          {invoice.status}
                        </Badge>
                      </div>
                      <Button variant="ghost" size="sm">
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Billing Summary */}
            <Card className="p-6 border-gray-200 shadow-md">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Billing Summary</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                  <span className="text-sm text-gray-600">Subscription</span>
                  <span className="text-sm font-bold text-gray-900">{currentPlan.price}</span>
                </div>
                <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                  <span className="text-sm text-gray-600">Tax (VAT 15%)</span>
                  <span className="text-sm font-bold text-gray-900">R 749.85</span>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-base font-bold text-gray-900">Total</span>
                  <span className="text-lg font-bold text-gray-900">R 5,748.85</span>
                </div>
              </div>
            </Card>

            {/* Usage Alert */}
            <Card className="p-5 bg-amber-50 border-amber-200 shadow-md">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900 mb-1">Approaching Limit</h4>
                  <p className="text-xs text-gray-700 mb-3">
                    You're using 64% of your job posting slots. Consider upgrading to avoid disruption.
                  </p>
                  <Button 
                    size="sm" 
                    className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white"
                  >
                    Upgrade Now
                  </Button>
                </div>
              </div>
            </Card>

            {/* Stats */}
            <Card className="p-6 border-gray-200 shadow-md">
              <h3 className="text-sm font-bold text-gray-700 mb-4">This Month</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Briefcase className="w-4 h-4 text-blue-600" />
                    </div>
                    <span className="text-sm text-gray-600">Jobs Posted</span>
                  </div>
                  <span className="text-lg font-bold text-gray-900">8</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                      <Users className="w-4 h-4 text-emerald-600" />
                    </div>
                    <span className="text-sm text-gray-600">Candidates Viewed</span>
                  </div>
                  <span className="text-lg font-bold text-gray-900">342</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-purple-600" />
                    </div>
                    <span className="text-sm text-gray-600">Analytics Views</span>
                  </div>
                  <span className="text-lg font-bold text-gray-900">87</span>
                </div>
              </div>
            </Card>

            {/* Need Help */}
            <Card className="p-6 bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200 shadow-md">
              <h3 className="text-sm font-bold text-gray-900 mb-2">Need Help?</h3>
              <p className="text-xs text-gray-600 mb-4">
                Have questions about your billing or need to discuss custom plans?
              </p>
              <Button 
                variant="outline" 
                className="w-full border-gray-300 bg-white hover:bg-gray-50"
              >
                Contact Support
              </Button>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
