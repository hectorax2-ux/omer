import { legalTexts, mergeStoreLegalTexts, type LocalizedLegal } from "./store-legal";

const subscriptionTerms: LocalizedLegal = {
  tr: " Premium abonelik satın alma, yenileme, yönetme ve iptal işlemleri Google Play koşullarına tabidir.",
  en: " Premium subscription purchases, renewals, management, and cancellations are governed by Google Play terms.",
  ru: " Покупка, продление, управление и отмена Premium-подписки регулируются условиями Google Play.",
  uz: " Premium obunasini sotib olish, yangilash, boshqarish va bekor qilish Google Play shartlariga bo‘ysunadi."
};

export const storeLegalTexts = mergeStoreLegalTexts(subscriptionTerms, {
  tr: `${legalTexts.permissions.tr} Android reklam kimliği tercihleri Google Play ve cihaz ayarlarından yönetilir.`,
  en: `${legalTexts.permissions.en} Android advertising ID preferences are managed through Google Play and device settings.`,
  ru: `${legalTexts.permissions.ru} Настройки рекламного идентификатора Android управляются через Google Play и настройки устройства.`,
  uz: `${legalTexts.permissions.uz} Android reklama identifikatori tanlovlari Google Play va qurilma sozlamalari orqali boshqariladi.`
});
