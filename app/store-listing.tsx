import { LegalPage } from "@/components/legal-page";

export default function StoreListingScreen() {
  return (
    <LegalPage
      title={{ tr: "Mağaza Metinleri", en: "Store Listing Copy", ru: "Тексты магазина", uz: "Do'kon matnlari" }}
      body={{
        tr: "Uygulama adı: Art Atlas\nKısa açıklama: Sanat tarihini keşfet, eserleri oku, quizlerle bilgini ölç ve sanat topluluğuna katıl.\nUzun açıklama: Art Atlas; sanat tarihini, müze kültürünü, sanat yazılarını, quizleri, haftalık görsel seçkilerini ve sanat odaklı profilleri tek bir premium mobil deneyimde birleştirir. Kullanıcılar eserleri okuyabilir, sanat yazıları paylaşabilir, kitap ve film önerilerini keşfedebilir, haftalık seçimlere katılabilir ve profiller üzerinden sanat topluluğunu takip edebilir.\nAnahtar kelimeler: sanat, sanat tarihi, müze, resim, quiz, kültür, sanatçı, galeri, kitap, film.",
        en: "App name: Art Atlas\nShort description: Discover art history, read artworks, test your knowledge with quizzes, and join an art community.\nFull description: Art Atlas brings art history, museum culture, art essays, quizzes, image contests, and art-focused profiles into one refined mobile experience. Members can read artworks, share art writing, explore book and film recommendations, join image contests, and follow creative profiles.\nKeywords: art, art history, museum, painting, quiz, culture, artist, gallery, book, film.",
        ru: "Название: Art Atlas\nКраткое описание: Открывайте историю искусства, читайте об искусстве, проходите викторины и присоединяйтесь к арт-сообществу.\nКлючевые слова: искусство, музей, живопись, культура, художник, галерея.",
        uz: "Ilova nomi: Art Atlas\nQisqa tavsif: San'at tarixini kashf eting, asarlarni o'qing, quizlar bilan bilimingizni sinang va san'at hamjamiyatiga qo'shiling.\nKalit so'zlar: san'at, san'at tarixi, muzey, rasm, quiz, madaniyat."
      }}
    />
  );
}
