import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import {
  ArrowRight,
  Binary,
  Building2,
  CheckCircle2,
  CircuitBoard,
  Crown,
  Globe2,
  LockKeyhole,
  MessageSquareMore,
  ScanSearch,
  Sparkles,
  Users,
  Workflow,
  Zap,
} from "lucide-react";

interface JobBridgeLandingProps {
  onGetStarted: () => void;
}

const pricingPlans = [
  {
    name: "Free",
    price: "R0",
    period: "forever",
    description: "For testing the workflow and posting your first role.",
    icon: Building2,
    features: ["1 active job posting", "Up to 10 applicants per job", "Basic candidate filtering", "Email support"],
  },
  {
    name: "Starter",
    price: "R999",
    period: "per month",
    description: "For smaller teams that need consistent hiring flow.",
    icon: Zap,
    features: ["2 active job postings", "50 candidate views / month", "Basic analytics", "2 team users"],
  },
  {
    name: "Professional",
    price: "R2,999",
    period: "per month",
    description: "For teams using JobBridge as a real hiring operating layer.",
    icon: Sparkles,
    features: ["3 active job postings", "300 candidate views / month", "Advanced skill matching", "5 team users"],
    featured: true,
  },
  {
    name: "Enterprise",
    price: "R9,999",
    period: "per month",
    description: "For larger hiring teams with scale and control requirements.",
    icon: Crown,
    features: ["4 active job postings", "Dedicated account manager", "Custom integrations", "SLA-backed support"],
  },
] as const;

export function JobBridgeLanding({ onGetStarted }: JobBridgeLandingProps) {
  const location = useLocation();

  useEffect(() => {
    if (location.hash !== "#pricing") return;
    const element = document.getElementById("jobbridge-pricing");
    if (!element) return;
    requestAnimationFrame(() => {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [location.hash]);

  return (
    <div className="min-h-screen text-neutral-950">
      <section className="mx-auto max-w-7xl px-4 pb-12 pt-16 sm:px-6 lg:pb-16 lg:pt-18">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] lg:items-start">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-black/8 bg-white/80 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-neutral-700 shadow-sm">
              <Sparkles className="h-4 w-4" />
              Employer hiring surface
            </div>

            <h1 className="mt-6 text-4xl font-extrabold leading-[0.98] tracking-[-0.06em] text-neutral-950 sm:text-5xl lg:text-[4.4rem]">
              Search and hire with
              <span className="block text-neutral-500">better talent signal</span>
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-7 text-neutral-600 sm:text-[1.05rem]">
              JobBridge turns your employer workflow into a structured hiring system: define the brief,
              review ranked candidates, message prospects, schedule interviews, and keep premium controls in one place.
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Button
                onClick={onGetStarted}
                size="lg"
                className="h-14 rounded-full bg-neutral-950 px-8 text-base font-semibold text-white hover:bg-neutral-800"
              >
                Start Hiring
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                onClick={onGetStarted}
                size="lg"
                variant="outline"
                className="h-14 rounded-full border-black/10 bg-white/80 px-8 text-base font-semibold text-neutral-800"
              >
                View Workflow
              </Button>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {[
                "Structured search briefs",
                "Ranked candidate review",
                "Messaging and interview operations",
              ].map((item) => (
                <div key={item} className="rounded-3xl border border-black/6 bg-white/75 p-4 shadow-[0_12px_30px_rgba(15,15,15,0.04)]">
                  <CheckCircle2 className="h-5 w-5 text-neutral-950" />
                  <p className="mt-3 text-sm leading-6 text-neutral-700">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <Card className="overflow-hidden rounded-[34px] border border-black/6 bg-[#131313] text-white shadow-[0_32px_90px_rgba(15,15,15,0.22)]">
            <div className="border-b border-white/10 px-6 py-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-neutral-400">Recruiter console</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Everything around the hiring brief stays connected</h2>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <Building2 className="h-7 w-7" />
                </div>
              </div>
            </div>

            <div className="space-y-4 p-6">
              <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl border border-white/10 bg-white/10 p-2 text-white">
                    <Binary className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-neutral-400">Live job signal</p>
                    <p className="text-lg font-semibold text-white">Fit, response, and next step in one view</p>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {[
                    { value: "128", label: "Qualified candidates", icon: Users },
                    { value: "34", label: "In review", icon: ScanSearch },
                    { value: "8", label: "Interviews booked", icon: MessageSquareMore },
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl border border-white/8 bg-black/20 p-4">
                      <item.icon className="h-4 w-4 text-[#f5f5f7]" />
                      <p className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-white">{item.value}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-neutral-400">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { icon: CircuitBoard, label: "AI-assisted ranking" },
                  { icon: Workflow, label: "Decision workflow" },
                  { icon: LockKeyhole, label: "Plans and controls" },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white">
                    <item.icon className="h-5 w-5 text-white" />
                    <p className="mt-3 text-sm font-medium text-white">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          {[
            {
              value: "Brief-led",
              label: "Roles are defined with structured requirements first",
              icon: Globe2,
            },
            {
              value: "Ranked",
              label: "Candidate review is ordered by fit and signal quality",
              icon: ScanSearch,
            },
            {
              value: "Connected",
              label: "Messaging and interviews stay inside the workflow",
              icon: MessageSquareMore,
            },
            {
              value: "Controlled",
              label: "Billing, premium access, and add-ons are built into the product",
              icon: LockKeyhole,
            },
          ].map((stat) => (
            <Card key={stat.label} className="rounded-[28px] border border-black/6 bg-white/75 p-6 shadow-[0_12px_30px_rgba(15,15,15,0.04)]">
              <stat.icon className="h-8 w-8 text-neutral-950" />
              <div className="mt-6 text-3xl font-bold tracking-[-0.05em] text-neutral-900">{stat.value}</div>
              <div className="mt-2 text-sm leading-6 text-neutral-600">{stat.label}</div>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="mb-12 max-w-3xl">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-600">Hiring flow</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-neutral-950 sm:text-[2.1rem]">
            From brief to interview without losing context
          </h2>
          <p className="mt-4 text-lg leading-8 text-neutral-600">
            The workflow is designed to reduce switching cost: define what good looks like, review ranked candidates, act quickly, and keep evidence attached to each decision.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          {[
            {
              step: "1",
              title: "Define the hiring brief",
              description: "Capture the role with required skills, experience, and hiring criteria.",
            },
            {
              step: "2",
              title: "Review ranked candidates",
              description: "See fit signals, readiness, and profile depth before you open a CV.",
            },
            {
              step: "3",
              title: "Shortlist and message",
              description: "Move the best profiles forward and keep communication inside the product.",
            },
            {
              step: "4",
              title: "Schedule and decide",
              description: "Run interviews, collect signal, and make a cleaner final decision.",
            },
          ].map((step, index) => (
            <div key={step.title} className="relative">
              <Card className="h-full rounded-[28px] border border-black/6 bg-white p-6 shadow-[0_14px_34px_rgba(15,15,15,0.04)]">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-950 text-xl font-bold text-white">
                  {step.step}
                </div>
                <h3 className="mb-2 mt-5 font-semibold text-neutral-900">{step.title}</h3>
                <p className="text-sm leading-7 text-neutral-600">{step.description}</p>
              </Card>
              {index < 3 && (
                <div className="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 md:block">
                  <ArrowRight className="h-6 w-6 text-neutral-300" />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-600">Why it feels more modern</p>
            <h2 className="mb-6 mt-3 text-3xl font-semibold tracking-[-0.05em] text-neutral-950 sm:text-[2.1rem]">
              JobBridge is shaped around signal quality and execution speed
            </h2>
            <div className="space-y-6">
              {[
                {
                  icon: CircuitBoard,
                  title: "AI-assisted ranking",
                  description: "The system helps prioritize candidates without hiding the underlying hiring criteria.",
                },
                {
                  icon: Users,
                  title: "Richer candidate profiles",
                  description: "Profiles expose skills, certifications, history, and preferences in a cleaner review format.",
                },
                {
                  icon: Workflow,
                  title: "Operational continuity",
                  description: "Shortlisting, messaging, and interviews stay attached to the same candidate record.",
                },
                {
                  icon: LockKeyhole,
                  title: "Built-in business controls",
                  description: "Plans, add-ons, featured visibility, and access rules are part of the product model.",
                },
              ].map((feature) => (
                <div key={feature.title} className="flex gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-neutral-950">
                    <feature.icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="mb-1 font-semibold text-neutral-900">{feature.title}</h3>
                    <p className="text-sm leading-7 text-neutral-600">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[32px] border border-black/6 bg-[#131313] p-8 text-white shadow-[0_24px_70px_rgba(15,15,15,0.18)]">
            <h3 className="text-xl font-semibold text-white">What employers get in practice</h3>

            <div className="mb-8 mt-6 space-y-6">
              {[
                {
                  company: "Search and shortlist",
                  type: "Ranked review workflow",
                  hires: "Faster first pass",
                },
                {
                  company: "Candidate outreach",
                  type: "Messaging in product",
                  hires: "Lower coordination overhead",
                },
                {
                  company: "Interview tracking",
                  type: "Shared hiring timeline",
                  hires: "Clear next steps",
                },
                {
                  company: "Plan and credit controls",
                  type: "Commercial layer included",
                  hires: "Premium workflows supported",
                },
              ].map((client) => (
                <div key={client.company} className="flex items-center gap-4 border-b border-white/10 pb-4 last:border-0">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                    <Building2 className="h-6 w-6 text-[#f5f5f7]" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-white">{client.company}</h4>
                    <p className="text-xs uppercase tracking-[0.16em] text-neutral-400">{client.type}</p>
                  </div>
                  <div className="text-sm font-medium text-[#f5f5f7]">{client.hires}</div>
                </div>
              ))}
            </div>

            <Button
              onClick={onGetStarted}
              className="w-full rounded-full border border-white/10 bg-white text-neutral-950 hover:bg-neutral-200"
              size="lg"
            >
              Start Hiring Today
            </Button>
          </div>
        </div>
      </section>

      <section id="jobbridge-pricing" className="mx-auto max-w-7xl scroll-mt-28 px-4 py-16 sm:px-6">
        <div className="mb-10 max-w-3xl">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-600">Subscription plans</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-neutral-950 sm:text-[2.1rem]">
            Pick the hiring capacity that fits your team
          </h2>
          <p className="mt-4 text-lg leading-8 text-neutral-600">
            Start lean, then unlock more job volume, candidate visibility, collaboration, and premium workflow controls as hiring demand grows.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {pricingPlans.map((plan) => (
            <Card
              key={plan.name}
              className={`rounded-[30px] border p-6 shadow-[0_16px_40px_rgba(15,15,15,0.05)] ${
                plan.featured
                  ? "border-neutral-950 bg-neutral-950 text-white"
                  : "border-black/8 bg-white text-neutral-950"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className={`font-mono text-[11px] uppercase tracking-[0.22em] ${plan.featured ? "text-neutral-400" : "text-neutral-500"}`}>
                    {plan.name}
                  </p>
                  <div className="mt-4 flex items-end gap-2">
                    <span className={`text-4xl font-bold tracking-[-0.05em] ${plan.featured ? "text-white" : "text-neutral-950"}`}>
                      {plan.price}
                    </span>
                    <span className={`pb-1 text-sm ${plan.featured ? "text-neutral-400" : "text-neutral-500"}`}>{plan.period}</span>
                  </div>
                </div>
                <div className={`rounded-2xl border p-3 ${plan.featured ? "border-white/12 bg-white/8" : "border-black/8 bg-neutral-100"}`}>
                  <plan.icon className={`h-5 w-5 ${plan.featured ? "text-white" : "text-neutral-950"}`} />
                </div>
              </div>

              <p className={`mt-5 text-sm leading-7 ${plan.featured ? "text-neutral-300" : "text-neutral-600"}`}>
                {plan.description}
              </p>

              <div className={`my-6 h-px w-full ${plan.featured ? "bg-white/10" : "bg-black/8"}`} />

              <div className="space-y-3">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex gap-3">
                    <CheckCircle2 className={`mt-0.5 h-4 w-4 flex-shrink-0 ${plan.featured ? "text-white" : "text-neutral-950"}`} />
                    <span className={`text-sm leading-6 ${plan.featured ? "text-neutral-200" : "text-neutral-700"}`}>{feature}</span>
                  </div>
                ))}
              </div>

              <Button
                onClick={onGetStarted}
                size="lg"
                className={`mt-8 w-full rounded-full ${
                  plan.featured
                    ? "bg-white text-neutral-950 hover:bg-neutral-100"
                    : "bg-neutral-950 text-white hover:bg-neutral-800"
                }`}
              >
                Get Started
              </Button>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <Card className="rounded-[34px] border border-black/6 bg-white/80 p-12">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-[-0.05em] text-neutral-950">
              Ready to move from vacancy posting to structured hiring?
            </h2>
            <p className="mb-8 text-lg text-neutral-600">
              Bring search, ranking, communication, and employer controls into one cleaner workflow.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Button
                onClick={onGetStarted}
                size="lg"
                className="rounded-full bg-neutral-950 text-white hover:bg-neutral-800"
              >
                Open JobBridge
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="rounded-full border-black/10 bg-white text-neutral-900 hover:bg-neutral-50"
                onClick={onGetStarted}
              >
                Create Employer Account
              </Button>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}
