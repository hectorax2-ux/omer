import { ReportDocument } from "@/src/types/firestore";
import { createDocument, firestoreQuery, listDocuments, updateDocument } from "@/src/services/firebase/firestore-helpers";

export async function createReport(input: Omit<ReportDocument, "id" | "createdAt" | "updatedAt" | "status">): Promise<string> {
  return createDocument<ReportDocument>("reports", {
    ...input,
    status: "open"
  });
}

export async function listOpenReports(maxResults = 50): Promise<ReportDocument[]> {
  return listDocuments<ReportDocument>("reports", [
    firestoreQuery.where("status", "in", ["open", "reviewing"]),
    firestoreQuery.orderBy("createdAt", "desc"),
    firestoreQuery.limit(maxResults)
  ]);
}

export async function updateReportStatus(id: string, status: ReportDocument["status"]): Promise<void> {
  return updateDocument<ReportDocument>("reports", id, { status });
}
