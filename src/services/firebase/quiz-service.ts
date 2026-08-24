import { QuizDocument } from "@/src/types/firestore";
import { createDocument, deleteDocument, firestoreQuery, getDocument, listDocuments, updateDocument } from "@/src/services/firebase/firestore-helpers";

export async function getQuizDocument(id: string): Promise<QuizDocument | null> {
  return getDocument<QuizDocument>("quizzes", id);
}

export async function listPublishedQuizzes(type?: QuizDocument["type"], maxResults = 20): Promise<QuizDocument[]> {
  return listDocuments<QuizDocument>("quizzes", [
    firestoreQuery.where("status", "==", "published"),
    ...(type ? [firestoreQuery.where("type", "==", type)] : []),
    firestoreQuery.orderBy("publishedAt", "desc"),
    firestoreQuery.limit(maxResults)
  ]);
}

export async function createQuizDocument(input: Omit<QuizDocument, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<string> {
  return createDocument<QuizDocument>("quizzes", input);
}

export async function updateQuizDocument(id: string, input: Partial<Omit<QuizDocument, "id" | "createdAt" | "updatedAt">>): Promise<void> {
  return updateDocument<QuizDocument>("quizzes", id, input);
}

export async function deleteQuizDocument(id: string): Promise<void> {
  return deleteDocument("quizzes", id);
}
