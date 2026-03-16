import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Building2, CreditCard, Download, FileText, RotateCcw, UserRound, Users } from "lucide-react";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { CircularLoader } from "@/app/components/ui/circular-loader";
import { FeedbackDialog, useFeedbackDialog } from "@/app/components/ui/feedback-dialog";
import { useAuth } from "@/app/context/AuthContext";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { type AdminEntityDetail, getAdminEntityDetail, getAdminInvoiceDownloadUrl, logAdminAction, retryAdminWebhookEvent } from "@/lib/admin";

const formatValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "Not available";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "Not available";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
};

const formatDate = (value: unknown) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "Not available";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
};

const formatCurrencyFromKobo = (value: unknown) =>
  new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", minimumFractionDigits: 2 }).format(Number(value ?? 0) / 100);

function SectionRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid gap-1 border-b border-gray-200 py-3 last:border-b-0 dark:border-white/10">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`break-words text-sm text-gray-900 dark:text-white ${mono ? "font-mono text-xs" : ""}`}>{value}</p>
    </div>
  );
}

function iconForKind(kind: string) {
  if (kind === "employer") return Building2;
  if (kind === "candidate") return UserRound;
  if (kind === "job") return FileText;
  if (kind === "invoice") return CreditCard;
  return Users;
}

function titleForKind(kind: string) {
  if (kind === "employer") return "Employer Detail";
  if (kind === "candidate") return "Candidate Detail";
  if (kind === "job") return "Job Detail";
  if (kind === "invoice") return "Invoice Detail";
  return "Admin Detail";
}

function SummaryCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Card className="border-gray-200 p-6 dark:border-white/10 dark:bg-neutral-900">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
      <div className="mt-4 space-y-3">{children}</div>
    </Card>
  );
}

export default function AdminEntityDetailPage() {
  const navigate = useNavigate();
  const { kind = "", id = "" } = useParams<{ kind: string; id: string }>();
  const { user } = useAuth();
  const { isAdmin, loading: accessLoading } = useAdminAccess();
  const [detail, setDetail] = useState<AdminEntityDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const Icon = useMemo(() => iconForKind(kind), [kind]);
  const { feedback, showFeedback, setFeedbackOpen } = useFeedbackDialog();

  async function loadDetail() {
    if (!kind || !id) {
      setLoading(false);
      setDetail(null);
      return;
    }

    setLoading(true);
    getAdminEntityDetail(kind, id)
      .then((result) => {
        setDetail(result);
        void logAdminAction({
          action: "admin_entity_viewed",
          details: { entityKind: kind, entityId: id, source: "detail_page" },
        }).catch((error) => console.error("Failed to log admin entity view", error));
      })
      .catch((error) => {
        console.error("Failed to load admin entity detail", error);
        setDetail(null);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!isAdmin) return;
    void loadDetail();
  }, [isAdmin, kind, id]);

  function openEntity(kindValue: "employer" | "candidate" | "job" | "invoice", targetId: unknown) {
    const normalized = String(targetId ?? "").trim();
    if (!normalized) return;
    navigate(`/admin/entities/${kindValue}/${normalized}`);
  }

  async function handleInvoiceDownload(invoiceId: string) {
    try {
      setDownloading(true);
      const url = await getAdminInvoiceDownloadUrl(invoiceId);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error: any) {
      showFeedback("Download unavailable", String(error?.message ?? "Please try again."));
    } finally {
      setDownloading(false);
    }
  }

  async function handleInvoiceRetry() {
    try {
      setRetrying(true);
      const currentDetail = await getAdminEntityDetail("invoice", id);
      const retryTarget = String((currentDetail.related as Record<string, unknown> | undefined)?.failedWebhookEventId ?? "").trim();
      if (!retryTarget) {
        throw new Error("No linked failed webhook event was found for this invoice.");
      }

      await retryAdminWebhookEvent(retryTarget);
      await loadDetail();
      showFeedback("Webhook retried", "The linked failed payment event was replayed.");
    } catch (error: any) {
      showFeedback("Retry failed", String(error?.message ?? "Please try again."));
    } finally {
      setRetrying(false);
    }
  }

  if (!user) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
        <Card className="w-full max-w-xl border-gray-200 p-8 text-center dark:border-white/10 dark:bg-neutral-900">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin detail</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Sign in with an authorized admin account to continue.</p>
        </Card>
      </div>
    );
  }

  if (accessLoading || loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
        <CircularLoader size="md" label="Loading admin detail..." />
      </div>
    );
  }

  if (!isAdmin || !detail) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <Card className="border-red-200 p-8 text-center dark:border-red-500/20 dark:bg-neutral-900">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Record unavailable</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">This admin record could not be loaded or you do not have access.</p>
          <div className="mt-6">
            <Button variant="outline" onClick={() => navigate("/admin/dashboard")}>Back to dashboard</Button>
          </div>
        </Card>
      </div>
    );
  }

  const entity = detail.entity ?? {};
  const metrics = detail.metrics ?? {};
  const related = detail.related ?? {};
  const creditBalances = Array.isArray(detail.creditBalances) ? detail.creditBalances : [];
  const recentAddonPurchases = Array.isArray(detail.recentAddonPurchases) ? detail.recentAddonPurchases : [];
  const recentInvoices = Array.isArray(detail.recentInvoices) ? detail.recentInvoices : [];
  const recentApplications = Array.isArray(detail.recentApplications) ? detail.recentApplications : [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Button variant="ghost" className="mb-6 dark:text-white dark:hover:bg-white/10" onClick={() => navigate("/admin/dashboard")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to dashboard
        </Button>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <Card className="border-gray-200 p-6 dark:border-white/10 dark:bg-neutral-900">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-neutral-950 dark:text-blue-300">
                <Icon className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{titleForKind(detail.kind)}</h1>
                  <Badge variant="secondary">{detail.kind}</Badge>
                </div>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  {detail.kind === "employer" && formatValue(entity.companyName)}
                  {detail.kind === "candidate" && formatValue(entity.fullName)}
                  {detail.kind === "job" && formatValue(entity.title)}
                  {detail.kind === "invoice" && formatValue(entity.invoiceNumber)}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {detail.kind === "invoice" ? (
                <>
                  <Button onClick={() => void handleInvoiceDownload(String(entity.invoiceId ?? id))} disabled={downloading}>
                    <Download className="mr-2 h-4 w-4" />
                    {downloading ? "Preparing..." : "Download invoice"}
                  </Button>
                  {String(related.failedWebhookEventId ?? "").trim() ? (
                    <Button variant="outline" onClick={() => void handleInvoiceRetry()} disabled={retrying}>
                      <RotateCcw className={`mr-2 h-4 w-4 ${retrying ? "animate-spin" : ""}`} />
                      {retrying ? "Retrying..." : "Retry webhook"}
                    </Button>
                  ) : null}
                  {String(related.employerUserId ?? "").trim() ? (
                    <Button variant="outline" onClick={() => openEntity("employer", related.employerUserId)}>Open employer</Button>
                  ) : null}
                </>
              ) : null}

              {detail.kind === "job" && String(entity.employerId ?? "").trim() ? (
                <Button variant="outline" onClick={() => openEntity("employer", entity.employerId)}>Open employer</Button>
              ) : null}
            </div>

            <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 px-4 dark:border-white/10 dark:bg-neutral-950">
              {Object.entries(entity).map(([key, value]) => (
                <SectionRow
                  key={key}
                  label={key}
                  value={
                    key.toLowerCase().includes("at")
                      ? formatDate(value)
                      : key.toLowerCase().includes("kobo")
                        ? formatCurrencyFromKobo(value)
                        : formatValue(value)
                  }
                  mono={typeof value === "object" && value !== null}
                />
              ))}
            </div>
          </Card>

          <div className="space-y-6">
            <Card className="border-gray-200 p-6 dark:border-white/10 dark:bg-neutral-900">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Metrics</h2>
              <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 dark:border-white/10 dark:bg-neutral-950">
                {Object.keys(metrics).length === 0 ? (
                  <SectionRow label="Metrics" value="No aggregate metrics for this record." />
                ) : (
                  Object.entries(metrics).map(([key, value]) => (
                    <SectionRow key={key} label={key} value={key.toLowerCase().includes("kobo") ? formatCurrencyFromKobo(value) : formatValue(value)} />
                  ))
                )}
              </div>
            </Card>

            {creditBalances.length > 0 ? (
              <SummaryCard title="Credit balances">
                {creditBalances.map((row, index) => (
                  <div key={String(row.creditType ?? index)} className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-neutral-950">
                    <p className="font-medium text-gray-900 dark:text-white">{formatValue(row.creditType)}</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{formatValue(row.remaining)} remaining</p>
                  </div>
                ))}
              </SummaryCard>
            ) : null}

            {recentAddonPurchases.length > 0 ? (
              <SummaryCard title="Recent add-on purchases">
                {recentAddonPurchases.map((row, index) => (
                  <div key={String(row.purchaseId ?? index)} className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-neutral-950">
                    <p className="font-medium text-gray-900 dark:text-white">{formatValue(row.addonName)}</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {formatValue(row.reference)} | {formatCurrencyFromKobo(row.amountPaid)} | {formatValue(row.creditsAdded)} credits
                    </p>
                  </div>
                ))}
              </SummaryCard>
            ) : null}

            {recentInvoices.length > 0 ? (
              <SummaryCard title="Recent invoices">
                {recentInvoices.map((row, index) => (
                  <div key={String(row.invoiceId ?? index)} className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-neutral-950">
                    <p className="font-medium text-gray-900 dark:text-white">{formatValue(row.invoiceNumber)}</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{formatValue(row.status)} | {formatCurrencyFromKobo(row.totalKobo)}</p>
                    <div className="mt-3">
                      <Button size="sm" variant="outline" onClick={() => openEntity("invoice", row.invoiceId)}>Open invoice</Button>
                    </div>
                  </div>
                ))}
              </SummaryCard>
            ) : null}

            {recentApplications.length > 0 ? (
              <SummaryCard title="Recent applications">
                {recentApplications.map((row, index) => (
                  <div key={String(row.applicationId ?? index)} className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-neutral-950">
                    <p className="font-medium text-gray-900 dark:text-white">{formatValue(row.jobTitle ?? row.candidateName ?? row.applicationId)}</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{formatValue(row.status)} | {formatDate(row.createdAt)}</p>
                    {detail.kind === "job" && String(row.candidateProfileId ?? "").trim() ? (
                      <div className="mt-3">
                        <Button size="sm" variant="outline" onClick={() => openEntity("candidate", row.candidateProfileId)}>Open candidate</Button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </SummaryCard>
            ) : null}
          </div>
        </div>
      </div>

      <FeedbackDialog open={feedback.open} title={feedback.title} description={feedback.description} onOpenChange={setFeedbackOpen} />
    </div>
  );
}
