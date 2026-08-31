import { Language } from "@/types/content";
import { authErrorCode } from "@/utils/auth-lifecycle";

const messages = {
  credentials: { tr: "E-posta veya şifre hatalı. Bilgilerini kontrol edip tekrar dene.", en: "Incorrect email or password. Check your details and try again.", ru: "Неверный e-mail или пароль. Проверьте данные и повторите попытку.", uz: "E-pochta yoki parol noto‘g‘ri. Ma’lumotlarni tekshirib, qayta urining." },
  email: { tr: "Geçerli bir e-posta adresi yaz.", en: "Enter a valid email address.", ru: "Введите корректный e-mail.", uz: "To‘g‘ri e-pochta manzilini kiriting." },
  exists: { tr: "Bu e-posta zaten kayıtlı. Giriş yapabilir veya şifreni sıfırlayabilirsin.", en: "This email is already registered. Sign in or reset your password.", ru: "Этот e-mail уже зарегистрирован. Войдите или сбросьте пароль.", uz: "Bu e-pochta ro‘yxatdan o‘tgan. Kiring yoki parolni tiklang." },
  password: { tr: "Şifre en az 6 karakter olmalı.", en: "Use a password with at least 6 characters.", ru: "Пароль должен содержать не менее 6 символов.", uz: "Parol kamida 6 belgidan iborat bo‘lsin." },
  network: { tr: "Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.", en: "Could not connect. Check your connection and try again.", ru: "Нет соединения. Проверьте интернет и повторите попытку.", uz: "Ulanib bo‘lmadi. Internetni tekshirib, qayta urining." },
  disabled: { tr: "Bu hesap devre dışı. Destek ekibiyle iletişime geç.", en: "This account is disabled. Please contact support.", ru: "Аккаунт отключён. Обратитесь в поддержку.", uz: "Hisob o‘chirilgan. Yordam xizmatiga murojaat qiling." },
  attempts: { tr: "Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.", en: "Too many attempts. Wait a little and try again.", ru: "Слишком много попыток. Подождите и повторите.", uz: "Urinishlar juda ko‘p. Biroz kutib, qayta urining." },
  provider: { tr: "Bu e-posta başka bir giriş yöntemine bağlı. Daha önce kullandığın yöntemle giriş yap.", en: "This email uses another sign-in method. Use the method you registered with.", ru: "E-mail связан с другим способом входа. Используйте прежний способ.", uz: "Bu e-pochta boshqa kirish usuliga bog‘langan. Avvalgi usulingizdan foydalaning." },
  configuration: { tr: "Giriş hizmeti şu anda kullanılamıyor. Uygulama güncelse destek ekibine bildir.", en: "Sign-in is unavailable. If your app is up to date, contact support.", ru: "Вход недоступен. Если приложение обновлено, обратитесь в поддержку.", uz: "Kirish xizmati mavjud emas. Ilova yangilangan bo‘lsa, yordamga murojaat qiling." },
  storage: { tr: "Güvenli oturum kaydedilemiyor. Cihazdaki boş alanı ve tarayıcı depolama iznini kontrol edip yeniden dene.", en: "Your session cannot be saved securely. Check free space and browser storage access, then retry.", ru: "Не удаётся сохранить сеанс. Проверьте свободное место и доступ к хранилищу браузера.", uz: "Sessiyani xavfsiz saqlab bo‘lmayapti. Bo‘sh joy va brauzer xotirasi ruxsatini tekshiring." },
  popup: { tr: "Giriş penceresine izin verip tekrar dene.", en: "Allow the sign-in popup and try again.", ru: "Разрешите всплывающее окно входа и повторите.", uz: "Kirish oynasiga ruxsat berib, qayta urining." },
  token: { tr: "Giriş yetkisi yenilenemedi. Hesabını tekrar seçip dene.", en: "Sign-in could not be verified. Select your account again.", ru: "Не удалось подтвердить вход. Выберите аккаунт заново.", uz: "Kirish tasdiqlanmadi. Hisobingizni qayta tanlang." },
  googleIncomplete: { tr: "Google ile giriş tamamlanamadı. Tekrar deneyin; sorun sürerse destek ekibine bildirin.", en: "Google sign-in did not complete. Try again; if it persists, contact support.", ru: "Вход через Google не завершён. Повторите попытку или обратитесь в поддержку.", uz: "Google orqali kirish yakunlanmadi. Qayta urining yoki yordamga murojaat qiling." },
  unknown: { tr: "Giriş tamamlanamadı. Tekrar dene; sürerse destek ekibine bildir.", en: "Sign-in could not finish. Try again; if it persists, contact support.", ru: "Не удалось завершить вход. Повторите попытку или обратитесь в поддержку.", uz: "Kirish yakunlanmadi. Qayta urining yoki yordamga murojaat qiling." }
};

export function getAuthErrorMessage(error: unknown, language: Language, provider = false) {
  const code = authErrorCode(error);
  if (["auth/popup-closed-by-user", "auth/cancelled-popup-request", "SIGN_IN_CANCELLED", "ERR_REQUEST_CANCELED"].includes(code)) return "";
  const key = code === "auth/invalid-email" ? "email"
    : code === "auth/email-already-in-use" ? "exists"
    : code === "auth/weak-password" ? "password"
    : ["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found"].includes(code) ? (provider ? "token" : "credentials")
    : ["auth/network-request-failed", "unavailable"].includes(code) ? "network"
    : code === "auth/user-disabled" ? "disabled"
    : code === "auth/too-many-requests" ? "attempts"
    : code === "auth/account-exists-with-different-credential" ? "provider"
    : code === "auth/persistence-unavailable" || code === "auth/web-storage-unsupported" ? "storage"
    : code === "auth/popup-blocked" ? "popup"
    : ["auth/operation-not-allowed", "auth/unauthorized-domain", "auth/invalid-api-key", "auth/app-not-authorized", "DEVELOPER_ERROR", "PLAY_SERVICES_NOT_AVAILABLE"].includes(code) ? "configuration"
    : code === "google/sign-in-not-completed" || code === "google/no-credential" ? "googleIncomplete"
    : code === "ERR_REQUEST_FAILED" || code === "google/missing-id-token" ? "token" : "unknown";
  return messages[key][language];
}
