import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type MessagingRole = "employer" | "candidate";

export interface ConversationThread {
  id: string;
  createdAt: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  lastMessageSenderRole: MessagingRole | null;
  employerId: string;
  candidateProfileId: string;
  counterpartName: string;
  counterpartHeadline: string | null;
  counterpartLocation: string | null;
  counterpartRole: MessagingRole;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderUserId: string;
  senderRole: MessagingRole;
  body: string;
  createdAt: string;
  readAt: string | null;
}

export interface EmployerMessageRecipient {
  id: string;
  name: string;
  headline: string | null;
  location: string | null;
}

export interface CandidateMessageRecipient {
  id: string;
  name: string;
  industry: string | null;
}

interface CurrentActor {
  userId: string;
  role: MessagingRole;
  employerProfileId: string | null;
  candidateProfileId: string | null;
}

async function getCurrentActor(): Promise<CurrentActor> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) throw new Error("Not authenticated");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.role) {
    throw new Error("Unable to resolve user role.");
  }

  const role = String(profile.role).toLowerCase();
  if (role !== "candidate" && role !== "employer") {
    throw new Error("Messaging is only available for employer and candidate accounts.");
  }

  let employerProfileId: string | null = null;
  let candidateProfileId: string | null = null;

  if (role === "employer") {
    const { data: employer } = await supabase
      .from("employer_profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();
    employerProfileId = employer?.id ?? null;
  }

  if (role === "candidate") {
    const { data: candidate } = await supabase
      .from("candidate_profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();
    candidateProfileId = candidate?.id ?? null;
  }

  return {
    userId: user.id,
    role,
    employerProfileId,
    candidateProfileId,
  };
}

export async function getConversationThreads(): Promise<ConversationThread[]> {
  const actor = await getCurrentActor();

  const query = supabase
    .from("conversations")
    .select(
      `
      id,
      created_at,
      last_message_at,
      last_message_preview,
      last_message_sender_role,
      employer_id,
      candidate_profile_id,
      employer:employer_profiles (
        id,
        company_name
      ),
      candidate:candidate_profiles (
        id,
        full_name,
        headline,
        location
      )
    `,
    )
    .order("last_message_at", { ascending: false });

  if (actor.role === "employer" && actor.employerProfileId) {
    query.eq("employer_id", actor.employerProfileId);
  } else if (actor.role === "candidate" && actor.candidateProfileId) {
    query.eq("candidate_profile_id", actor.candidateProfileId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row) => {
    const employer = Array.isArray(row.employer) ? row.employer[0] : row.employer;
    const candidate = Array.isArray(row.candidate) ? row.candidate[0] : row.candidate;

    if (actor.role === "employer") {
      return {
        id: String(row.id),
        createdAt: String(row.created_at),
        lastMessageAt: row.last_message_at ?? null,
        lastMessagePreview: row.last_message_preview ?? null,
        lastMessageSenderRole: (row.last_message_sender_role as MessagingRole | null) ?? null,
        employerId: String(row.employer_id),
        candidateProfileId: String(row.candidate_profile_id),
        counterpartName: String(candidate?.full_name ?? "Candidate"),
        counterpartHeadline: candidate?.headline ?? null,
        counterpartLocation: candidate?.location ?? null,
        counterpartRole: "candidate" as const,
      };
    }

    return {
      id: String(row.id),
      createdAt: String(row.created_at),
      lastMessageAt: row.last_message_at ?? null,
      lastMessagePreview: row.last_message_preview ?? null,
      lastMessageSenderRole: (row.last_message_sender_role as MessagingRole | null) ?? null,
      employerId: String(row.employer_id),
      candidateProfileId: String(row.candidate_profile_id),
      counterpartName: String(employer?.company_name ?? "Employer"),
      counterpartHeadline: null,
      counterpartLocation: null,
      counterpartRole: "employer" as const,
    };
  });
}

export async function getConversationMessages(conversationId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_user_id, sender_role, body, created_at, read_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: String(row.id),
    conversationId: String(row.conversation_id),
    senderUserId: String(row.sender_user_id),
    senderRole: row.sender_role as MessagingRole,
    body: String(row.body ?? ""),
    createdAt: String(row.created_at),
    readAt: row.read_at ?? null,
  }));
}

export async function getOrCreateEmployerConversation(candidateProfileId: string): Promise<string> {
  const actor = await getCurrentActor();
  if (actor.role !== "employer" || !actor.employerProfileId) {
    throw new Error("Only employers can start candidate conversations.");
  }

  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("employer_id", actor.employerProfileId)
    .eq("candidate_profile_id", candidateProfileId)
    .maybeSingle();

  if (existing?.id) return String(existing.id);

  const { data: createdId, error } = await supabase.rpc("create_or_get_conversation", {
    p_candidate_profile_id: candidateProfileId,
    p_employer_profile_id: null,
  });

  if (error) throw error;
  return String(createdId);
}

export async function getOrCreateCandidateConversation(employerProfileId: string): Promise<string> {
  const actor = await getCurrentActor();
  if (actor.role !== "candidate" || !actor.candidateProfileId) {
    throw new Error("Only candidates can start employer conversations.");
  }

  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("employer_id", employerProfileId)
    .eq("candidate_profile_id", actor.candidateProfileId)
    .maybeSingle();

  if (existing?.id) return String(existing.id);

  const { data: createdId, error } = await supabase.rpc("create_or_get_conversation", {
    p_candidate_profile_id: null,
    p_employer_profile_id: employerProfileId,
  });

  if (error) throw error;
  return String(createdId);
}

export async function sendChatMessage(conversationId: string, text: string): Promise<void> {
  const actor = await getCurrentActor();
  const body = text.trim();
  if (!body) return;

  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_user_id: actor.userId,
    sender_role: actor.role,
    body,
  });

  if (error) throw error;
}

export async function markConversationRead(conversationId: string): Promise<void> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .is("read_at", null)
    .neq("sender_user_id", user.id);

  if (error) throw error;
}

export function subscribeToConversationMessages(
  conversationId: string,
  onInserted: (message: ChatMessage) => void,
): () => void {
  const channel = supabase
    .channel(`conversation:${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        const row = payload.new as {
          id: string;
          conversation_id: string;
          sender_user_id: string;
          sender_role: MessagingRole;
          body: string;
          created_at: string;
          read_at: string | null;
        };

        onInserted({
          id: row.id,
          conversationId: row.conversation_id,
          senderUserId: row.sender_user_id,
          senderRole: row.sender_role,
          body: row.body,
          createdAt: row.created_at,
          readAt: row.read_at,
        });
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export async function subscribeToMyConversations(
  onChanged: () => void,
): Promise<() => void> {
  const actor = await getCurrentActor();

  const channelName =
    actor.role === "employer" && actor.employerProfileId
      ? `conversations:employer:${actor.employerProfileId}`
      : `conversations:candidate:${actor.candidateProfileId}`;

  const filter =
    actor.role === "employer" && actor.employerProfileId
      ? `employer_id=eq.${actor.employerProfileId}`
      : `candidate_profile_id=eq.${actor.candidateProfileId}`;

  const channel: RealtimeChannel = supabase
    .channel(channelName)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "conversations",
        filter,
      },
      () => onChanged(),
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export async function listEmployerMessageRecipients(): Promise<EmployerMessageRecipient[]> {
  const actor = await getCurrentActor();
  if (actor.role !== "employer") {
    throw new Error("Only employers can list candidate recipients.");
  }

  const { data, error } = await supabase
    .from("candidate_profiles")
    .select("id, full_name, headline, location")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.full_name ?? "Candidate"),
    headline: row.headline ?? null,
    location: row.location ?? null,
  }));
}

export async function listCandidateMessageRecipients(): Promise<CandidateMessageRecipient[]> {
  const actor = await getCurrentActor();
  if (actor.role !== "candidate") {
    throw new Error("Only candidates can list employer recipients.");
  }

  const { data, error } = await supabase
    .from("employer_profiles")
    .select("id, company_name, industry")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.company_name ?? "Employer"),
    industry: row.industry ?? null,
  }));
}

export async function getCandidateUnreadMessageCount(): Promise<number> {
  const actor = await getCurrentActor();
  if (actor.role !== "candidate" || !actor.candidateProfileId) return 0;

  const { count, error } = await supabase
    .from("messages")
    .select("id, conversations!inner(candidate_profile_id)", { count: "exact", head: true })
    .eq("conversations.candidate_profile_id", actor.candidateProfileId)
    .eq("sender_role", "employer")
    .is("read_at", null);

  if (error) throw error;
  return Number(count ?? 0);
}

export function subscribeToMyMessageChanges(onChanged: () => void): () => void {
  const channel = supabase
    .channel("messages:my-updates")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "messages",
      },
      () => onChanged(),
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
