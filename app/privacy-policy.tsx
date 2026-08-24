import { LegalPage } from "@/components/legal-page";
import { legalTexts } from "@/constants/store-legal";

export default function PrivacyPolicyScreen() {
  return (
    <LegalPage
      title={{ tr: "Gizlilik Politikası", en: "Privacy Policy", ru: "Политика конфиденциальности", uz: "Maxfiylik siyosati" }}
      body={legalTexts.privacy}
    />
  );
}
