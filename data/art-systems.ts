import { ArtDnaPoolResult, ArtDuel, ChanceCard, ProphecyWeek, SeerLevel } from "@/types/art-systems";
import { artworks, artists } from "@/data/content";

const now = Date.now();
const day = 24 * 60 * 60 * 1000;

export const demoArtDuels: ArtDuel[] = [
  {
    id: "duel-artwork-1",
    kind: "artwork",
    title: { tr: "Eser Düellosu", en: "Artwork Duel", ru: "Дуэль произведений", uz: "Asar dueli" },
    sideA: {
      id: artworks[0].id,
      title: artworks[0].title,
      subtitle: artworks[0].artist,
      image: artworks[0].image
    },
    sideB: {
      id: artworks[1].id,
      title: artworks[1].title,
      subtitle: artworks[1].artist,
      image: artworks[1].image
    },
    startsAt: new Date(now - day).toISOString(),
    endsAt: new Date(now + day).toISOString(),
    status: "active",
    active: true,
    votesA: 142,
    votesB: 118,
    notificationEnabled: true
  },
  {
    id: "duel-artist-1",
    kind: "artist",
    title: { tr: "Sanatçı Düellosu", en: "Artist Duel", ru: "Дуэль художников", uz: "San'atkor dueli" },
    sideA: {
      id: artists[0].id,
      title: artists[0].name,
      subtitle: artists[0].movement,
      image: artists[0].image
    },
    sideB: {
      id: artists[1].id,
      title: artists[1].name,
      subtitle: artists[1].movement,
      image: artists[1].image
    },
    startsAt: new Date(now - day).toISOString(),
    endsAt: new Date(now + day).toISOString(),
    status: "active",
    active: true,
    votesA: 96,
    votesB: 104,
    notificationEnabled: true
  }
];

export const demoArtworkProphecyWeek: ProphecyWeek = {
  id: "prophecy-artwork-2026-24",
  kind: "artwork",
  question: {
    tr: "Bu hafta hangi eser kazanacak?",
    en: "Which artwork will win this week?",
    ru: "Какое произведение победит на этой неделе?",
    uz: "Bu hafta qaysi asar g'olib bo'ladi?"
  },
  candidates: artworks.slice(0, 4).map((artwork) => ({
    id: artwork.id,
    title: artwork.title,
    subtitle: artwork.artist,
    image: artwork.image,
    predictions: 0
  })),
  startsAt: new Date(now - day).toISOString(),
  endsAt: new Date(now + 6 * day).toISOString()
};

export const demoArtistProphecyWeek: ProphecyWeek = {
  id: "prophecy-artist-2026-24",
  kind: "artist",
  question: {
    tr: "Bu hafta hangi sanatçı kazanacak?",
    en: "Which artist will win this week?",
    ru: "Какой художник победит на этой неделе?",
    uz: "Bu hafta qaysi san'atkor g'olib bo'ladi?"
  },
  candidates: artists.slice(0, 4).map((artist) => ({
    id: artist.id,
    title: artist.name,
    subtitle: artist.movement,
    image: artist.image,
    predictions: 0
  })),
  startsAt: new Date(now - day).toISOString(),
  endsAt: new Date(now + 6 * day).toISOString()
};

export const demoProphecyWeek = demoArtistProphecyWeek;

export const demoSeerLevels: SeerLevel[] = [
  { id: "bronze", name: { tr: "Bronz Kahin", en: "Bronze Seer", ru: "Бронзовый провидец", uz: "Bronza kohin" }, requiredPoints: 10, icon: "medal-outline" },
  { id: "silver", name: { tr: "Gümüş Kahin", en: "Silver Seer", ru: "Серебряный провидец", uz: "Kumush kohin" }, requiredPoints: 20, icon: "medal-outline" },
  { id: "gold", name: { tr: "Altın Kahin", en: "Gold Seer", ru: "Золотой провидец", uz: "Oltin kohin" }, requiredPoints: 40, icon: "trophy-outline" },
  { id: "platinum", name: { tr: "Platin Kahin", en: "Platinum Seer", ru: "Платиновый провидец", uz: "Platina kohin" }, requiredPoints: 80, icon: "diamond-outline" },
  { id: "diamond", name: { tr: "Elmas Kahin", en: "Diamond Seer", ru: "Алмазный провидец", uz: "Olmos kohin" }, requiredPoints: 160, icon: "diamond" }
];

export const demoArtDnaPools: ArtDnaPoolResult[] = [
  {
    id: "dna-reflective",
    keywords: ["mutsuz", "üzgün", "yorgun", "kararsız", "yalnız", "kırgın", "sad", "tired", "lonely"],
    movements: [
      { label: { tr: "Ekspresyonizm", en: "Expressionism", ru: "Экспрессионизм", uz: "Ekspressionizm" }, percent: 44 },
      { label: { tr: "Romantizm", en: "Romanticism", ru: "Романтизм", uz: "Romantizm" }, percent: 32 },
      { label: { tr: "Sembolizm", en: "Symbolism", ru: "Символизм", uz: "Simvolizm" }, percent: 24 }
    ],
    paragraph: {
      tr: "Bugünkü ifaden içe dönük ve duygu yoğun; sanat tarafında sessiz ama güçlü bir anlatı arıyorsun.",
      en: "Your expression feels inward and emotionally dense; you seem to seek quiet but strong artistic narratives.",
      ru: "Ваше состояние выглядит внутренним и эмоционально насыщенным.",
      uz: "Bugungi ifodangiz ichki va hissiyotga boy; sokin, ammo kuchli badiiy hikoya izlaysiz."
    },
    mood: { tr: "Günün hissi: sakinleşmek isteyen derin bir renk.", en: "Mood: a deep color looking for calm.", ru: "Настроение: глубокий цвет, ищущий покой.", uz: "Kayfiyat: tinchlik izlayotgan chuqur rang." },
    active: true
  },
  {
    id: "dna-impression",
    keywords: ["ışık", "duygu", "renk", "an", "huzur", "nature", "light"],
    movements: [
      { label: { tr: "Empresyonizm", en: "Impressionism", ru: "Импрессионизм", uz: "Impressionizm" }, percent: 46 },
      { label: { tr: "Post-Empresyonizm", en: "Post-Impressionism", ru: "Постимпрессионизм", uz: "Post-impressionizm" }, percent: 34 },
      { label: { tr: "Romantizm", en: "Romanticism", ru: "Романтизм", uz: "Romantizm" }, percent: 20 }
    ],
    paragraph: {
      tr: "Bakışın ışığın değişen ruhuna yakın duruyor; detaydan çok atmosferi ve hissi takip ediyorsun.",
      en: "Your gaze follows atmosphere and feeling more than strict detail, close to the changing soul of light.",
      ru: "Ваш взгляд ближе к атмосфере и чувству, чем к строгой детали.",
      uz: "Nigohingiz qat'iy detaldan ko'ra muhit va hissiyotga yaqin."
    },
    mood: { tr: "Günün hissi: açık mavi bir sessizlik.", en: "Mood: a clear blue silence.", ru: "Настроение: ясная синяя тишина.", uz: "Kayfiyat: tiniq moviy sokinlik." },
    active: true
  },
  {
    id: "dna-baroque",
    keywords: ["drama", "güç", "karanlık", "hareket", "ışık", "contrast"],
    movements: [
      { label: { tr: "Barok", en: "Baroque", ru: "Барокко", uz: "Barokko" }, percent: 54 },
      { label: { tr: "Rönesans", en: "Renaissance", ru: "Ренессанс", uz: "Renessans" }, percent: 28 },
      { label: { tr: "Realizm", en: "Realism", ru: "Реализм", uz: "Realizm" }, percent: 18 }
    ],
    paragraph: {
      tr: "Anlatımında güçlü kontrastlar, yoğun duygu ve sahne hissi öne çıkıyor.",
      en: "Your expression leans toward strong contrast, emotion, and a sense of staging.",
      ru: "В вашем выражении сильны контраст, эмоция и сценичность.",
      uz: "Ifodangiz kuchli kontrast, hissiyot va sahna tuyg'usiga yaqin."
    },
    mood: { tr: "Günün hissi: altın ışıklı bir perde.", en: "Mood: a curtain lit by gold.", ru: "Настроение: занавес в золотом свете.", uz: "Kayfiyat: oltin nurli parda." },
    active: true
  }
];

export const demoChanceCards: ChanceCard[] = [
  { id: "points-10", type: "points", value: 10, probability: 28, active: true, title: { tr: "+10 puan", en: "+10 points", ru: "+10 очков", uz: "+10 ball" }, description: { tr: "Hesabına küçük bir sanat puanı eklenir.", en: "A small art point bonus.", ru: "Небольшой бонус очков.", uz: "Kichik ball bonusi." } },
  { id: "points-25", type: "points", value: 25, probability: 18, active: true, title: { tr: "+25 puan", en: "+25 points", ru: "+25 очков", uz: "+25 ball" }, description: { tr: "Daha güçlü bir günlük ödül.", en: "A stronger daily reward.", ru: "Более сильная ежедневная награда.", uz: "Kuchliroq kunlik mukofot." } },
  { id: "points-50", type: "points", value: 50, probability: 8, active: true, title: { tr: "+50 puan", en: "+50 points", ru: "+50 очков", uz: "+50 ball" }, description: { tr: "Nadir puan kartı.", en: "A rare point card.", ru: "Редкая карта очков.", uz: "Noyob ball kartasi." } },
  { id: "frame", type: "profile_frame", probability: 12, active: true, title: { tr: "Profil çerçevesi", en: "Profile frame", ru: "Рамка профиля", uz: "Profil ramkasi" }, description: { tr: "Profilin için özel çerçeve hakkı.", en: "A special frame for your profile.", ru: "Особая рамка профиля.", uz: "Profil uchun maxsus ramka." } },
  { id: "boost", type: "showcase_boost", probability: 10, active: true, title: { tr: "Vitrin öne çıkarma", en: "Showcase boost", ru: "Продвижение витрины", uz: "Vitrin oldinga chiqarish" }, description: { tr: "Sanatçı vitrinin için öne çıkarma hakkı.", en: "A boost for your artist showcase.", ru: "Продвижение витрины.", uz: "Vitrinni oldinga chiqarish." } },
  { id: "seer", type: "seer_points", value: 1, probability: 10, active: true, title: { tr: "Kahin puanı", en: "Seer point", ru: "Очко провидца", uz: "Kohin balli" }, description: { tr: "Kahin rozet yolculuğuna +1.", en: "+1 toward Seer badges.", ru: "+1 к значкам провидца.", uz: "Kohin nishoniga +1." } },
  { id: "collection", type: "collection_badge", probability: 6, active: true, title: { tr: "Koleksiyon rozeti", en: "Collection badge", ru: "Значок коллекции", uz: "Kolleksiya nishoni" }, description: { tr: "Koleksiyon temalı özel hak.", en: "A collection-themed reward.", ru: "Награда коллекции.", uz: "Kolleksiya mukofoti." } },
  { id: "extra-duel", type: "extra_duel", probability: 8, active: true, title: { tr: "Ek düello hakkı", en: "Extra duel right", ru: "Дополнительная дуэль", uz: "Qo'shimcha duel" }, description: { tr: "Düello sistemlerinde özel hak.", en: "A special duel-system right.", ru: "Особое право в дуэлях.", uz: "Duel tizimida maxsus huquq." } }
];
