import { LegalPage } from "@/components/legal-page";
import { storeLegalTexts } from "@/constants/store-legal-platform";

export default function TermsOfUseScreen() {
  return (
    <LegalPage
      title={{ tr: "Kullanım Şartları", en: "Terms of Service", ru: "Условия использования", uz: "Foydalanish shartlari" }}
      body={storeLegalTexts.terms}
    />
  );
}
