import { createContext, PropsWithChildren, useEffect, useMemo, useState } from "react";
import { useAccount } from "@/hooks/use-account";
import { firebaseAuth } from "@/src/services/firebase/core";
import { SupportTicketDocument } from "@/src/types/firestore";
import { addSupportMessage, createSupportTicket, subscribeSupportTickets, updateSupportTicketStatus } from "@/src/services/firebase/support-service";
import { usePathname } from "expo-router";
import { useStartupPhase } from "@/hooks/use-startup-phase";

export type SupportStatus = "open" | "closed";
export type SupportCategory = "account" | "artwork" | "app" | "user" | "copyright" | "other";

export type SupportMessage = {
  id: string;
  author: "user" | "admin";
  text: string;
  createdAt: string;
};

export type SupportTicket = {
  id: string;
  userId: string;
  category: SupportCategory;
  subcategory: string;
  subject: string;
  topic: string;
  firstName: string;
  lastName: string;
  email: string;
  status: SupportStatus;
  createdAt: string;
  messages: SupportMessage[];
};

type NewTicketInput = {
  category: SupportCategory;
  subcategory: string;
  subject: string;
  topic: string;
  firstName: string;
  lastName: string;
  email: string;
};

type SupportContextValue = {
  tickets: SupportTicket[];
  createTicket: (input: NewTicketInput) => Promise<{ ok: boolean; message?: string }>;
  addUserMessage: (ticketId: string, text: string) => Promise<void>;
  addAdminMessage: (ticketId: string, text: string) => Promise<void>;
  closeTicket: (ticketId: string) => Promise<void>;
  syncError: string;
};

export const SupportContext = createContext<SupportContextValue>({
  tickets: [],
  createTicket: async () => ({ ok: false }),
  addUserMessage: async () => undefined,
  addAdminMessage: async () => undefined,
  closeTicket: async () => undefined,
  syncError: ""
});

function nowLabel() {
  return new Date().toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function SupportProvider({ children }: PropsWithChildren) {
  const { account, isAuthenticated } = useAccount();
  const pathname = usePathname();
  const startupPhase = useStartupPhase();
  const supportNetworkReady = startupPhase === "idle" || pathname.startsWith("/support");
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [syncError, setSyncError] = useState("");

  useEffect(() => {
    if (!isAuthenticated || !account.uid) {
      setTickets([]);
      setSyncError("");
      return;
    }
    if (!supportNetworkReady) return;

    return subscribeSupportTickets(
      account.uid,
      account.isAdmin,
      (remoteTickets) => {
        setTickets(remoteTickets.map(mapSupportTicketDocument));
        setSyncError("");
      }
    );
  }, [account.isAdmin, account.uid, isAuthenticated, supportNetworkReady]);

  const value = useMemo(
    () => ({
      tickets,
      syncError,
      createTicket: async (input: NewTicketInput) => {
        const uid = firebaseAuth.currentUser?.uid ?? account.uid;
        if (!uid) {
          const message = "Destek talebi için giriş yapmalısınız.";
          setSyncError(message);
          return { ok: false, message };
        }

        setSyncError("");
        try {
          await createSupportTicket({
            userId: uid,
            category: mapSupportCategory(input.category),
            subcategory: input.subcategory,
            subject: input.subject,
            email: input.email.trim(),
            userDisplayName: `${input.firstName.trim()} ${input.lastName.trim()}`.trim(),
            message: input.topic
          });
          return { ok: true };
        } catch (error) {
          const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
          const message = code.includes("permission-denied")
            ? "Destek talebi için oturum yetkisi yok. Çıkış yapıp tekrar giriş yapın."
            : "Destek talebi kaydedilemedi. Bağlantınızı kontrol edip tekrar deneyin.";
          setSyncError(message);
          return { ok: false, message };
        }
      },
      addUserMessage: async (ticketId: string, text: string) => {
        if (!account.uid || !text.trim()) return;
        if (ticketId.startsWith("ticket-")) return;
        const ticket = tickets.find((item) => item.id === ticketId);
        if (ticket?.status === "closed") {
          setSyncError("Sonuçlanan taleplere mesaj gönderilemez.");
          return;
        }
        setSyncError("");
        try {
          await addSupportMessage(ticketId, { senderId: account.uid, senderRole: "user", message: text.trim() });
        } catch {
          setSyncError("Mesaj gönderilemedi.");
        }
      },
      addAdminMessage: async (ticketId: string, text: string) => {
        if (!text.trim() || ticketId.startsWith("ticket-")) return;
        setSyncError("");
        try {
          await addSupportMessage(ticketId, { senderId: "admin", senderRole: "admin", message: text.trim() });
        } catch {
          setSyncError("Admin yanıtı gönderilemedi.");
        }
      },
      closeTicket: async (ticketId: string) => {
        if (ticketId.startsWith("ticket-")) return;
        setSyncError("");
        try {
          await updateSupportTicketStatus(ticketId, "resolved");
        } catch {
          setSyncError("Talep kapatılamadı.");
        }
      }
    }),
    [account.uid, syncError, tickets]
  );

  return <SupportContext.Provider value={value}>{children}</SupportContext.Provider>;
}

function mapSupportTicketDocument(ticket: SupportTicketDocument): SupportTicket {
  const displayName = typeof ticket.userDisplayName === "string" ? ticket.userDisplayName.trim() : "";
  const nameParts = displayName.split(/\s+/).filter(Boolean);
  const firstUserMessage = ticket.messages.find((message) => message.senderRole === "user");

  return {
    id: ticket.id,
    userId: ticket.userId,
    category: mapLocalSupportCategory(ticket.category),
    subcategory: ticket.subcategory,
    subject: ticket.subject,
    topic: firstUserMessage?.message ?? "",
    firstName: nameParts[0] ?? "",
    lastName: nameParts.slice(1).join(" "),
    email: ticket.email,
    status: ticket.status === "resolved" ? "closed" : "open",
    createdAt: timestampLabel(ticket.createdAt),
    messages: ticket.messages.map((message, index) => ({
      id: `${ticket.id}-message-${index}`,
      author: message.senderRole,
      text: message.message,
      createdAt: timestampLabel(message.createdAt)
    }))
  };
}

function mapSupportCategory(category: SupportCategory): SupportTicketDocument["category"] {
  if (category === "user") return "profile";
  return category;
}

function mapLocalSupportCategory(category: SupportTicketDocument["category"]): SupportCategory {
  if (category === "profile" || category === "roleBadge") return "user";
  return category;
}

function timestampLabel(value: unknown) {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }
  return nowLabel();
}
