import { LegalPage } from "@/components/legal-page";

export default function CommunityGuidelinesScreen() {
  return (
    <LegalPage
      title={{ tr: "Topluluk Kuralları", en: "Community Guidelines", ru: "Правила сообщества", uz: "Hamjamiyat qoidalari" }}
      body={{
        tr: "Art Atlas topluluğu sanat, saygı ve keşif üzerine kuruludur. Hakaret, küfür, nefret söylemi, spam, sahte profil, izinsiz telifli görsel yükleme ve kullanıcıları yanıltan içerikler kabul edilmez. Keşfet gönderilerini ve profilleri uygulama içinden bildirebilirsiniz; incelemeler moderasyon kuyruğuna düşer.",
        en: "The Art Atlas community is built around art, respect, and discovery. Insults, hate speech, spam, fake profiles, unauthorized copyrighted uploads, and misleading content are not allowed. You can report Discover posts and profiles in the app; reports go to the moderation queue.",
        ru: "Сообщество Art Atlas строится на искусстве, уважении и открытии. Оскорбления, спам, фейковые профили, контент без прав и вводящие в заблуждение материалы запрещены.",
        uz: "Art Atlas hamjamiyati san'at, hurmat va kashfiyot asosida qurilgan. Haqorat, spam, soxta profil, ruxsatsiz mualliflik kontenti va chalg'ituvchi ma'lumotlar qabul qilinmaydi."
      }}
    />
  );
}
