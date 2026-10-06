import { AlertDialog,AlertDialogAction,AlertDialogCancel,AlertDialogContent,AlertDialogDescription,AlertDialogFooter,AlertDialogHeader,AlertDialogTitle } from "@/app/components/ui/alert-dialog";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { ChartContainer,ChartTooltip,ChartTooltipContent } from "@/app/components/ui/chart";
import { CircularLoader } from "@/app/components/ui/circular-loader";
import { Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle } from "@/app/components/ui/dialog";
import { FeedbackDialog,useFeedbackDialog } from "@/app/components/ui/feedback-dialog";
import { Input } from "@/app/components/ui/input";
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from "@/app/components/ui/select";
import { Table,TableBody,TableCell,TableHead,TableHeader,TableRow } from "@/app/components/ui/table";
import { Tabs,TabsContent,TabsList,TabsTrigger } from "@/app/components/ui/tabs";
import { useAuth } from "@/app/context/AuthContext";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { addAdminUser,type AdminAuditLogRecord,type AdminDashboardSnapshot,type AdminPendingPaymentItem,type AdminRecentCandidate,type AdminRecentEmployer,type AdminRecentInvoice,type AdminStalledJobItem,type AdminUserRecord,type AdminWebhookQueueItem,getAdminDashboardSnapshot,listAdminAuditLogs,listAdminUsers,logAdminAction,removeAdminUser,retryAdminWebhookEvent,sendCandidateWelcomeEmail } from "@/lib/admin";
import { Activity,AlertTriangle,Briefcase,CreditCard,Download,Eye,RefreshCw,RotateCcw,Shield,TrendingUp,Users } from "lucide-react";
import { useEffect,useMemo,useState } from "react";
import { useNavigate } from "react-router-dom";
import { Area,AreaChart,Bar,BarChart,CartesianGrid,XAxis,YAxis } from "recharts";

const RANGE_OPTIONS = [{ label: "Last 7 days", value: "7" }, { label: "Last 30 days", value: "30" }, { label: "Last 90 days", value: "90" }] as const;
type DetailItem =
  | { kind: "failed-webhook"; title: string; data: AdminWebhookQueueItem }
  | { kind: "pending-payment"; title: string; data: AdminPendingPaymentItem }
  | { kind: "stalled-job"; title: string; data: AdminStalledJobItem }
  | { kind: "employer"; title: string; data: AdminRecentEmployer }
  | { kind: "candidate"; title: string; data: AdminRecentCandidate }
  | { kind: "invoice"; title: string; data: AdminRecentInvoice };

const formatZarFromKobo = (value: number) => new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", minimumFractionDigits: 2 }).format((value ?? 0) / 100);
const formatActivityTime = (value: string) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? value || "Unknown" : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" }); };
const formatShortDate = (value: string) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString([], { month: "short", day: "numeric" }); };
const prettifyToken = (value: string) => value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

function MetricCard({ label, value, detail, icon: Icon }: { label: string; value: string | number; detail: string; icon: typeof Users }) {
  return <Card className="border-gray-200 p-5 dark:border-white/10 dark:bg-neutral-900"><div className="flex items-start justify-between gap-3"><div><p className="text-sm text-gray-500 dark:text-gray-400">{label}</p><p className="mt-3 text-3xl font-bold text-gray-900 dark:text-white">{value}</p><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{detail}</p></div><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-neutral-950 dark:text-blue-300"><Icon className="h-5 w-5" /></div></div></Card>;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return <div className="grid gap-1 border-b border-gray-200 py-3 last:border-b-0 dark:border-white/10"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">{label}</p><p className="break-words text-sm text-gray-900 dark:text-white">{value || "Not available"}</p></div>;
}

function DetailDialog({ item, open, onOpenChange }: { item: DetailItem | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl dark:border-white/10 dark:bg-neutral-900">
        <DialogHeader>
          <DialogTitle className="text-gray-900 dark:text-white">{item?.title ?? "Details"}</DialogTitle>
          <DialogDescription className="text-gray-600 dark:text-gray-400">Internal record details for faster support and operational follow-up.</DialogDescription>
        </DialogHeader>
        {item ? <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 dark:border-white/10 dark:bg-neutral-950">
          {item.kind === "failed-webhook" && <><DetailRow label="Event" value={item.data.eventName} /><DetailRow label="Reference" value={item.data.reference || "No reference"} /><DetailRow label="Status" value={prettifyToken(item.data.status)} /><DetailRow label="Received" value={formatActivityTime(item.data.receivedAt)} /><DetailRow label="Last error" value={item.data.lastError || "No error message captured"} /><DetailRow label="Event ID" value={item.data.id} /></>}
          {item.kind === "pending-payment" && <><DetailRow label="Invoice number" value={item.data.invoiceNumber} /><DetailRow label="Employer" value={item.data.employerName} /><DetailRow label="Amount" value={formatZarFromKobo(item.data.totalKobo)} /><DetailRow label="Issued" value={formatActivityTime(item.data.issuedAt)} /><DetailRow label="Invoice ID" value={item.data.invoiceId} /></>}
          {item.kind === "stalled-job" && <><DetailRow label="Job title" value={item.data.title} /><DetailRow label="Employer" value={item.data.employerName} /><DetailRow label="Applicants" value={String(item.data.applicants)} /><DetailRow label="Shortlisted" value={String(item.data.shortlisted)} /><DetailRow label="Created" value={formatActivityTime(item.data.createdAt)} /><DetailRow label="Job ID" value={item.data.jobId} /></>}
          {item.kind === "employer" && <><DetailRow label="Company" value={item.data.companyName} /><DetailRow label="Email" value={item.data.email} /><DetailRow label="Created" value={formatActivityTime(item.data.createdAt)} /><DetailRow label="User ID" value={item.data.userId} /></>}
          {item.kind === "candidate" && <><DetailRow label="Full name" value={item.data.fullName} /><DetailRow label="Email" value={item.data.email} /><DetailRow label="Created" value={formatActivityTime(item.data.createdAt)} /><DetailRow label="User ID" value={item.data.userId} /></>}
          {item.kind === "invoice" && <><DetailRow label="Invoice number" value={item.data.invoiceNumber} /><DetailRow label="Employer" value={item.data.employerName} /><DetailRow label="Kind" value={prettifyToken(item.data.kind)} /><DetailRow label="Status" value={prettifyToken(item.data.status)} /><DetailRow label="Total" value={formatZarFromKobo(item.data.totalKobo)} /><DetailRow label="Issued" value={formatActivityTime(item.data.issuedAt)} /><DetailRow label="Invoice ID" value={item.data.invoiceId} /></>}
        </div> : null}
      </DialogContent>
    </Dialog>
  );
}

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, loading: accessLoading } = useAdminAccess();
  const [rangeDays, setRangeDays] = useState("30");
  const [snapshot, setSnapshot] = useState<AdminDashboardSnapshot | null>(null);
  const [adminUsers, setAdminUsers] = useState<AdminUserRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [managementLoading, setManagementLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<AdminUserRecord | null>(null);
  const [newAdminUserId, setNewAdminUserId] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminNotes, setNewAdminNotes] = useState("");
  const [detailItem, setDetailItem] = useState<DetailItem | null>(null);
  const [retryingWebhookId, setRetryingWebhookId] = useState<string | null>(null);
  const [sendingWelcomeUserId, setSendingWelcomeUserId] = useState<string | null>(null);
  const [sentWelcomeUserIds, setSentWelcomeUserIds] = useState<string[]>([]);
  const { feedback, showFeedback, setFeedbackOpen } = useFeedbackDialog();
  const selectedDays = Number(rangeDays);

  async function loadSnapshot(days = selectedDays, showRefresh = false) {
    try { if (showRefresh) setRefreshing(true); else setLoading(true); setSnapshot(await getAdminDashboardSnapshot(days)); }
    catch (error) { console.error("Failed to load admin dashboard snapshot", error); setSnapshot(null); }
    finally { setLoading(false); setRefreshing(false); }
  }

  async function loadManagementData() {
    try { setManagementLoading(true); const [users, logs] = await Promise.all([listAdminUsers(), listAdminAuditLogs()]); setAdminUsers(users); setAuditLogs(logs); }
    catch (error) { console.error("Failed to load admin management data", error); setAdminUsers([]); setAuditLogs([]); }
    finally { setManagementLoading(false); }
  }

  useEffect(() => {
    if (accessLoading) return;
    if (!isAdmin) { setLoading(false); setSnapshot(null); return; }
    void loadSnapshot(Number(rangeDays));
    void loadManagementData();
  }, [accessLoading, isAdmin, rangeDays]);

  async function handleAddAdmin() {
    if (!newAdminUserId.trim()) { showFeedback("Missing user ID", "Enter the auth user ID for the admin you want to allow."); return; }
    try { setSubmitting(true); await addAdminUser({ userId: newAdminUserId, email: newAdminEmail, notes: newAdminNotes }); setNewAdminUserId(""); setNewAdminEmail(""); setNewAdminNotes(""); await loadManagementData(); showFeedback("Admin added", "The user can now sign in and access the admin dashboard."); }
    catch (error: any) { showFeedback("Unable to add admin", String(error?.message ?? "Please try again.")); }
    finally { setSubmitting(false); }
  }

  async function handleRemoveAdmin() {
    if (!removeTarget) return;
    try { setSubmitting(true); await removeAdminUser(removeTarget.userId); setRemoveTarget(null); await loadManagementData(); showFeedback("Admin removed", "The user no longer has admin dashboard access."); }
    catch (error: any) { showFeedback("Unable to remove admin", String(error?.message ?? "Please try again.")); }
    finally { setSubmitting(false); }
  }

  async function handleRetryWebhook(eventId: string) {
    try { setRetryingWebhookId(eventId); await retryAdminWebhookEvent(eventId); await loadSnapshot(selectedDays, true); await loadManagementData(); showFeedback("Webhook retried", "The event was replayed and the queue has been refreshed."); }
    catch (error: any) { showFeedback("Retry failed", String(error?.message ?? "Please try again.")); }
    finally { setRetryingWebhookId(null); }
  }

  async function handleSendCandidateWelcome(candidate: AdminRecentCandidate) {
    try {
      setSendingWelcomeUserId(candidate.userId);
      const result = await sendCandidateWelcomeEmail(candidate.userId);
      setSentWelcomeUserIds((prev) => (prev.includes(candidate.userId) ? prev : [...prev, candidate.userId]));
      showFeedback(
        result?.skipped ? "Welcome already sent" : "Welcome email sent",
        result?.skipped
          ? `${candidate.fullName || candidate.email} already received the welcome email.`
          : `The welcome email was sent to ${candidate.email}.`,
      );
    } catch (error: any) {
      showFeedback("Unable to send welcome email", String(error?.message ?? "Please try again."));
    } finally {
      setSendingWelcomeUserId(null);
    }
  }

  function openEntityPage(kind: "employer" | "candidate" | "job" | "invoice", id: string) {
    void logAdminAction({
      action: "admin_entity_opened",
      details: { entityKind: kind, entityId: id, source: "dashboard" },
    }).catch((error) => console.error("Failed to log admin entity open", error));
    navigate(`/admin/entities/${kind}/${id}`);
  }

  const metrics = snapshot?.metrics;
  const trendData = useMemo(() => (snapshot?.trends ?? []).map((item) => ({ ...item, label: formatShortDate(item.date), revenue: Number((item.revenueKobo / 100).toFixed(2)) })), [snapshot?.trends]);

  if (!user) return <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4"><Card className="w-full max-w-xl border-gray-200 p-8 text-center dark:border-white/10 dark:bg-neutral-900"><h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin dashboard</h1><p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Sign in with an authorized admin account to monitor the platform.</p></Card></div>;
  if (accessLoading || loading) return <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4"><CircularLoader size="md" label="Loading admin dashboard..." /></div>;
  if (!isAdmin) return <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4"><Card className="w-full max-w-xl border-red-200 p-8 text-center dark:border-red-500/20 dark:bg-neutral-900"><Shield className="mx-auto h-10 w-10 text-red-600 dark:text-red-400" /><h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-white">Access denied</h1><p className="mt-2 text-sm text-gray-600 dark:text-gray-400">This route is restricted to users listed in `admin_users`.</p></Card></div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300">Internal</p><h1 className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1><p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Monitor growth, billing, operational queues, and platform health in one place.</p></div>
          <div className="flex flex-wrap items-center gap-3"><Select value={rangeDays} onValueChange={setRangeDays}><SelectTrigger className="w-[160px] dark:border-white/10 dark:bg-neutral-900 dark:text-white"><SelectValue placeholder="Range" /></SelectTrigger><SelectContent>{RANGE_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select><Button variant="outline" className="dark:border-white/10 dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800" onClick={() => void loadSnapshot(selectedDays, true)} disabled={refreshing}><RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />{refreshing ? "Refreshing..." : "Refresh"}</Button></div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics && <><MetricCard label="Signups" value={metrics.signupsInRange} detail={`${metrics.days} day range`} icon={Users} /><MetricCard label="Applications" value={metrics.applicationsInRange} detail={`${metrics.days} day range`} icon={Activity} /><MetricCard label="Revenue" value={formatZarFromKobo(metrics.paidRevenueInRangeKobo)} detail={`${metrics.days} day paid`} icon={CreditCard} /><MetricCard label="Open jobs" value={metrics.openJobs} detail={`${metrics.totalEmployers} employers`} icon={Briefcase} /><MetricCard label="Pending payments" value={metrics.pendingPayments} detail="Needs reconciliation" icon={AlertTriangle} /><MetricCard label="Failed webhooks" value={metrics.failedWebhooks} detail={`${metrics.unreadWebhookBacklog} waiting`} icon={AlertTriangle} /><MetricCard label="Messages" value={metrics.messagesLast7Days} detail="Last 7 days" icon={Activity} /><MetricCard label="Active subscriptions" value={metrics.activeSubscriptions} detail={`${metrics.paidInvoices} paid invoices`} icon={TrendingUp} /></>}
        </div>

        {metrics ? (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Admin actions" value={metrics.adminActionsLast24h} detail="Last 24 hours" icon={Shield} />
            <MetricCard label="Webhook retries" value={metrics.adminRetriesLast24h} detail="Last 24 hours" icon={RotateCcw} />
            <MetricCard label="Invoice downloads" value={metrics.invoiceDownloadsLast24h} detail="Last 24 hours" icon={Download} />
            <MetricCard label="Active admins" value={metrics.activeAdminsLast24h} detail="Distinct actors in 24h" icon={Users} />
          </div>
        ) : null}

        <div className="mt-8 grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
          <Card className="border-gray-200 p-6 dark:border-white/10 dark:bg-neutral-900"><div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold text-gray-900 dark:text-white">Growth trends</h2><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Signups and applications over time.</p></div><Badge variant="secondary">{selectedDays} days</Badge></div><ChartContainer className="mt-5 h-[260px] w-full" config={{ signups: { label: "Signups", color: "#2563eb" }, applications: { label: "Applications", color: "#10b981" } }}><AreaChart data={trendData}><CartesianGrid vertical={false} /><XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={20} /><YAxis tickLine={false} axisLine={false} /><ChartTooltip content={<ChartTooltipContent indicator="line" />} /><Area type="monotone" dataKey="signups" stroke="var(--color-signups)" fill="var(--color-signups)" fillOpacity={0.15} /><Area type="monotone" dataKey="applications" stroke="var(--color-applications)" fill="var(--color-applications)" fillOpacity={0.12} /></AreaChart></ChartContainer></Card>
          <Card className="border-gray-200 p-6 dark:border-white/10 dark:bg-neutral-900"><h2 className="text-lg font-semibold text-gray-900 dark:text-white">Revenue and failures</h2><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Paid revenue and failed webhook volume.</p><ChartContainer className="mt-5 h-[260px] w-full" config={{ revenue: { label: "Revenue (ZAR)", color: "#7c3aed" }, failedWebhooks: { label: "Failed webhooks", color: "#dc2626" } }}><BarChart data={trendData}><CartesianGrid vertical={false} /><XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={20} /><YAxis yAxisId="left" tickLine={false} axisLine={false} /><YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} /><ChartTooltip content={<ChartTooltipContent />} /><Bar yAxisId="left" dataKey="revenue" fill="var(--color-revenue)" radius={[6, 6, 0, 0]} /><Bar yAxisId="right" dataKey="failedWebhooks" fill="var(--color-failedWebhooks)" radius={[6, 6, 0, 0]} /></BarChart></ChartContainer></Card>
        </div>

        <div className="mt-8 grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
          <Card className="border-gray-200 p-6 dark:border-white/10 dark:bg-neutral-900"><h2 className="text-lg font-semibold text-gray-900 dark:text-white">Operational queues</h2><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Items most likely to need action.</p><Tabs defaultValue="failed-webhooks" className="mt-5"><TabsList><TabsTrigger value="failed-webhooks">Failed Webhooks</TabsTrigger><TabsTrigger value="pending-payments">Pending Payments</TabsTrigger><TabsTrigger value="stalled-jobs">Stalled Jobs</TabsTrigger></TabsList>
            <TabsContent value="failed-webhooks" className="mt-4"><div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">{(snapshot?.queues.failedWebhooks ?? []).length === 0 ? <p className="text-sm text-gray-500 dark:text-gray-400">No failed webhooks right now.</p> : snapshot?.queues.failedWebhooks.map((item) => <div key={item.id} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-neutral-950"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium text-gray-900 dark:text-white">{item.eventName}</p><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{item.reference || "No reference"} â€¢ {formatActivityTime(item.receivedAt)}</p></div><Badge variant="destructive">{prettifyToken(item.status)}</Badge></div><p className="mt-2 text-xs text-red-600 dark:text-red-400">{item.lastError || "No error message captured"}</p><div className="mt-4 flex flex-wrap gap-2"><Button size="sm" onClick={() => void handleRetryWebhook(item.id)} disabled={retryingWebhookId === item.id}><RotateCcw className={`mr-2 h-4 w-4 ${retryingWebhookId === item.id ? "animate-spin" : ""}`} />{retryingWebhookId === item.id ? "Retrying..." : "Retry webhook"}</Button><Button size="sm" variant="outline" className="dark:border-white/10 dark:bg-transparent dark:text-white dark:hover:bg-neutral-800" onClick={() => setDetailItem({ kind: "failed-webhook", title: item.eventName, data: item })}><Eye className="mr-2 h-4 w-4" />View details</Button></div></div>)}</div></TabsContent>
            <TabsContent value="pending-payments" className="mt-4"><div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">{(snapshot?.queues.pendingPayments ?? []).length === 0 ? <p className="text-sm text-gray-500 dark:text-gray-400">No pending payment queue right now.</p> : snapshot?.queues.pendingPayments.map((item) => <div key={item.invoiceId} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-neutral-950"><div className="flex items-center justify-between gap-3"><p className="font-medium text-gray-900 dark:text-white">{item.employerName}</p><p className="text-sm font-semibold text-gray-900 dark:text-white">{formatZarFromKobo(item.totalKobo)}</p></div><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{item.invoiceNumber} â€¢ {formatActivityTime(item.issuedAt)}</p><div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="outline" className="dark:border-white/10 dark:bg-transparent dark:text-white dark:hover:bg-neutral-800" onClick={() => setDetailItem({ kind: "pending-payment", title: item.invoiceNumber, data: item })}><Eye className="mr-2 h-4 w-4" />View details</Button><Button size="sm" onClick={() => openEntityPage("invoice", item.invoiceId)}>Open page</Button></div></div>)}</div></TabsContent>
            <TabsContent value="stalled-jobs" className="mt-4"><div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">{(snapshot?.queues.stalledJobs ?? []).length === 0 ? <p className="text-sm text-gray-500 dark:text-gray-400">No stalled jobs detected right now.</p> : snapshot?.queues.stalledJobs.map((item) => <div key={item.jobId} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-neutral-950"><p className="font-medium text-gray-900 dark:text-white">{item.title}</p><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{item.employerName} â€¢ {item.applicants} applicants â€¢ {item.shortlisted} shortlisted</p><div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="outline" className="dark:border-white/10 dark:bg-transparent dark:text-white dark:hover:bg-neutral-800" onClick={() => setDetailItem({ kind: "stalled-job", title: item.title, data: item })}><Eye className="mr-2 h-4 w-4" />View details</Button><Button size="sm" onClick={() => openEntityPage("job", item.jobId)}>Open page</Button></div></div>)}</div></TabsContent>
          </Tabs></Card>

          <Card className="border-gray-200 p-6 dark:border-white/10 dark:bg-neutral-900"><h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent signups and billing</h2><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">New employers, candidates, and invoices in range.</p><Tabs defaultValue="employers" className="mt-5"><TabsList><TabsTrigger value="employers">Employers</TabsTrigger><TabsTrigger value="candidates">Candidates</TabsTrigger><TabsTrigger value="invoices">Invoices</TabsTrigger></TabsList>
            <TabsContent value="employers" className="mt-4"><div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">{(snapshot?.recentEmployers ?? []).length === 0 ? <p className="text-sm text-gray-500 dark:text-gray-400">No new employers in this range.</p> : snapshot?.recentEmployers.map((item) => <div key={item.userId} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-neutral-950"><p className="font-medium text-gray-900 dark:text-white">{item.companyName}</p><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{item.email}</p><div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="outline" className="dark:border-white/10 dark:bg-transparent dark:text-white dark:hover:bg-neutral-800" onClick={() => setDetailItem({ kind: "employer", title: item.companyName, data: item })}><Eye className="mr-2 h-4 w-4" />View details</Button><Button size="sm" onClick={() => openEntityPage("employer", item.userId)}>Open page</Button></div></div>)}</div></TabsContent>
            <TabsContent value="candidates" className="mt-4"><div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">{(snapshot?.recentCandidates ?? []).length === 0 ? <p className="text-sm text-gray-500 dark:text-gray-400">No new candidates in this range.</p> : snapshot?.recentCandidates.map((item) => <div key={item.userId} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-neutral-950"><p className="font-medium text-gray-900 dark:text-white">{item.fullName}</p><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{item.email}</p><div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="outline" className="dark:border-white/10 dark:bg-transparent dark:text-white dark:hover:bg-neutral-800" onClick={() => setDetailItem({ kind: "candidate", title: item.fullName, data: item })}><Eye className="mr-2 h-4 w-4" />View details</Button><Button size="sm" variant="outline" className="dark:border-white/10 dark:bg-transparent dark:text-white dark:hover:bg-neutral-800" onClick={() => void handleSendCandidateWelcome(item)} disabled={sendingWelcomeUserId === item.userId || sentWelcomeUserIds.includes(item.userId)}>{sendingWelcomeUserId === item.userId ? "Sending..." : sentWelcomeUserIds.includes(item.userId) ? "Welcome sent" : "Send welcome"}</Button><Button size="sm" onClick={() => openEntityPage("candidate", item.userId)}>Open page</Button></div></div>)}</div></TabsContent>
            <TabsContent value="invoices" className="mt-4"><div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">{(snapshot?.recentInvoices ?? []).length === 0 ? <p className="text-sm text-gray-500 dark:text-gray-400">No invoices in this range.</p> : snapshot?.recentInvoices.map((item) => <div key={item.invoiceId} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-neutral-950"><div className="flex items-center justify-between gap-3"><p className="font-medium text-gray-900 dark:text-white">{item.invoiceNumber}</p><Badge variant={item.status === "paid" ? "success" : item.status === "failed" ? "destructive" : "secondary"}>{prettifyToken(item.status)}</Badge></div><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{item.employerName} â€¢ {prettifyToken(item.kind)}</p><div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="outline" className="dark:border-white/10 dark:bg-transparent dark:text-white dark:hover:bg-neutral-800" onClick={() => setDetailItem({ kind: "invoice", title: item.invoiceNumber, data: item })}><Eye className="mr-2 h-4 w-4" />View details</Button><Button size="sm" onClick={() => openEntityPage("invoice", item.invoiceId)}>Open page</Button></div></div>)}</div></TabsContent>
          </Tabs></Card>
        </div>

        <div className="mt-8 grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
          <Card className="border-gray-200 p-6 dark:border-white/10 dark:bg-neutral-900"><div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-gray-900 dark:text-white">Admin access</h2><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage the internal allowlist.</p></div><Badge variant="secondary">{adminUsers.length} admins</Badge></div><div className="mt-5 grid gap-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 dark:border-white/10 dark:bg-neutral-950"><Input placeholder="Auth user ID" value={newAdminUserId} onChange={(event) => setNewAdminUserId(event.target.value)} disabled={submitting} /><Input placeholder="Email (optional)" value={newAdminEmail} onChange={(event) => setNewAdminEmail(event.target.value)} disabled={submitting} /><Input placeholder="Notes (optional)" value={newAdminNotes} onChange={(event) => setNewAdminNotes(event.target.value)} disabled={submitting} /><div className="flex justify-end"><Button onClick={() => void handleAddAdmin()} disabled={submitting || !newAdminUserId.trim()}>{submitting ? "Saving..." : "Add Admin"}</Button></div></div><div className="mt-5"><Table><TableHeader><TableRow><TableHead>Email</TableHead><TableHead>Notes</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader><TableBody>{managementLoading ? <TableRow><TableCell colSpan={3}><CircularLoader size="sm" label="Loading admins..." /></TableCell></TableRow> : adminUsers.length === 0 ? <TableRow><TableCell colSpan={3} className="text-sm text-gray-500 dark:text-gray-400">No admins configured yet.</TableCell></TableRow> : adminUsers.map((adminUser) => <TableRow key={adminUser.userId}><TableCell className="max-w-[260px] whitespace-normal"><p className="font-medium text-gray-900 dark:text-white">{adminUser.email || adminUser.userId}</p><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{adminUser.userId}</p></TableCell><TableCell className="text-sm text-gray-600 dark:text-gray-400">{adminUser.notes || "No notes"}</TableCell><TableCell className="text-right">{adminUser.isCurrentUser ? <Badge variant="outline">You</Badge> : <Button variant="outline" size="sm" className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setRemoveTarget(adminUser)}>Remove</Button>}</TableCell></TableRow>)}</TableBody></Table></div></Card>
          <Card className="border-gray-200 p-6 dark:border-white/10 dark:bg-neutral-900"><h2 className="text-lg font-semibold text-gray-900 dark:text-white">Admin audit log</h2><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Trace access changes and operational admin actions.</p><div className="mt-5 max-h-[560px] space-y-3 overflow-y-auto pr-1">{managementLoading ? <CircularLoader size="sm" label="Loading audit log..." /> : auditLogs.length === 0 ? <p className="text-sm text-gray-500 dark:text-gray-400">No admin actions recorded yet.</p> : auditLogs.map((log) => <div key={log.id} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-neutral-950"><div className="flex items-center justify-between gap-3"><Badge variant="outline">{prettifyToken(log.action)}</Badge><span className="text-xs text-gray-500 dark:text-gray-400">{formatActivityTime(log.createdAt)}</span></div><p className="mt-3 text-sm font-medium text-gray-900 dark:text-white">{log.actorEmail}</p><p className="mt-1 text-xs text-gray-600 dark:text-gray-400">Target: {log.targetEmail || log.targetUserId || "Unknown"}</p>{Object.keys(log.details ?? {}).length > 0 ? <pre className="mt-3 overflow-x-auto rounded-lg bg-gray-50 p-3 text-[11px] text-gray-600 dark:bg-neutral-950 dark:text-gray-300">{JSON.stringify(log.details, null, 2)}</pre> : null}</div>)}</div></Card>
        </div>
      </div>

      <DetailDialog item={detailItem} open={Boolean(detailItem)} onOpenChange={(open) => !open && setDetailItem(null)} />
      <FeedbackDialog open={feedback.open} title={feedback.title} description={feedback.description} onOpenChange={setFeedbackOpen} />
      <AlertDialog open={Boolean(removeTarget)} onOpenChange={(open) => !open && setRemoveTarget(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remove admin access?</AlertDialogTitle><AlertDialogDescription>{removeTarget?.email || removeTarget?.userId} will lose access to the admin dashboard immediately.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel><AlertDialogAction disabled={submitting} className="bg-red-600 text-white hover:bg-red-700" onClick={(event) => { event.preventDefault(); void handleRemoveAdmin(); }}>{submitting ? "Removing..." : "Remove Admin"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}
