import { legalTexts, mergeStoreLegalTexts, type LocalizedLegal } from "./store-legal";

const subscriptionTerms: LocalizedLegal = {
  tr: " Premium abonelik satın alma, yenileme, yönetme ve iptal işlemleri App Store ve Apple Account koşullarına tabidir.",
  en: " Premium subscription purchases, renewals, management, and cancellations are governed by the App Store and Apple Account terms.",
  ru: " Покупка, продление, управление и отмена Premium-подписки регулируются условиями App Store и Apple Account.",
  uz: " Premium obunasini sotib olish, yangilash, boshqarish va bekor qilish App Store hamda Apple Account shartlariga bo‘ysunadi."
};

export const storeLegalTexts = mergeStoreLegalTexts(subscriptionTerms, {
  tr: `${legalTexts.permissions.tr} iOS izleme izni Apple'ın sistem istemi üzerinden yönetilir.`,
  en: `${legalTexts.permissions.en} The iOS tracking permission is managed through Apple's system prompt.`,
  ru: `${legalTexts.permissions.ru} Разрешение на отслеживание в iOS управляется через системный запрос Apple.`,
  uz: `${legalTexts.permissions.uz} iOS kuzatuv ruxsati Apple tizim so'rovi orqali boshqariladi.`
});
