import { arrayUnion, collection, doc, getDocs, limit, onSnapshot, query, serverTimestamp, Timestamp, updateDoc, where, type QueryConstraint, type Unsubscribe } from "firebase/firestore";
import { firestoreDb } from "./core";
import { FirestoreTimestamp, SupportMessage, SupportTicketDocument } from "@/src/types/firestore";
import { createDocument, getDocument, type CreateInput } from "@/src/services/firebase/firestore-helpers";

type CreateSupportTicketInput = Omit<SupportTicketDocument, "id" | "createdAt" | "updatedAt" | "status" | "messages" | "lastMessageAt"> & {
  message: string;
  userDisplayName?: string;
};

function supportMessageTimestamp() {
  return Timestamp.now();
}

export async function createSupportTicket(input: CreateSupportTicketInput): Promise<string> {
  const trimmedName = input.userDisplayName?.trim();
  const firstMessage: SupportMessage = {
    senderId: input.userId,
    senderRole: "user",
    message: input.message.trim(),
    createdAt: supportMessageTimestamp()
  };

  const payload: CreateInput<SupportTicketDocument> = {
    userId: input.userId,
    category: input.category,
    subcategory: input.subcategory,
    subject: input.subject.trim(),
    email: input.email.trim(),
    status: "open",
    messages: [firstMessage],
    lastMessageAt: serverTimestamp() as FirestoreTimestamp
  };

  if (trimmedName) payload.userDisplayName = trimmedName;

  return createDocument<SupportTicketDocument>("supportTickets", payload);
}

function ticketTimestamp(value: unknown) {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().getTime();
  }
  return 0;
}

export function sortSupportTicketDocuments(tickets: SupportTicketDocument[]) {
  return [...tickets].sort((a, b) => {
    const lastA = ticketTimestamp(a.lastMessageAt) || ticketTimestamp(a.createdAt);
    const lastB = ticketTimestamp(b.lastMessageAt) || ticketTimestamp(b.createdAt);
    return lastB - lastA;
  });
}

export async function getSupportTicket(id: string): Promise<SupportTicketDocument | null> {
  return getDocument<SupportTicketDocument>("supportTickets", id);
}

export async function addSupportMessage(ticketId: string, message: Omit<SupportMessage, "createdAt">): Promise<void> {
  await updateDoc(doc(firestoreDb, "supportTickets", ticketId), {
    messages: arrayUnion({ ...message, createdAt: supportMessageTimestamp() }),
    lastMessageAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    status: message.senderRole === "admin" ? "answered" : "open"
  });
}

export async function updateSupportTicketStatus(id: string, status: SupportTicketDocument["status"]): Promise<void> {
  await updateDoc(doc(firestoreDb, "supportTickets", id), {
    status,
    updatedAt: serverTimestamp()
  });
}

export function subscribeSupportTickets(userId: string, isAdmin: boolean, onChange: (tickets: SupportTicketDocument[]) => void): Unsubscribe {
  const constraints: QueryConstraint[] = isAdmin
    ? [limit(100)]
    : [where("userId", "==", userId), limit(50)];

  return onSnapshot(
    query(collection(firestoreDb, "supportTickets"), ...constraints),
    (snapshot) => {
      onChange(sortSupportTicketDocuments(snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<SupportTicketDocument, "id">) }))));
    },
    () => onChange([])
  );
}

export async function listUserSupportTickets(userId: string): Promise<SupportTicketDocument[]> {
  const snapshot = await getDocs(query(collection(firestoreDb, "supportTickets"), where("userId", "==", userId), limit(50)));
  return sortSupportTicketDocuments(snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<SupportTicketDocument, "id">) })));
}
