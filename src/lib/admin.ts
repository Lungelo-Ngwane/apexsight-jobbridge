import { supabase } from "@/lib/supabase";

export type AdminMetricSnapshot = {
  totalUsers: number;
  totalCandidates: number;
  totalEmployers: number;
  openJobs: number;
  totalApplications: number;
  activeSubscriptions: number;
  trialingEmployers: number;
  pendingPayments: number;
  paidInvoices: number;
  paidRevenueKobo: number;
  failedWebhooks: number;
  unreadWebhookBacklog: number;
  messagesLast7Days: number;
  signupsInRange: number;
  applicationsInRange: number;
  paidRevenueInRangeKobo: number;
  adminActionsLast24h: number;
  adminRetriesLast24h: number;
  invoiceDownloadsLast24h: number;
  activeAdminsLast24h: number;
  days: number;
};

export type AdminPlanDistribution = {
  plan: string;
  count: number;
};

export type AdminCreditTotal = {
  creditType: string;
  remaining: number;
};

export type AdminActivityItem = {
  type: string;
  title: string;
  detail: string;
  status: string;
  occurredAt: string;
};

export type AdminDashboardSnapshot = {
  metrics: AdminMetricSnapshot;
  planDistribution: AdminPlanDistribution[];
  creditTotals: AdminCreditTotal[];
  recentActivity: AdminActivityItem[];
  trends: AdminTrendPoint[];
  queues: AdminDashboardQueues;
  recentEmployers: AdminRecentEmployer[];
  recentCandidates: AdminRecentCandidate[];
  recentInvoices: AdminRecentInvoice[];
};

export type AdminTrendPoint = {
  date: string;
  signups: number;
  applications: number;
  revenueKobo: number;
  failedWebhooks: number;
};

export type AdminWebhookQueueItem = {
  id: string;
  eventName: string;
  reference: string;
  status: string;
  lastError: string;
  receivedAt: string;
};

export type AdminPendingPaymentItem = {
  invoiceId: string;
  invoiceNumber: string;
  employerName: string;
  totalKobo: number;
  issuedAt: string;
};

export type AdminStalledJobItem = {
  jobId: string;
  title: string;
  employerName: string;
  applicants: number;
  shortlisted: number;
  createdAt: string;
};

export type AdminDashboardQueues = {
  failedWebhooks: AdminWebhookQueueItem[];
  pendingPayments: AdminPendingPaymentItem[];
  stalledJobs: AdminStalledJobItem[];
};

export type AdminRecentEmployer = {
  userId: string;
  email: string;
  companyName: string;
  createdAt: string;
};

export type AdminRecentCandidate = {
  userId: string;
  email: string;
  fullName: string;
  createdAt: string;
};

export type AdminRecentInvoice = {
  invoiceId: string;
  invoiceNumber: string;
  employerName: string;
  status: string;
  kind: string;
  totalKobo: number;
  issuedAt: string;
};

export type AdminUserRecord = {
  userId: string;
  email: string;
  notes: string | null;
  createdAt: string;
  createdBy: string | null;
  isCurrentUser: boolean;
};

export type AdminAuditLogRecord = {
  id: string;
  actorUserId: string | null;
  actorEmail: string;
  action: string;
  targetUserId: string | null;
  targetEmail: string;
  details: Record<string, unknown>;
  createdAt: string;
};

export type AdminEntityDetail = {
  kind: string;
  entity: Record<string, unknown>;
  metrics?: Record<string, unknown>;
  recentInvoices?: Array<Record<string, unknown>>;
  recentApplications?: Array<Record<string, unknown>>;
  creditBalances?: Array<Record<string, unknown>>;
  recentAddonPurchases?: Array<Record<string, unknown>>;
  related?: Record<string, unknown>;
};

type AuthedFunctionError = {
  status?: number;
  code?: number;
  message?: string;
  detail?: string | null;
};

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeSnapshot(payload: any): AdminDashboardSnapshot {
  return {
    metrics: {
      totalUsers: toNumber(payload?.metrics?.totalUsers),
      totalCandidates: toNumber(payload?.metrics?.totalCandidates),
      totalEmployers: toNumber(payload?.metrics?.totalEmployers),
      openJobs: toNumber(payload?.metrics?.openJobs),
      totalApplications: toNumber(payload?.metrics?.totalApplications),
      activeSubscriptions: toNumber(payload?.metrics?.activeSubscriptions),
      trialingEmployers: toNumber(payload?.metrics?.trialingEmployers),
      pendingPayments: toNumber(payload?.metrics?.pendingPayments),
      paidInvoices: toNumber(payload?.metrics?.paidInvoices),
      paidRevenueKobo: toNumber(payload?.metrics?.paidRevenueKobo),
      failedWebhooks: toNumber(payload?.metrics?.failedWebhooks),
      unreadWebhookBacklog: toNumber(payload?.metrics?.unreadWebhookBacklog),
      messagesLast7Days: toNumber(payload?.metrics?.messagesLast7Days),
      signupsInRange: toNumber(payload?.metrics?.signupsInRange),
      applicationsInRange: toNumber(payload?.metrics?.applicationsInRange),
      paidRevenueInRangeKobo: toNumber(payload?.metrics?.paidRevenueInRangeKobo),
      adminActionsLast24h: toNumber(payload?.metrics?.adminActionsLast24h),
      adminRetriesLast24h: toNumber(payload?.metrics?.adminRetriesLast24h),
      invoiceDownloadsLast24h: toNumber(payload?.metrics?.invoiceDownloadsLast24h),
      activeAdminsLast24h: toNumber(payload?.metrics?.activeAdminsLast24h),
      days: toNumber(payload?.metrics?.days),
    },
    planDistribution: Array.isArray(payload?.planDistribution)
      ? payload.planDistribution.map((item: any) => ({
          plan: String(item?.plan ?? "unknown"),
          count: toNumber(item?.count),
        }))
      : [],
    creditTotals: Array.isArray(payload?.creditTotals)
      ? payload.creditTotals.map((item: any) => ({
          creditType: String(item?.creditType ?? "unknown"),
          remaining: toNumber(item?.remaining),
        }))
      : [],
    recentActivity: Array.isArray(payload?.recentActivity)
      ? payload.recentActivity.map((item: any) => ({
          type: String(item?.type ?? "event"),
          title: String(item?.title ?? "Activity"),
          detail: String(item?.detail ?? ""),
          status: String(item?.status ?? "info"),
          occurredAt: String(item?.occurredAt ?? ""),
        }))
      : [],
    trends: Array.isArray(payload?.trends)
      ? payload.trends.map((item: any) => ({
          date: String(item?.date ?? ""),
          signups: toNumber(item?.signups),
          applications: toNumber(item?.applications),
          revenueKobo: toNumber(item?.revenueKobo),
          failedWebhooks: toNumber(item?.failedWebhooks),
        }))
      : [],
    queues: {
      failedWebhooks: Array.isArray(payload?.queues?.failedWebhooks)
        ? payload.queues.failedWebhooks.map((item: any) => ({
            id: String(item?.id ?? ""),
            eventName: String(item?.eventName ?? ""),
            reference: String(item?.reference ?? ""),
            status: String(item?.status ?? ""),
            lastError: String(item?.lastError ?? ""),
            receivedAt: String(item?.receivedAt ?? ""),
          }))
        : [],
      pendingPayments: Array.isArray(payload?.queues?.pendingPayments)
        ? payload.queues.pendingPayments.map((item: any) => ({
            invoiceId: String(item?.invoiceId ?? ""),
            invoiceNumber: String(item?.invoiceNumber ?? ""),
            employerName: String(item?.employerName ?? ""),
            totalKobo: toNumber(item?.totalKobo),
            issuedAt: String(item?.issuedAt ?? ""),
          }))
        : [],
      stalledJobs: Array.isArray(payload?.queues?.stalledJobs)
        ? payload.queues.stalledJobs.map((item: any) => ({
            jobId: String(item?.jobId ?? ""),
            title: String(item?.title ?? ""),
            employerName: String(item?.employerName ?? ""),
            applicants: toNumber(item?.applicants),
            shortlisted: toNumber(item?.shortlisted),
            createdAt: String(item?.createdAt ?? ""),
          }))
        : [],
    },
    recentEmployers: Array.isArray(payload?.recentEmployers)
      ? payload.recentEmployers.map((item: any) => ({
          userId: String(item?.userId ?? ""),
          email: String(item?.email ?? ""),
          companyName: String(item?.companyName ?? ""),
          createdAt: String(item?.createdAt ?? ""),
        }))
      : [],
    recentCandidates: Array.isArray(payload?.recentCandidates)
      ? payload.recentCandidates.map((item: any) => ({
          userId: String(item?.userId ?? ""),
          email: String(item?.email ?? ""),
          fullName: String(item?.fullName ?? ""),
          createdAt: String(item?.createdAt ?? ""),
        }))
      : [],
    recentInvoices: Array.isArray(payload?.recentInvoices)
      ? payload.recentInvoices.map((item: any) => ({
          invoiceId: String(item?.invoiceId ?? ""),
          invoiceNumber: String(item?.invoiceNumber ?? ""),
          employerName: String(item?.employerName ?? ""),
          status: String(item?.status ?? ""),
          kind: String(item?.kind ?? ""),
          totalKobo: toNumber(item?.totalKobo),
          issuedAt: String(item?.issuedAt ?? ""),
        }))
      : [],
  };
}

async function getValidAccessToken(): Promise<string> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  let accessToken = session?.access_token;
  const expiresAt = session?.expires_at ?? 0;

  if (!accessToken || expiresAt * 1000 <= Date.now() + 60_000) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    accessToken = refreshed.session?.access_token;
    if (refreshError || !accessToken) {
      throw new Error("Session expired. Please sign in again.");
    }
  }

  if (sessionError || !accessToken) {
    throw new Error("Not authenticated.");
  }

  return accessToken;
}

async function invokeAdminFunction<T = unknown>(
  functionName: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const token = await getValidAccessToken();
  const { data, error } = await supabase.functions.invoke<T>(functionName, {
    body: body ?? {},
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (error) {
    const parsed = (
      error as unknown as {
        context?: { json?: () => Promise<{ error?: string; detail?: string }> };
      }
    )?.context?.json
      ? await (
          error as unknown as {
            context: { json: () => Promise<{ error?: string; detail?: string }> };
          }
        ).context
          .json()
          .catch(() => null)
      : null;

    const message =
      parsed?.error ??
      parsed?.detail ??
      (error as AuthedFunctionError)?.message ??
      `Function ${functionName} failed.`;

    throw new Error(String(message));
  }

  return data as T;
}

export async function getAdminAccess(): Promise<boolean> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) throw authError;
  if (!user) return false;

  const { data, error } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;

  return Boolean(data?.user_id);
}

export async function getAdminDashboardSnapshot(days = 30): Promise<AdminDashboardSnapshot> {
  const { data, error } = await supabase.rpc("get_admin_dashboard_snapshot", {
    p_days: days,
  });

  if (error) throw error;

  return normalizeSnapshot(data);
}

export async function listAdminUsers(): Promise<AdminUserRecord[]> {
  const { data, error } = await supabase.rpc("list_admin_users");

  if (error) throw error;

  return Array.isArray(data)
    ? data.map((item: any) => ({
        userId: String(item?.user_id ?? ""),
        email: String(item?.email ?? ""),
        notes: item?.notes ? String(item.notes) : null,
        createdAt: String(item?.created_at ?? ""),
        createdBy: item?.created_by ? String(item.created_by) : null,
        isCurrentUser: Boolean(item?.is_current_user),
      }))
    : [];
}

export async function addAdminUser(input: {
  userId: string;
  email?: string;
  notes?: string;
}): Promise<void> {
  const { error } = await supabase.rpc("add_admin_user", {
    p_user_id: input.userId,
    p_email: input.email?.trim() || null,
    p_notes: input.notes?.trim() || null,
  });

  if (error) throw error;
}

export async function removeAdminUser(userId: string): Promise<void> {
  const { error } = await supabase.rpc("remove_admin_user", {
    p_user_id: userId,
  });

  if (error) throw error;
}

export async function listAdminAuditLogs(limit = 25): Promise<AdminAuditLogRecord[]> {
  const { data, error } = await supabase.rpc("list_admin_audit_logs", {
    p_limit: limit,
  });

  if (error) throw error;

  return Array.isArray(data)
    ? data.map((item: any) => ({
        id: String(item?.id ?? ""),
        actorUserId: item?.actor_user_id ? String(item.actor_user_id) : null,
        actorEmail: String(item?.actor_email ?? "Unknown admin"),
        action: String(item?.action ?? "unknown"),
        targetUserId: item?.target_user_id ? String(item.target_user_id) : null,
        targetEmail: String(item?.target_email ?? ""),
        details: typeof item?.details === "object" && item?.details !== null ? item.details : {},
        createdAt: String(item?.created_at ?? ""),
      }))
    : [];
}

export async function retryAdminWebhookEvent(eventId: string): Promise<{
  success: boolean;
  event: string;
  employerId: string;
  retried: boolean;
}> {
  return invokeAdminFunction("admin-retry-webhook", { eventId });
}

export async function getAdminEntityDetail(kind: string, id: string): Promise<AdminEntityDetail> {
  const { data, error } = await supabase.rpc("get_admin_entity_detail", {
    p_kind: kind,
    p_id: id,
  });

  if (error) throw error;

  return {
    kind: String(data?.kind ?? kind),
    entity: typeof data?.entity === "object" && data?.entity !== null ? data.entity : {},
    metrics: typeof data?.metrics === "object" && data?.metrics !== null ? data.metrics : undefined,
    recentInvoices: Array.isArray(data?.recentInvoices) ? data.recentInvoices : undefined,
    recentApplications: Array.isArray(data?.recentApplications) ? data.recentApplications : undefined,
    creditBalances: Array.isArray(data?.creditBalances) ? data.creditBalances : undefined,
    recentAddonPurchases: Array.isArray(data?.recentAddonPurchases) ? data.recentAddonPurchases : undefined,
    related: typeof data?.related === "object" && data?.related !== null ? data.related : undefined,
  };
}

export async function getAdminInvoiceDownloadUrl(invoiceId: string): Promise<string> {
  const result = await invokeAdminFunction<{ url?: string }>("admin-get-invoice-download-url", { invoiceId });
  const url = String(result?.url ?? "").trim();
  if (!url) throw new Error("Invoice download URL is unavailable.");
  return url;
}

export async function logAdminAction(input: {
  action: string;
  targetUserId?: string | null;
  targetEmail?: string | null;
  details?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabase.rpc("write_admin_audit_log", {
    p_action: input.action,
    p_target_user_id: input.targetUserId ?? null,
    p_target_email: input.targetEmail?.trim() || null,
    p_details: input.details ?? {},
  });

  if (error) throw error;
}
