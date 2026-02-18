import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Textarea } from "@/app/components/ui/textarea";
import { Send, MessageCircle, Search } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  getConversationMessages,
  getConversationThreads,
  getOrCreateEmployerConversation,
  listEmployerMessageRecipients,
  markConversationRead,
  sendChatMessage,
  subscribeToConversationMessages,
  subscribeToMyConversations,
  type ChatMessage,
  type ConversationThread,
  type EmployerMessageRecipient,
} from "@/lib/messages";

function formatThreadTime(value: string | null): string {
  if (!value) return "New";
  const date = new Date(value);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString();
}

function formatBubbleTime(value: string): string {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function MessagesPage() {
  const { user, role } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [threads, setThreads] = useState<ConversationThread[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [selectedRecipientId, setSelectedRecipientId] = useState("");
  const [startingChat, setStartingChat] = useState(false);
  const [candidateRecipients, setCandidateRecipients] = useState<EmployerMessageRecipient[]>([]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  async function refreshThreads() {
    const data = await getConversationThreads();
    setThreads(data);
  }

  useEffect(() => {
    setThreadsLoading(true);
    refreshThreads()
      .catch((error) => console.error("Failed to load conversation threads", error))
      .finally(() => setThreadsLoading(false));
  }, []);

  useEffect(() => {
    if (role === "employer") {
      listEmployerMessageRecipients()
        .then(setCandidateRecipients)
        .catch((error) => console.error("Failed to load candidate recipients", error));
      return;
    }

  }, [role]);

  useEffect(() => {
    let cleanup: (() => void) | null = null;

    subscribeToMyConversations(() => {
      void refreshThreads().catch((error) =>
        console.error("Failed to refresh conversations from realtime", error),
      );
    })
      .then((unsubscribe) => {
        cleanup = unsubscribe;
      })
      .catch((error) => console.error("Failed to subscribe to conversations", error));

    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  useEffect(() => {
    const candidateId = searchParams.get("candidate");
    if (!role) return;

    if (role === "employer" && candidateId) {
      getOrCreateEmployerConversation(candidateId)
        .then(async (conversationId) => {
          setActiveConversationId(conversationId);
          await refreshThreads();
          setSearchParams({}, { replace: true });
        })
        .catch((error) => console.error("Failed to open employer conversation", error));
      return;
    }
  }, [role, searchParams, setSearchParams]);

  useEffect(() => {
    if (activeConversationId || threads.length === 0) return;
    setActiveConversationId(threads[0].id);
  }, [activeConversationId, threads]);

  useEffect(() => {
    if (!activeConversationId) return;

    setMessagesLoading(true);
    getConversationMessages(activeConversationId)
      .then(async (rows) => {
        setMessages(rows);
        await markConversationRead(activeConversationId);
      })
      .catch((error) => console.error("Failed to load messages", error))
      .finally(() => setMessagesLoading(false));

    const unsubscribe = subscribeToConversationMessages(activeConversationId, (newMessage) => {
      setMessages((prev) => {
        if (prev.some((msg) => msg.id === newMessage.id)) return prev;
        return [...prev, newMessage];
      });
      void markConversationRead(activeConversationId).catch((error) =>
        console.error("Failed to mark messages as read", error),
      );
      void refreshThreads().catch((error) =>
        console.error("Failed to refresh threads after new message", error),
      );
    });

    return () => unsubscribe();
  }, [activeConversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const filteredThreads = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return threads;

    return threads.filter((thread) => {
      const target = [
        thread.counterpartName,
        thread.counterpartHeadline ?? "",
        thread.counterpartLocation ?? "",
        thread.lastMessagePreview ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return target.includes(query);
    });
  }, [threads, searchText]);

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeConversationId) ?? null,
    [threads, activeConversationId],
  );

  async function handleSendMessage() {
    if (!activeConversationId || !draft.trim()) return;

    try {
      setSending(true);
      const text = draft;
      setDraft("");
      await sendChatMessage(activeConversationId, text);
      await refreshThreads();
    } catch (error) {
      console.error("Failed to send message", error);
      alert("Unable to send message right now. Please try again.");
    } finally {
      setSending(false);
    }
  }

  async function handleStartChat() {
    if (role !== "employer" || !selectedRecipientId) return;

    try {
      setStartingChat(true);
      const conversationId = await getOrCreateEmployerConversation(selectedRecipientId);

      setActiveConversationId(conversationId);
      await refreshThreads();
    } catch (error) {
      console.error("Failed to start conversation", error);
      alert("Unable to start chat right now. Please try again.");
    } finally {
      setStartingChat(false);
    }
  }

  if (!user || (role !== "employer" && role !== "candidate")) {
    return <div className="p-8 text-gray-500">Messaging is only available for signed-in users.</div>;
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-gray-50 via-blue-50/20 to-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
          <p className="text-sm text-gray-600 mt-1">
            Real-time conversations between candidates and employers
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
          <Card className="border-gray-200 p-4 h-[72vh] flex flex-col">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search conversations"
                className="pl-9"
              />
            </div>
            <div className="overflow-y-auto space-y-2 pr-1">
              {threadsLoading && <p className="text-sm text-gray-500 p-2">Loading conversations...</p>}

              {!threadsLoading && filteredThreads.length === 0 && (
                <div className="p-4 text-center text-gray-500 text-sm border border-dashed rounded-lg">
                  No conversations yet.
                </div>
              )}

              {!threadsLoading &&
                filteredThreads.map((thread) => (
                  <button
                    key={thread.id}
                    className={`w-full text-left rounded-xl border p-3 transition ${
                      activeConversationId === thread.id
                        ? "border-blue-300 bg-blue-50"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                    onClick={() => setActiveConversationId(thread.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-gray-900 truncate">
                          {thread.counterpartName}
                        </p>
                        {thread.counterpartHeadline && (
                          <p className="text-xs text-gray-500 truncate">{thread.counterpartHeadline}</p>
                        )}
                      </div>
                      <span className="text-[11px] text-gray-500 shrink-0">
                        {formatThreadTime(thread.lastMessageAt ?? thread.createdAt)}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-gray-600 truncate">
                      {thread.lastMessagePreview ?? "Start the conversation"}
                    </p>
                  </button>
                ))}
            </div>
          </Card>

          <Card className="border-gray-200 h-[72vh] flex flex-col">
            {!activeThread ? (
              <div className="flex-1 flex items-center justify-center text-center p-8">
                <div>
                  <div className="w-14 h-14 mx-auto rounded-full bg-blue-100 flex items-center justify-center mb-3">
                    <MessageCircle className="w-7 h-7 text-blue-600" />
                  </div>
                  <p className="font-semibold text-gray-900">Start a new conversation</p>
                  <p className="text-sm text-gray-500 mt-1 mb-4">
                    Pick who you want to message, then start chat.
                  </p>
                  {role === "employer" && (
                    <select
                      value={selectedRecipientId}
                      onChange={(event) => setSelectedRecipientId(event.target.value)}
                      className="w-full max-w-sm h-10 rounded-md border border-gray-300 px-3 text-sm bg-white"
                    >
                      <option value="">Select candidate</option>
                      {candidateRecipients.map((recipient) => (
                        <option key={recipient.id} value={recipient.id}>
                          {recipient.name}
                          {recipient.location ? ` - ${recipient.location}` : ""}
                        </option>
                      ))}
                    </select>
                  )}
                  {role === "employer" && (
                    <div className="mt-3">
                      <Button
                        onClick={() => void handleStartChat()}
                        disabled={!selectedRecipientId || startingChat}
                      >
                        {startingChat ? "Starting..." : "Start Chat"}
                      </Button>
                    </div>
                  )}
                  {role === "candidate" && (
                    <p className="text-sm text-gray-500">
                      No conversations yet. Employers will message you first.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="border-b border-gray-200 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-600 text-white text-sm font-semibold flex items-center justify-center">
                      {activeThread.counterpartName
                        .split(" ")
                        .map((part) => part[0] ?? "")
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{activeThread.counterpartName}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Badge variant="secondary" className="text-[10px]">
                          {activeThread.counterpartRole}
                        </Badge>
                        {activeThread.counterpartLocation && <span>{activeThread.counterpartLocation}</span>}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-gray-50">
                  {messagesLoading && <p className="text-sm text-gray-500">Loading messages...</p>}

                  {!messagesLoading && messages.length === 0 && (
                    <div className="text-center text-gray-500 text-sm pt-10">
                      No messages yet. Say hello and start the conversation.
                    </div>
                  )}

                  {!messagesLoading &&
                    messages.map((message) => {
                      const mine = message.senderUserId === user.id;

                      return (
                        <div
                          key={message.id}
                          className={`flex ${mine ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm ${
                              mine
                                ? "bg-blue-600 text-white rounded-br-md"
                                : "bg-white text-gray-900 border border-gray-200 rounded-bl-md"
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap">{message.body}</p>
                            <p
                              className={`text-[11px] mt-1 ${
                                mine ? "text-blue-100" : "text-gray-500"
                              }`}
                            >
                              {formatBubbleTime(message.createdAt)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  <div ref={messagesEndRef} />
                </div>

                <div className="border-t border-gray-200 p-4 bg-white">
                  <div className="flex items-end gap-3">
                    <Textarea
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      placeholder="Type a message..."
                      className="min-h-[44px] max-h-40 resize-y"
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          void handleSendMessage();
                        }
                      }}
                    />
                    <Button
                      onClick={() => void handleSendMessage()}
                      disabled={sending || !draft.trim()}
                      className="h-11 px-4"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Send
                    </Button>
                  </div>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
