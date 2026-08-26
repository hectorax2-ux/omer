/**
 * Seeds appSettings/ads and one ad document per active placement.
 * Run from repo root: node firebase/functions/scripts/seed-ads.cjs
 *
 * Env (optional — production should set real AdMob unit IDs):
 *   ADMOB_BANNER_UNIT_ID
 *   ADMOB_INTERSTITIAL_UNIT_ID
 *   ADMOB_REWARDED_UNIT_ID
 */
const path = require("path");
const auth = require(path.join(__dirname, "../node_modules/firebase-tools/lib/auth"));
const { requireAuth } = require(path.join(__dirname, "../node_modules/firebase-tools/lib/requireAuth"));
const { getAccessToken } = require(path.join(__dirname, "../node_modules/firebase-tools/lib/apiv2"));

const PROJECT_ID = "artco-62499";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const isProductionSeed = process.env.SEED_ADS_PRODUCTION === "1";

const TEST_BANNER = "ca-app-pub-3940256099942544/6300978111";
const TEST_INTERSTITIAL = "ca-app-pub-3940256099942544/1033173712";
const TEST_REWARDED = "ca-app-pub-3940256099942544/5224354917";

function resolveUnit(kind) {
  const envKey = kind === "banner"
    ? process.env.ADMOB_BANNER_UNIT_ID
    : kind === "interstitial"
      ? process.env.ADMOB_INTERSTITIAL_UNIT_ID
      : process.env.ADMOB_REWARDED_UNIT_ID;
  const trimmed = envKey?.trim() ?? "";
  if (trimmed) {
    return trimmed;
  }
  if (isProductionSeed) {
    return "";
  }
  return kind === "banner" ? TEST_BANNER : kind === "interstitial" ? TEST_INTERSTITIAL : TEST_REWARDED;
}

const BANNER_UNIT = resolveUnit("banner");
const INTERSTITIAL_UNIT = resolveUnit("interstitial");
const REWARDED_UNIT = resolveUnit("rewarded");

const SAMPLE_IMAGE =
  "https://images.unsplash.com/photo-1519682337058-a94d519337bc?auto=format&fit=crop&w=800&q=80";

const DEFAULT_AD_SETTINGS = {
  interstitialPageInterval: 5,
  interstitialCooldownSeconds: 90,
  bottomSheetCooldownSeconds: 75,
  feedInlineInterval: 10
};

const PLACEMENTS = [
  { id: "ad-home-manual", placement: "home_manual", group: "banner", deliveryType: "manual", title: "Art Atlas — Sanat keşfi" },
  { id: "ad-category-top", placement: "category_top", group: "banner", deliveryType: "admob", title: "Üst banner (AdMob)", admobUnitId: BANNER_UNIT },
  { id: "ad-category-footer", placement: "category_footer", group: "banner", deliveryType: "admob", title: "Alt banner (AdMob)", admobUnitId: BANNER_UNIT },
  { id: "ad-discover-inline", placement: "discover_inline", group: "banner", deliveryType: "admob", title: "Keşfet satır arası (AdMob)", admobUnitId: BANNER_UNIT },
  { id: "ad-profile-banner", placement: "profile_banner", group: "banner", deliveryType: "admob", title: "Profil banner (AdMob)", admobUnitId: BANNER_UNIT },
  { id: "ad-weekly-top", placement: "weekly_top", group: "banner", deliveryType: "admob", title: "Yarışma üst (AdMob)", admobUnitId: BANNER_UNIT },
  { id: "ad-artwork-bottom", placement: "artwork_detail_bottom", group: "banner", deliveryType: "admob", title: "Eser detay alt (AdMob)", admobUnitId: BANNER_UNIT },
  { id: "ad-books-films", placement: "books_films", group: "banner", deliveryType: "manual", title: "Kitap & film önerileri" },
  { id: "ad-support", placement: "support", group: "banner", deliveryType: "manual", title: "Art Atlas Premium" },
  { id: "ad-popup-interstitial", placement: "popup_interstitial", group: "overlay", deliveryType: "admob", title: "Sayfa geçiş pop-up (AdMob)", admobUnitId: INTERSTITIAL_UNIT },
  { id: "ad-quiz-start", placement: "quiz_start", group: "overlay", deliveryType: "manual", title: "Quiz başlıyor", body: "Hazır mısın? Bilgini test et ve puan kazan." },
  { id: "ad-quiz-finish", placement: "quiz_finish", group: "overlay", deliveryType: "manual", title: "Tebrikler!", body: "Skorunu paylaş ve sıralamada yüksel." },
  { id: "ad-artwork-sheet", placement: "artwork_detail_sheet", group: "overlay", deliveryType: "manual", title: "Bu eseri beğendin mi?", body: "Favorilere ekle ve kişisel müzeni oluştur." },
  { id: "ad-rewarded-boost", placement: "admob_rewarded", group: "rewarded", deliveryType: "admob", title: "Ödüllü reklam (boost)", admobUnitId: REWARDED_UNIT }
];

function toFirestoreValue(value) {
  if (value === null || value === undefined) {
    return { nullValue: null };
  }
  if (typeof value === "string") {
    return { stringValue: value };
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === "boolean") {
    return { booleanValue: value };
  }
  throw new Error(`Unsupported value type: ${typeof value}`);
}

function toFirestoreFields(obj) {
  const fields = {};
  for (const [key, value] of Object.entries(obj)) {
    fields[key] = toFirestoreValue(value);
  }
  return fields;
}

function adPayload(entry) {
  const isOverlay = entry.group === "overlay";
  const type = entry.deliveryType === "admob" ? "admob" : isOverlay ? "popup" : "manualBanner";
  const admobUnitId = entry.admobUnitId || "";
  const deliveryType = entry.deliveryType === "admob" && !admobUnitId ? "manual" : entry.deliveryType;

  return {
    title: entry.title,
    placement: entry.placement,
    slot: entry.placement,
    type: deliveryType === "admob" ? "admob" : type,
    deliveryType,
    imageURL: deliveryType === "manual" ? SAMPLE_IMAGE : "",
    image: deliveryType === "manual" ? SAMPLE_IMAGE : "",
    linkURL: "https://artatlas.app",
    link: "https://artatlas.app",
    body: entry.body || "",
    admobUnitId,
    language: "all",
    status: "published",
    hideForPremium: true,
    pinned: false
  };
}

async function patchDocument(token, docPath, data) {
  const url = `${BASE}/${docPath}?updateMask.fieldPaths=${Object.keys(data).map(encodeURIComponent).join("&updateMask.fieldPaths=")}`;
  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ fields: toFirestoreFields(data) })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PATCH ${docPath} failed (${response.status}): ${text}`);
  }
}

async function main() {
  const account = auth.getGlobalDefaultAccount();
  if (!account) {
    throw new Error("Firebase CLI oturumu yok. Önce `npx firebase-tools login` çalıştırın.");
  }

  await requireAuth({
    project: PROJECT_ID,
    user: account.user,
    tokens: account.tokens
  });

  const token = await getAccessToken();

  if (isProductionSeed && (!BANNER_UNIT || !INTERSTITIAL_UNIT || !REWARDED_UNIT)) {
    throw new Error("SEED_ADS_PRODUCTION=1 requires ADMOB_BANNER_UNIT_ID, ADMOB_INTERSTITIAL_UNIT_ID, ADMOB_REWARDED_UNIT_ID.");
  }

  await patchDocument(token, "appSettings/ads", DEFAULT_AD_SETTINGS);

  for (const entry of PLACEMENTS) {
    await patchDocument(token, `ads/${entry.id}`, adPayload(entry));
  }

  console.log(`Seeded appSettings/ads and ${PLACEMENTS.length} ad documents in ${PROJECT_ID}.`);
  if (!isProductionSeed) {
    console.log("Preview/test AdMob units used. For production seed: set ADMOB_* env vars and SEED_ADS_PRODUCTION=1.");
  }
}

main().catch((error) => {
  console.error("Seed failed:", error.message || error);
  process.exit(1);
});
