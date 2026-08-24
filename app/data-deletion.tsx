import { LegalPage } from "@/components/legal-page";
import { dataDeletionLegalTexts } from "@/constants/store-legal";

export default function DataDeletionScreen() {
  return (
    <LegalPage
      title={{ tr: "Veri Silme Talebi", en: "Data Deletion Request", ru: "Удаление данных", uz: "Ma'lumotlarni o'chirish" }}
      body={dataDeletionLegalTexts}
    />
  );
}
