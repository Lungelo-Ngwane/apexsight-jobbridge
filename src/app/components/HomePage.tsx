import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import {
  ArrowRight,
  BadgeCheck,
  Binary,
  Bot,
  Briefcase,
  Building2,
  CheckCircle2,
  CircuitBoard,
  Globe2,
  GraduationCap,
  LineChart,
  LockKeyhole,
  MessageSquareMore,
  ScanSearch,
  Sparkles,
  Users,
  Workflow,
} from "lucide-react";

interface HomePageProps {
  onSelectSkillLink: () => void;
  onSelectJobBridge: () => void;
}

const employerCapabilities = [
  "Structured search briefs with skill, location, and experience filters",
  "Ranked candidates, fit signals, and review workflows in one place",
  "Interview operations, messaging, and premium hiring controls",
];

const candidateCapabilities = [
  "Structured profiles built from CV parsing, skills, certifications, and work history",
  "Readiness, assessments, and preference data that make discovery easier",
  "Application flow, interview visibility, and matched job recommendations",
];

const operatingSystemCards = [
  {
    title: "Search and ranking engine",
    description:
      "Candidate discovery is organized around structured criteria and AI-assisted fit signals, not loose keyword matching.",
    icon: ScanSearch,
  },
  {
    title: "Recruiter execution layer",
    description:
      "The employer side is built for decisions and throughput: review queues, interviews, messaging, reports, and plan controls.",
    icon: Briefcase,
  },
  {
    title: "Verified talent data",
    description:
      "Profiles are richer than a CV upload because skills, certifications, summaries, and preferences are captured as usable data.",
    icon: BadgeCheck,
  },
];

const proofStats = [
  { value: "Structured", label: "Search, briefs, and profile data instead of loose applications" },
  { value: "Two-sided", label: "Employer and candidate journeys connected in one system" },
  { value: "Operational", label: "Messaging, reports, interviews, billing, and permissions built in" },
  { value: "AI-assisted", label: "Ranking and recommendation layers support recruiter judgment" },
];

const marketSignals = [
  { value: "01", title: "Cleaner recruiting signal", copy: "Profiles are normalized into skills, certifications, experience bands, and preferences." },
  { value: "02", title: "Faster review velocity", copy: "Hiring teams can filter, rank, shortlist, message, and schedule without jumping across tools." },
  { value: "03", title: "Sharper product split", copy: "SkillLink grows candidate quality while JobBridge turns that supply into a usable hiring market." },
];

export function HomePage({ onSelectSkillLink, onSelectJobBridge }: HomePageProps) {
  return (
    <div className="min-h-screen text-neutral-950 dark:text-white">
      <section className="relative overflow-hidden border-b border-black/5 dark:border-white/10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(17,17,17,0.05),_transparent_32%),radial-gradient(circle_at_85%_12%,_rgba(0,0,0,0.06),_transparent_26%)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.06),_transparent_24%),radial-gradient(circle_at_85%_12%,_rgba(255,255,255,0.04),_transparent_20%)]" />
        <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-14 sm:px-6 lg:px-8 lg:pb-20 lg:pt-16">
          <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-black/8 bg-white/80 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-neutral-700 shadow-sm backdrop-blur dark:border-white/10 dark:bg-neutral-900/80 dark:text-neutral-300">
                <Sparkles className="h-4 w-4" />
                ApexSight hiring & talent infrastructure
              </div>

              <h1 className="mt-6 max-w-4xl text-4xl font-extrabold leading-[0.98] tracking-[-0.06em] text-neutral-950 dark:text-white sm:text-5xl lg:text-[4.6rem]">
                A cleaner way to
                <span className="block text-neutral-500 dark:text-neutral-400">
                  structure talent, search, and hiring decisions
                </span>
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-7 text-neutral-600 dark:text-neutral-300 sm:text-[1.05rem]">
                ApexSight combines candidate data, structured job requirements, AI-assisted ranking,
                interviews, messaging, and hiring operations in one product system. The result is a
                market-style experience that feels direct, modern, and easier to trust.
              </p>

              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <Button
                  onClick={onSelectJobBridge}
                  size="lg"
                  className="h-14 rounded-full bg-neutral-950 px-8 text-base font-semibold text-white shadow-[0_18px_48px_rgba(15,15,15,0.18)] hover:bg-neutral-800"
                >
                  Explore JobBridge
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button
                  onClick={onSelectSkillLink}
                  size="lg"
                  variant="outline"
                  className="h-14 rounded-full border-black/10 bg-white/80 px-8 text-base font-semibold text-neutral-900 shadow-sm hover:bg-white dark:border-white/12 dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800"
                >
                  Explore SkillLink
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>

              <div className="mt-10 grid gap-3 sm:grid-cols-3">
                {[
                  "Structured profiles, not static resumes",
                  "Recruiter workflow with AI-assisted review",
                  "Two products connected by one talent data layer",
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-start gap-3 rounded-3xl border border-black/6 bg-white/78 p-4 shadow-[0_12px_30px_rgba(15,15,15,0.05)] backdrop-blur dark:border-white/10 dark:bg-neutral-900/90"
                  >
                    <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-neutral-950 dark:text-white" />
                    <p className="text-sm leading-6 text-neutral-700 dark:text-neutral-300">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <Card className="overflow-hidden rounded-[34px] border border-black/6 bg-[#131313] text-white shadow-[0_32px_90px_rgba(15,15,15,0.22)]">
                <div className="border-b border-white/10 px-6 py-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-neutral-400">Live market view</p>
                      <h2 className="mt-2 text-2xl font-semibold text-white">Hiring intelligence, compressed into one surface</h2>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <Bot className="h-7 w-7" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 p-6">
                  <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="rounded-2xl border border-white/10 bg-white/10 p-2 text-white">
                          <Binary className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-neutral-400">Ranking layer</p>
                          <p className="text-lg font-semibold text-white">Structured fit, AI support, human decision</p>
                        </div>
                      </div>
                      <LineChart className="h-5 w-5 text-neutral-400" />
                    </div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      {[
                        { label: "Match confidence", value: "91%", icon: CircuitBoard },
                        { label: "Review status", value: "24 shortlisted", icon: Workflow },
                        { label: "Response time", value: "< 2 days", icon: MessageSquareMore },
                      ].map((item) => (
                        <div key={item.label} className="rounded-2xl border border-white/8 bg-black/20 p-4">
                          <item.icon className="h-4 w-4 text-[#f5f5f7]" />
                          <p className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-white">{item.value}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-neutral-400">{item.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-white/10 bg-[#f5f5f7] p-5 text-neutral-950 dark:border-white/10 dark:bg-neutral-900 dark:text-white">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-neutral-600 dark:text-neutral-400">System modules</p>
                        <p className="mt-2 text-xl font-semibold text-neutral-950 dark:text-white">Each core hiring function lives in the product, not in disconnected tools</p>
                      </div>
                      <LockKeyhole className="h-6 w-6 text-neutral-700 dark:text-neutral-300" />
                    </div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      {[
                        { label: "Candidate intelligence", icon: Users },
                        { label: "Search and ranking", icon: Globe2 },
                        { label: "Billing and controls", icon: LockKeyhole },
                      ].map((item) => (
                        <div key={item.label} className="rounded-2xl border border-black/8 bg-white/80 p-4 dark:border-white/10 dark:bg-neutral-950">
                          <item.icon className="h-5 w-5 text-neutral-900 dark:text-white" />
                          <p className="mt-3 text-sm font-medium text-neutral-900 dark:text-white">{item.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-4">
          {proofStats.map((stat) => (
            <Card key={stat.label} className="rounded-[28px] border border-black/6 bg-white/75 p-6 shadow-[0_12px_30px_rgba(15,15,15,0.04)] dark:border-white/10 dark:bg-neutral-900">
              <p className="text-3xl font-semibold tracking-[-0.05em] text-neutral-950 dark:text-white">{stat.value}</p>
              <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{stat.label}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-10 grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="max-w-3xl">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-600 dark:text-neutral-400">Why this product reads closer to a market</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-neutral-950 dark:text-white sm:text-[2.1rem]">
              One infrastructure. Two front doors. One talent system.
            </h2>
            <p className="mt-4 text-lg leading-8 text-neutral-600 dark:text-neutral-300">
              SkillLink improves candidate quality and completeness. JobBridge turns that supply into a usable hiring workflow. Together they feel more like a structured market than a typical job board.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {marketSignals.map((item) => (
              <Card key={item.title} className="rounded-[28px] border border-black/6 bg-[#f8f8fa] p-6 dark:border-white/10 dark:bg-neutral-900">
                <p className="font-mono text-sm text-neutral-500 dark:text-neutral-400">{item.value}</p>
                <h3 className="mt-6 text-xl font-semibold text-neutral-950 dark:text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-neutral-600 dark:text-neutral-300">{item.copy}</p>
              </Card>
            ))}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="rounded-[32px] border border-black/6 bg-white/80 p-8 shadow-[0_16px_42px_rgba(15,15,15,0.05)] dark:border-white/10 dark:bg-neutral-900">
            <div className="flex items-center gap-4">
              <div className="rounded-2xl bg-neutral-950 p-3 text-white dark:bg-white dark:text-neutral-950">
                <GraduationCap className="h-7 w-7" />
              </div>
              <div>
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">Candidate product</p>
                <h3 className="mt-1 text-[1.75rem] font-semibold tracking-[-0.04em] text-neutral-950 dark:text-white">SkillLink</h3>
              </div>
            </div>
            <p className="mt-6 text-base leading-7 text-neutral-600 dark:text-neutral-300">
              Candidates build profiles that are easier to search and evaluate because the platform captures structured evidence instead of leaving everything inside a CV file.
            </p>
            <div className="mt-6 space-y-3">
              {candidateCapabilities.map((item) => (
                <div key={item} className="flex gap-3 rounded-2xl border border-black/6 bg-[#fbfbfc] p-4 dark:border-white/10 dark:bg-neutral-950">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-neutral-950 dark:text-white" />
                  <p className="text-sm leading-6 text-neutral-700 dark:text-neutral-300">{item}</p>
                </div>
              ))}
            </div>
            <Button
              onClick={onSelectSkillLink}
              size="lg"
              className="mt-8 h-14 rounded-full bg-neutral-950 px-7 text-base font-semibold text-white hover:bg-neutral-800"
            >
              Enter SkillLink
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Card>

          <Card className="rounded-[32px] border border-black/6 bg-[#131313] p-8 text-white shadow-[0_24px_70px_rgba(15,15,15,0.18)]">
            <div className="flex items-center gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-white">
                <Building2 className="h-7 w-7" />
              </div>
              <div>
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">Employer product</p>
                <h3 className="mt-1 text-[1.75rem] font-semibold tracking-[-0.04em]">JobBridge</h3>
              </div>
            </div>
            <p className="mt-6 text-base leading-7 text-neutral-300">
              Employers get a more disciplined workflow: structured search inputs, ranked candidates, interview operations, reporting, and monetized premium features in one environment.
            </p>
            <div className="mt-6 space-y-3">
              {employerCapabilities.map((item) => (
                <div key={item} className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#f5f5f7]" />
                  <p className="text-sm leading-6 text-neutral-200">{item}</p>
                </div>
              ))}
            </div>
            <Button
              onClick={onSelectJobBridge}
              size="lg"
              className="mt-8 h-14 rounded-full border border-white/10 bg-white text-base font-semibold text-neutral-950 hover:bg-neutral-200 dark:bg-neutral-100 dark:text-neutral-950 dark:hover:bg-white"
            >
              Enter JobBridge
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Card>
        </div>
      </section>

      <section className="border-y border-black/5 bg-white/50 dark:border-white/10 dark:bg-neutral-950/30">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mb-10 max-w-3xl">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-600 dark:text-neutral-400">Platform capabilities</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-neutral-950 dark:text-white sm:text-[2.1rem]">
              Built like an operating layer for recruiting, not a flat listing site
            </h2>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {operatingSystemCards.map((card) => (
              <Card key={card.title} className="rounded-[30px] border border-black/6 bg-white p-7 shadow-[0_14px_34px_rgba(15,15,15,0.04)] dark:border-white/10 dark:bg-neutral-900">
                <div className="inline-flex rounded-2xl bg-neutral-950 p-3 text-white dark:bg-white dark:text-neutral-950">
                  <card.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-2xl font-semibold tracking-[-0.04em] text-neutral-950 dark:text-white">{card.title}</h3>
                <p className="mt-4 text-sm leading-7 text-neutral-600 dark:text-neutral-300">{card.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <Card className="overflow-hidden rounded-[34px] border border-black/6 bg-[#111111] p-10 text-white shadow-[0_32px_90px_rgba(15,15,15,0.22)] sm:p-12">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
            <div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.24em] text-neutral-400">Launch the right side of the system</p>
              <h2 className="mt-4 max-w-3xl text-3xl font-semibold tracking-[-0.05em] sm:text-[2.6rem]">
                Choose the experience that matches where you enter the talent market
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-8 text-neutral-300">
                Candidates build verified profiles and discover matched roles. Employers run structured hiring with better signal, faster review, and clearer decision support.
              </p>
              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <Button
                  onClick={onSelectSkillLink}
                  size="lg"
                  className="h-14 rounded-full bg-white px-8 text-base font-semibold text-neutral-950 hover:bg-neutral-100"
                >
                  Candidate journey
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button
                  onClick={onSelectJobBridge}
                  size="lg"
                  variant="outline"
                  className="h-14 rounded-full border-white/20 bg-white/5 px-8 text-base font-semibold text-white hover:bg-white/10"
                >
                  Employer journey
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </div>

            <div className="grid gap-3">
              {[
                { icon: Users, label: "Candidate profile intelligence" },
                { icon: MessageSquareMore, label: "Messaging and interview workflow" },
                { icon: Globe2, label: "Search, ranking, and access controls" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <item.icon className="h-5 w-5 text-[#f5f5f7]" />
                  <span className="text-sm font-medium text-white">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}
