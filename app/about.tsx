import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { AppChrome } from "@/components/app-chrome";
import { getThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLanguage } from "@/hooks/use-language";

export const aboutTopics = {
  who: {
    icon: "person-circle" as const,
    title: { tr: "Biz kimiz?", en: "Who we are", ru: "Кто мы?", uz: "Biz kimmiz?" },
    summary: {
      tr: "Art Atlas; Ömer Alan ve Mahinur Akhmedova'nın fikir, yürütme ve geliştirme çalışmalarıyla Taşkent'te büyüyen bir sanat ve kültür projesidir.",
      en: "Art Atlas is a Tashkent-based art and culture project shaped and developed by Omer Alan and Mahinur Akhmedova.",
      ru: "Art Atlas — ташкентский проект об искусстве и культуре, созданный и развиваемый Омером Аланом и Махинур Ахмедовой.",
      uz: "Art Atlas — Omer Alan va Mahinur Akhmedovaning g'oya, boshqaruv va rivojlantirish ishlari bilan Toshkentda taraqqiy etayotgan san'at va madaniyat loyihasi."
    },
    body: {
      tr: "Art Atlas, Özbekistan Taşkent merkezli; sanat tarihi, görsel kültür ve dijital keşif odağında gelişen çok dilli bir sanat ve kültür platformudur. Proje; Türk sanat araştırmacısı ve yazarı Ömer Alan ile projenin yürütülmesi, geliştirilmesi ve fikir aşamalarında görev alan Mahinur Akhmedova'nın ortak çalışmalarıyla şekillenmiştir. Bizim için sanat yalnızca müzelerde korunan bir miras değil; insanın bakışını incelten, düşüncesini derinleştiren ve farklı coğrafyalar arasında zarif köprüler kuran yaşayan bir dildir. Art Atlas, bu dili mobil dünyada daha erişilebilir, daha düzenli ve daha seçkin bir deneyime dönüştürmek için hazırlanmıştır.",
      en: "Art Atlas is a multilingual art history and culture platform based in Tashkent, Uzbekistan. It has been shaped by Turkish art researcher and writer Omer Alan together with Mahinur Akhmedova, who contributes to the project's direction, development, and ideas. The platform presents art in an accessible and reliable voice while building cultural bridges across regions.",
      ru: "Art Atlas — многоязычная платформа об истории искусства и культуре, созданная в Ташкенте. Проект сформирован совместной работой турецкого исследователя и автора Омера Алана и Махинур Ахмедовой, участвующей в управлении, развитии и формировании идей проекта. Наша цель — рассказывать об искусстве ясно, изящно и достоверно.",
      uz: "Art Atlas — O'zbekistonning Toshkent shahrida rivojlanayotgan ko'p tilli san'at tarixi va madaniyat platformasi. Loyiha turk san'at tadqiqotchisi va yozuvchisi Omer Alan hamda loyihani boshqarish, rivojlantirish va g'oyalarini shakllantirishda qatnashayotgan Mahinur Akhmedovaning hamkorligida yaratilgan. Platforma san'atni tushunarli, ta'sirli va ishonchli tarzda taqdim etadi."
    }
  },
  vision: {
    icon: "sparkles" as const,
    title: { tr: "Vizyon", en: "Vision", ru: "Видение", uz: "Maqsad" },
    summary: {
      tr: "Art Atlas, sanat tarihini kısa, anlaşılır ve keşfedilebilir bir deneyime dönüştürür.",
      en: "Art Atlas turns art history into a concise, clear, and discoverable experience.",
      ru: "Art Atlas превращает историю искусства в понятный и удобный опыт.",
      uz: "Art Atlas san'at tarixini sodda va kashf etiladigan tajribaga aylantiradi."
    },
    body: {
      tr: "Art Atlas, sanat tarihini yalnızca bilgi veren bir alan olarak değil, günlük keşif alışkanlığına dönüşen yaşayan bir deneyim olarak kurgular. Kullanıcılar eserleri okuyabilir, müzeleri keşfedebilir, haftalık resim seçimlerine katılabilir, testlerle bilgisini ölçebilir ve sanatla ilgilenen profilleri takip edebilir. Amacımız sanat bilgisini ağır, karmaşık ve ulaşılması zor bir yapıdan çıkarıp sade, seçkin ve düzenli bir mobil deneyime dönüştürmektir.",
      en: "Art Atlas is designed to make art history a living discovery habit rather than a static information archive. Members can read artworks, explore museums, join weekly image selections, test their knowledge, and follow art-focused profiles.",
      ru: "Art Atlas делает историю искусства живым опытом: пользователи читают об искусстве, открывают музеи, участвуют в недельных подборках и проходят тесты.",
      uz: "Art Atlas san'at tarixini kundalik kashfiyotga aylantiradi: foydalanuvchilar asarlarni o'qiydi, muzeylarni ko'radi, haftalik tanlovlarda qatnashadi va testlardan o'tadi."
    }
  },
  games: {
    icon: "game-controller" as const,
    title: { tr: "Nasıl oynanır?", en: "How to play", ru: "Как играть", uz: "Qanday o'ynaladi" },
    summary: {
      tr: "Oyunlarda hızlı karar ver ve haftalık yarışmada ilk puanını koru.",
      en: "Make quick choices in games and keep your first weekly challenge score.",
      ru: "Быстро отвечайте в играх и сохраните первый результат недельного конкурса.",
      uz: "O'yinlarda tez javob bering va haftalik tanlovdagi birinchi ballingizni saqlang."
    },
    body: {
      tr: "Sanat Dedektifi oyununda eserin üzeri 16 kareyle kapalıdır. Kareleri tek tek açarak ipucu toplarsın; ancak her açılan kare puanını 10 düşürür. Hiç kare açmadan bilirsen 160 puan kazanırsın. Yeterince emin olduğunda alttaki şıklardan doğru eseri seçersin. Oyunlar puan yarışmasından bağımsız pratik alanı olarak tasarlanmıştır.",
      en: "In the Art Detective game the artwork is hidden behind 16 tiles. Reveal them one by one for clues, but each reveal costs 10 points. Guess with no reveals to earn 160 points, then pick the correct artwork from the options.",
      ru: "В игре Пазл произведение закрыто 16 плитками. Открывайте их по одной ради подсказок, но каждая снижает счёт на 10. Угадаете без открытий — 160 очков.",
      uz: "Yapboz o'yinida asar 16 katak bilan yopilgan. Kataklarni birma-bir oching; har biri ballni 10 ga kamaytiradi. Hech ochmasdan topsangiz 160 ball."
    }
  },
  tests: {
    icon: "trophy" as const,
    title: { tr: "Haftalık yarışma", en: "Weekly challenge", ru: "Еженедельный конкурс", uz: "Haftalik tanlov" },
    summary: {
      tr: "Haftalık yarışmada ilk tamamlanan turun puanı sıralamaya yazılır.",
      en: "The first completed weekly challenge score is added to the leaderboard.",
      ru: "Результат первого завершённого недельного конкурса попадает в рейтинг.",
      uz: "Haftalik tanlovning birinchi yakunlangan turi reytingga yoziladi."
    },
    body: {
      tr: "Haftalık yarışma belirlenen hafta içinde bir kez puan kazandırır. Kullanıcı yarışmayı tekrar çözebilir ancak sonraki denemeler sıralama puanına yansımaz.",
      en: "The weekly challenge contributes to ranking only once per week. Users may replay it, but later attempts do not update ranking points.",
      ru: "Недельный конкурс влияет на рейтинг только один раз. Повторные попытки доступны, но не меняют баллы.",
      uz: "Haftalik tanlov reytingga haftada bir marta ta'sir qiladi. Qayta urinishlar ballni o'zgartirmaydi."
    }
  },
  copyright: {
    icon: "shield-checkmark" as const,
    title: { tr: "Teliflerle ilgili", en: "Copyright", ru: "Авторские права", uz: "Mualliflik huquqi" },
    summary: {
      tr: "Art Atlas metinleri ve kullanıcı yüklemeleri için telif sorumluluklarını açık tutar.",
      en: "Art Atlas keeps copyright responsibilities clear for editorial texts and user uploads.",
      ru: "Art Atlas ясно обозначает ответственность за тексты и пользовательские загрузки.",
      uz: "Art Atlas matnlar va foydalanuvchi yuklamalari bo'yicha mualliflik mas'uliyatini aniq belgilaydi."
    },
    body: {
      tr: "Art Atlas içinde bize ait olan özgün yazılar, açıklamalar, sanat tarihi notları, seçki metinleri ve editoryal anlatımlar izinsiz olarak başka mecralarda kullanılamaz, çoğaltılamaz veya ticari amaçla yeniden yayınlanamaz. Kullanıcıların uygulamaya yüklediği resim, çizim, görsel ve açıklamaların telif sorumluluğu ise yükleyen kişiye aittir. Yükleyici, paylaştığı içeriğin kendisine ait olduğunu veya paylaşma hakkına sahip bulunduğunu kabul etmiş sayılır. Telif hakkı ihlali şüphesi bulunan içerikler destek kanalı üzerinden bildirilebilir; gerekli görülürse içerik yayından kaldırılır ve ilgili hesap incelemeye alınır.",
      en: "Original texts, artwork notes, selections, and editorial explanations created for Art Atlas may not be copied, republished, or commercially reused without permission. Copyright responsibility for images and descriptions uploaded by users belongs to the uploader.",
      ru: "Оригинальные тексты и редакционные материалы Art Atlas нельзя копировать или использовать коммерчески без разрешения. Ответственность за загруженные пользователями изображения несет загрузивший пользователь.",
      uz: "Art Atlas uchun yozilgan original matnlar va izohlar ruxsatsiz ko'chirilishi yoki tijorat maqsadida ishlatilishi mumkin emas. Foydalanuvchi yuklagan rasmlar va tavsiflar uchun mualliflik mas'uliyati yuklovchiga tegishli."
    }
  }
};

type TopicId = keyof typeof aboutTopics;

export default function AboutScreen() {
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const c = getThemeColors(theme);
  const styles = useMemo(() => createStyles(c), [c]);
  const router = useRouter();

  return (
    <AppChrome title={language === "tr" ? "Hakkında" : "About"} eyebrow="Art Atlas" showBackButton backToHome>
      {(Object.keys(aboutTopics) as TopicId[]).map((id) => {
        const topic = aboutTopics[id];
        return (
          <Pressable key={id} onPress={() => router.push({ pathname: "/about/[topic]", params: { topic: id } })} style={styles.card}>
            <Ionicons name={topic.icon} size={24} color={c.gold} />
            <View style={styles.textBlock}>
              <Text style={styles.title}>{topic.title[language]}</Text>
              <Text style={styles.text}>{topic.summary[language]}</Text>
            </View>
            <Ionicons name="chevron-forward" size={19} color={c.muted} />
          </Pressable>
        );
      })}
    </AppChrome>
  );
}

function createStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    card: { borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, padding: 16, gap: 12, marginBottom: 12, flexDirection: "row", alignItems: "center" },
    textBlock: { flex: 1 },
    title: { color: colors.ivory, fontSize: 18, fontWeight: "900" },
    text: { color: colors.muted, lineHeight: 21, fontWeight: "700", marginTop: 4 }
  });
}
