import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { firestoreDb } from "./core";
import { AdminBadgeId, RoleBadgeDocument, SystemBadgeId, UserRole } from "@/src/types/firestore";
import { createDocument, deleteDocument, firestoreQuery, listDocuments, updateDocument } from "@/src/services/firebase/firestore-helpers";

export async function listActiveRolesBadges(): Promise<RoleBadgeDocument[]> {
  return listDocuments<RoleBadgeDocument>("rolesBadges", [
    firestoreQuery.where("active", "==", true),
    firestoreQuery.orderBy("kind", "asc")
  ]);
}

export async function createRoleBadgeDefinition(input: Omit<RoleBadgeDocument, "createdAt" | "updatedAt">): Promise<string> {
  return createDocument<RoleBadgeDocument>("rolesBadges", input);
}

export async function updateRoleBadgeDefinition(id: string, input: Partial<Omit<RoleBadgeDocument, "id" | "createdAt" | "updatedAt">>): Promise<void> {
  return updateDocument<RoleBadgeDocument>("rolesBadges", id, input);
}

export async function deleteRoleBadgeDefinition(id: string): Promise<void> {
  return deleteDocument("rolesBadges", id);
}

export async function assignUserRole(userId: string, role: UserRole): Promise<void> {
  await updateDoc(doc(firestoreDb, "users", userId), {
    role,
    updatedAt: serverTimestamp()
  });
}

export async function setUserBadges(userId: string, systemBadges: SystemBadgeId[], adminBadges: AdminBadgeId[]): Promise<void> {
  const badges = Array.from(new Set([...systemBadges, ...adminBadges]));
  await updateDoc(doc(firestoreDb, "users", userId), {
    badges,
    systemBadges,
    adminBadges,
    updatedAt: serverTimestamp()
  });
}
