// Added Apple Sign In
import { createContext, PropsWithChildren, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import { FirebaseError } from "firebase/app";
import { applyActionCode, checkActionCode, getIdToken, onAuthStateChanged, reload, updateProfile, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { BadgeId, UserRoleId } from "@/constants/profile-taxonomy";
import { normalizeDisplayName, normalizeUsername } from "@/constants/account-limits";
import { useRegisterRefresh } from "@/providers/refresh-provider";
import {
  FirebaseUserProfile,
  deleteUserAccount,
  firebaseAuth,
  firebaseAuthReady,
  firestoreDb,
  getOrCreateUserProfile,
  getUserProfile,
  loginWithAppleIdentityToken,
  loginWithApplePopup,
  loginWithEmail,
  loginWithGoogleIdToken,
  loginWithGooglePopup,
  logout as firebaseLogout,
  normalizeUserProfile,
  registerWithEmail,
  requestEmailChange,
  resetPassword,
  sendEmailVerification,
  syncUserIdentityDenormalizedFields,
  syncUserCountryDenormalizedFields,
  scrubPublicProfileEmail,
  updateUserProfile,
  uploadProfilePhoto,
  deleteOwnedProfilePhoto,
  DeleteAccountInput
} from "@/src/services/firebase";
import { saveQuizAttempt } from "@/src/services/firebase/quiz-week-service";
import { loadMemberScore, quizParticipationPoints } from "@/src/services/firebase/member-score-service";
import { syncPremiumStatusRemote } from "@/src/services/firebase/premium-purchase-service";
import { restoreGooglePlayPremiumAtLaunch } from "@/src/services/purchase/google-play-premium-sync";
import { isPremiumProfileActive } from "@/utils/premium-status";
import { extractWeekPeriodId } from "../firebase/shared/competition-week";
import { parseUserRestrictions, UserRestrictionRecord } from "@/utils/user-restrictions";
import { invalidateCountryCache } from "@/utils/country-cache";
import { getCountryProfileFields, resolveCountryCode } from "@/utils/country-utils";
import { appleFullName, isAppleCancelError, isAppleSignInAvailable, requestAppleSignInCredential } from "@/utils/apple-auth";
import { signOutGoogleNativeSession } from "@/hooks/use-google-sign-in";
import { findUserByUsername } from "@/src/services/firebase/user-service";
import { disablePushDevice } from "@/src/services/firebase/push-notification-service";
import { markPerformanceEvent } from "@/utils/performance";
import { loadResourceCache, saveResourceCache } from "@/src/services/cache/resource-cache";
import { socialDisplayName, socialUsername } from "@/utils/social-auth-profile";
import { useStartupPhase } from "@/hooks/use-startup-phase";
import { isEmailVerifiedForApp } from "@/utils/email-verification";
import { authErrorCode, createAuthSessionScope, profileNeedsCompletion } from "@/utils/auth-lifecycle";
import { getAuthErrorMessage } from "@/utils/auth-error-message";
import { useLanguage } from "@/hooks/use-language";
import { logAuthStage, traceAuthStep } from "@/utils/auth-diagnostics";

export type MemberRole = UserRoleId;

export type Account = {
  uid: string;
  username: string;
  displayName: string;
  bio: string;
  country: string;
  countryCode?: string;
  city: string;
  interests: string[];
  socialLinks: {
    instagram: string;
    x: string;
    facebook: string;
    website: string;
  };
  isProfileVisible: boolean;
  isDiscoverableByCountry: boolean;
  password: string;
  role: MemberRole;
  isAdmin: boolean;
  isPremium: boolean;
  premiumExpiresAt?: string;
  isSuspended: boolean;
  badges: BadgeId[];
  staffBadges: ("moderator" | "editor")[];
  email: string;
  avatar?: string;
  avatarType?: "uploaded" | "artist" | "default";
  avatarArtistId?: string;
  totalScore: number;
  completedWeeks: string[];
  restrictions: UserRestrictionRecord[];
  profileVisitVisibility: "visible" | "anonymous";
};

export type AuthActionResult = {
  ok: boolean;
  message: string;
  requiresVerification?: boolean;
  avatarUrl?: string;
};

type CachedAccountSnapshot = {
  account: Account;
  needsProfileCompletion: boolean;
};

type AccountContextValue = {
  account: Account;
  isAuthenticated: boolean;
  isEmailVerified: boolean;
  canBrowsePublicContent: boolean;
  canUseMemberFeatures: boolean;
  pendingVerificationEmail?: string;
  authLoading: boolean;
  profileHydrated: boolean;
  profileHydrationError: boolean;
  needsProfileCompletion: boolean;
  retryProfileHydration: () => void;
  login: (email: string, password: string) => Promise<AuthActionResult>;
  register: (nextAccount: Pick<Account, "username" | "password" | "email">) => Promise<AuthActionResult>;
  verifyEmailCode: (code?: string) => Promise<AuthActionResult>;
  forgotPassword: (email: string) => Promise<AuthActionResult>;
  resendVerificationEmail: () => Promise<AuthActionResult>;
  changeAccountEmail: (email: string, currentPassword?: string) => Promise<AuthActionResult>;
  signInWithGoogle: (idToken?: string) => Promise<AuthActionResult>;
  signInWithApple: () => Promise<AuthActionResult>;
  saveAccountProfile: (nextAccount: Partial<Account> & { avatarUri?: string; completeOnboarding?: boolean; removeAvatar?: boolean }) => Promise<AuthActionResult>;
  deleteAccount: (input: DeleteAccountInput) => Promise<AuthActionResult>;
  updateAccount: (nextAccount: Partial<Account>) => void;
  logout: () => Promise<void>;
  canJoinWeeklyQuiz: (weekId: string) => boolean;
  completeWeeklyQuiz: (weekId: string, score: number, quizId?: string) => void;
};

const initialAccount: Account = {
  uid: "",
  username: "art_member",
  displayName: "Art Atlas Üyesi",
  bio: "Sanat tarihini, müzeleri ve yeni sanatçıları keşfetmeyi seviyorum.",
  password: "",
  role: "art_lover",
  isAdmin: false,
  isPremium: false,
  premiumExpiresAt: undefined,
  isSuspended: false,
  badges: [],
  staffBadges: [],
  email: "member@artatlas.app",
  avatar: undefined,
  country: "Türkiye",
  countryCode: "TR",
  city: "İstanbul",
  interests: ["Rönesans", "Müze", "Modernizm"],
  socialLinks: {
    instagram: "resimlerle.sanat",
    x: "",
    facebook: "",
    website: ""
  },
  isProfileVisible: true,
  isDiscoverableByCountry: true,
  totalScore: 0,
  completedWeeks: [],
  restrictions: [],
  profileVisitVisibility: "visible"
};

export const AccountContext = createContext<AccountContextValue>({
  account: initialAccount,
  isAuthenticated: false,
  isEmailVerified: false,
  canBrowsePublicContent: false,
  canUseMemberFeatures: false,
  pendingVerificationEmail: undefined,
  authLoading: false,
  profileHydrated: false,
  profileHydrationError: false,
  needsProfileCompletion: false,
  retryProfileHydration: () => undefined,
  login: async () => ({ ok: false, message: "" }),
  register: async () => ({ ok: false, message: "" }),
  verifyEmailCode: async () => ({ ok: false, message: "" }),
  forgotPassword: async () => ({ ok: false, message: "" }),
  resendVerificationEmail: async () => ({ ok: false, message: "" }),
  changeAccountEmail: async () => ({ ok: false, message: "" }),
  signInWithGoogle: async () => ({ ok: false, message: "" }),
  signInWithApple: async () => ({ ok: false, message: "" }),
  saveAccountProfile: async () => ({ ok: false, message: "" }),
  deleteAccount: async () => ({ ok: false, message: "" }),
  updateAccount: () => undefined,
  logout: async () => undefined,
  canJoinWeeklyQuiz: () => true,
  completeWeeklyQuiz: () => undefined
});

export function AccountProvider({ children }: PropsWithChildren) {
  const { language } = useLanguage();
  const [account, setAccount] = useState<Account>(initialAccount);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | undefined>();
  const [authLoading, setAuthLoading] = useState(true);
  const [profileHydrated, setProfileHydrated] = useState(false);
  const [profileHydrationError, setProfileHydrationError] = useState(false);
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [authenticatedUid, setAuthenticatedUid] = useState("");
  const [authRevision, setAuthRevision] = useState(0);
  const sessionScope = useRef(createAuthSessionScope());
  const registrationHint = useRef<{ email: string; username: string } | null>(null);
  const startupPhase = useStartupPhase();
  const verificationRefreshInFlight = useRef(false);
  const lastPremiumSyncAt = useRef(0);
  const profileServerReadyUidRef = useRef("");
  const needsProfileCompletionRef = useRef(needsProfileCompletion);
  needsProfileCompletionRef.current = needsProfileCompletion;

  const completeSocialSignIn = useCallback((input: {
    user: User;
    email: string;
    displayName: string;
    photoURL: string;
    message: string;
  }): AuthActionResult => {
    // Auth/profile observers own UI state. A late credential promise must never
    // reset a profile that the listener has already hydrated.
    void getOrCreateSocialProfile(input).catch((error) => {
      console.warn("[Auth] Social profile provisioning deferred.", authErrorCode(error));
    });

    return { ok: true, message: input.message };
  }, []);

  useRegisterRefresh(() => setRefreshCounter((value) => value + 1), { scope: ["/account"] });

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let disposed = false;
    const scope = sessionScope.current;

    void firebaseAuthReady.then(() => {
      if (disposed) return;
      unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
        if (disposed) return;
        scope.begin(user?.uid ?? "");
        setAuthenticatedUid(user?.uid ?? "");
        setAuthRevision((revision) => revision + 1);
        profileServerReadyUidRef.current = "";
        lastPremiumSyncAt.current = 0;
        if (!user) {
          profileServerReadyUidRef.current = "";
          setAccount(initialAccount);
          setProfileHydrated(false);
          setProfileHydrationError(false);
          setIsAuthenticated(false);
          setIsEmailVerified(false);
          setPendingVerificationEmail(undefined);
          setNeedsProfileCompletion(false);
          setAuthLoading(false);
          markPerformanceEvent("AUTH_READY", { authenticated: false });
          return;
        }
        const authenticatedUser = user;
        const isCurrentSession = scope.capture(user.uid);
        const verified = isEmailVerifiedForApp(authenticatedUser);
        logAuthStage("auth-observer", "session", "success");

        // Auth restoration is local and navigation-critical. Profile hydration is not:
        // render a usable account shell first, then reconcile Firestore in background.
        setAccount(accountFromFirebaseUser(authenticatedUser.uid, authenticatedUser.email ?? "", authenticatedUser.displayName ?? ""));
        setProfileHydrated(false);
        setProfileHydrationError(false);
        setNeedsProfileCompletion(false);
        setPendingVerificationEmail(verified ? undefined : authenticatedUser.email ?? undefined);
        setIsAuthenticated(true);
        setIsEmailVerified(verified);
        setAuthLoading(false);
        void loadResourceCache(`account:${authenticatedUser.uid}`, isCachedAccountSnapshot).then((cached) => {
          if (disposed || !isCurrentSession() || !cached || cached.account.uid !== authenticatedUser.uid || firebaseAuth.currentUser?.uid !== authenticatedUser.uid || profileServerReadyUidRef.current === authenticatedUser.uid) return;
          setAccount(cached.account);
          setProfileHydrated(true);
          // Cached identity keeps the shell useful, but onboarding completion is
          // server-authoritative and must never be decided by a stale device flag.
          markPerformanceEvent("PROFILE_DATA_READY", { source: "disk" });
        }).catch((error) => console.warn("[Auth] Account cache unavailable.", authErrorCode(error)));

        markPerformanceEvent("AUTH_READY", { authenticated: true });
      });
    });

    return () => {
      disposed = true;
      scope.invalidate();
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    const user = firebaseAuth.currentUser;
    if (!authenticatedUid || user?.uid !== authenticatedUid) return undefined;
    const isCurrentSession = sessionScope.current.capture(user.uid);
    let active = true;
    let revision = 0;
    let provisioning: Promise<FirebaseUserProfile> | undefined;
    const isCurrent = () => active && isCurrentSession() && firebaseAuth.currentUser?.uid === user.uid;
    const fail = (error: unknown) => {
      if (!isCurrent()) return;
      clearTimeout(deadline);
      console.warn("[Auth] Profile hydration failed; session retained.", authErrorCode(error));
      logAuthStage("profile-hydration", "session", "error", error);
      setProfileHydrationError(true);
    };
    // A silent offline listener is a data error, never an auth/route gate.
    const deadline = setTimeout(() => fail({ code: "profile/unavailable" }), 12000);
    const unsubscribe = onSnapshot(doc(firestoreDb, "users", user.uid), { includeMetadataChanges: true }, (snapshot) => {
      const event = ++revision;
      if (!isCurrent()) return;
      // Missing local cache is not evidence that an existing server user is new.
      if (!snapshot.exists() && snapshot.metadata.fromCache) return;
      void (async () => {
        const rawProfile = snapshot.exists() ? snapshot.data() : undefined;
        if (!snapshot.exists() && !provisioning) {
          const hint = registrationHint.current;
          provisioning = ensureFirestoreProfile(user, hint && hint.email === user.email?.toLowerCase() ? hint.username : undefined);
        }
        const profile = snapshot.exists()
          ? normalizeUserProfile(rawProfile ?? {}, snapshot.id)
          : await provisioning!;
        if (!isCurrent() || event !== revision) return;
        clearTimeout(deadline);
        profileServerReadyUidRef.current = user.uid;
        const hydratedAccount = accountFromProfile(profile);
        logAuthStage("profile-normalization", "session", "success");
        const incomplete = profileNeedsCompletion(profile);
        setProfileHydrated(true);
        setProfileHydrationError(false);
        // Cached identity is useful offline; only acknowledged server data may
        // open onboarding. Metadata-only server acknowledgements must be observed.
        if (!snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites) {
          setNeedsProfileCompletion(incomplete);
        }
        setAccount((current) => current.uid === hydratedAccount.uid
          ? { ...hydratedAccount, completedWeeks: current.completedWeeks, totalScore: current.totalScore }
          : hydratedAccount);
        void saveResourceCache(`account:${user.uid}`, { account: hydratedAccount, needsProfileCompletion: incomplete } satisfies CachedAccountSnapshot);
        const links = rawProfile?.socialLinks as Record<string, unknown> | undefined;
        if (typeof rawProfile?.email === "string" || typeof links?.email === "string") {
          void scrubPublicProfileEmail(user.uid).catch((error) => console.warn("[Privacy] Profile cleanup deferred.", authErrorCode(error)));
        }
        markPerformanceEvent("PROFILE_DATA_READY", { source: snapshot.metadata.fromCache ? "cache" : "server" });
      })().catch((error) => {
        if (event !== revision) return;
        provisioning = undefined;
        clearTimeout(deadline);
        fail(error);
      });
    }, fail);
    return () => {
      active = false;
      clearTimeout(deadline);
      unsubscribe();
    };
  }, [authenticatedUid, authRevision, refreshCounter]);

  useEffect(() => {
    const user = firebaseAuth.currentUser;
    if (startupPhase === "critical" || !isAuthenticated || !isEmailVerified || !user) return undefined;
    const isCurrentSession = sessionScope.current.capture(user.uid);
    let active = true;
    loadMemberScore(user.uid)
      .then((summary) => {
        if (!active || !isCurrentSession() || firebaseAuth.currentUser?.uid !== user.uid) return;
        setAccount((current) => {
          const scoredAccount = mergeMemberScore(current, summary);
          void saveResourceCache(`account:${user.uid}`, { account: scoredAccount, needsProfileCompletion: needsProfileCompletionRef.current } satisfies CachedAccountSnapshot);
          return scoredAccount;
        });
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [authenticatedUid, authRevision, isAuthenticated, isEmailVerified, refreshCounter, startupPhase]);

  useEffect(() => {
    let active = true;
    const refreshVerification = async () => {
      const user = firebaseAuth.currentUser;
      if (!user || verificationRefreshInFlight.current) return;
      if (isEmailVerified && !pendingVerificationEmail) return;
      verificationRefreshInFlight.current = true;
      const isCurrentSession = sessionScope.current.capture(user.uid);
      try {
        await reload(user);
        const pendingEmail = pendingVerificationEmail?.trim().toLowerCase();
        if (!isEmailVerifiedForApp(user) || (pendingEmail && user.email?.trim().toLowerCase() !== pendingEmail)) return;
        await getIdToken(user, true);
        if (!active || !isCurrentSession() || firebaseAuth.currentUser?.uid !== user.uid) return;
        setIsEmailVerified(true);
        setPendingVerificationEmail(undefined);
        const verifiedEmail = user.email?.trim();
        if (verifiedEmail) {
          setAccount((current) => {
            if (current.uid !== user.uid || current.email === verifiedEmail) return current;
            return { ...current, email: verifiedEmail };
          });
        }
      } catch {
        // Returning from a mail app must never block foreground navigation.
      } finally {
        verificationRefreshInFlight.current = false;
      }
    };
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshVerification();
    });
    void refreshVerification();
    return () => { active = false; subscription.remove(); };
  }, [authenticatedUid, authRevision, isEmailVerified, pendingVerificationEmail]);

  // On every authenticated launch, reconcile the platform store with Firebase. iOS
  // keeps its existing server sync; Android also restores Play purchases before the
  // same canonical users document is reconciled.
  useEffect(() => {
    if (startupPhase !== "idle" || !isAuthenticated || !firebaseAuth.currentUser) return;
    if (Platform.OS !== "android" && !isEmailVerified) return;
    const sync = () => {
      if (Date.now() - lastPremiumSyncAt.current < 6 * 60 * 60 * 1000) return Promise.resolve();
      lastPremiumSyncAt.current = Date.now();
      return (Platform.OS === "android"
        ? restoreGooglePlayPremiumAtLaunch()
        : syncPremiumStatusRemote()).catch(() => undefined);
    };
    void sync();
    if (Platform.OS !== "android") return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void sync();
    });
    return () => subscription.remove();
  }, [authenticatedUid, isAuthenticated, isEmailVerified, startupPhase]);

  const value = useMemo(
    () => ({
      account,
      isAuthenticated,
      isEmailVerified,
      canBrowsePublicContent: isAuthenticated && !account.isSuspended,
      canUseMemberFeatures:
        isAuthenticated && !account.isSuspended,
      pendingVerificationEmail,
      authLoading,
      profileHydrated,
      profileHydrationError,
      needsProfileCompletion,
      retryProfileHydration: () => {
        setProfileHydrationError(false);
        setRefreshCounter((value) => value + 1);
      },
      login: async (email: string, password: string) => {
        try {
          await loginWithEmail(email, password);
          return { ok: true, message: "" };
        } catch (error) {
          console.warn("[Auth] Email sign-in failed.", authErrorCode(error));
          logAuthStage("login-action", "email", "error", error);
          return { ok: false, message: getAuthErrorMessage(error, language) };
        }
      },
      register: async (nextAccount: Pick<Account, "username" | "password" | "email">) => {
        registrationHint.current = { email: nextAccount.email.trim().toLowerCase(), username: nextAccount.username.trim() };
        try {
          const credential = await registerWithEmail(nextAccount.email, nextAccount.password);
          // Profile creation belongs to the UID-scoped listener. Email delivery
          // is retryable from the account screen and cannot undo a valid signup.
          void sendEmailVerification(credential.user).catch((error) => {
            console.warn("[Auth] Verification delivery deferred; signup succeeded.", authErrorCode(error));
          });
          return { ok: true, message: "" };
        } catch (error) {
          registrationHint.current = null;
          console.warn("[Auth] Email signup failed.", authErrorCode(error));
          logAuthStage("login-action", "email-signup", "error", error);
          return { ok: false, message: getAuthErrorMessage(error, language) };
        }
      },
      verifyEmailCode: async (code?: string) => {
        try {
          const user = firebaseAuth.currentUser;

          if (user && isEmailVerifiedForApp(user)) {
            setPendingVerificationEmail(undefined);
            setIsEmailVerified(true);
            return { ok: true, message: "E-posta adresiniz zaten doğrulanmış." };
          }

          if (code) {
            await checkActionCode(firebaseAuth, code);
            await applyActionCode(firebaseAuth, code);
          }

          if (!user) {
            return code
              ? { ok: true, message: "E-posta doğrulandı. Şimdi hesabınıza giriş yapabilirsiniz." }
              : { ok: false, message: "E-posta doğrulaması için önce giriş yapmanız gerekir." };
          }

          await reload(user);

          if (!isEmailVerifiedForApp(user)) {
            return { ok: false, message: "Lütfen e-posta adresinizi doğrulayın.", requiresVerification: true };
          }

          await getIdToken(user, true);
          if (firebaseAuth.currentUser?.uid !== user.uid) return { ok: false, message: "" };
          setPendingVerificationEmail(undefined);
          setIsEmailVerified(true);
          return { ok: true, message: "" };
        } catch (error) {
          const user = firebaseAuth.currentUser;
          if (user) {
            await reload(user).catch(() => undefined);
            if (isEmailVerifiedForApp(user)) {
              setPendingVerificationEmail(undefined);
              setIsEmailVerified(true);
              return { ok: true, message: "E-posta adresiniz zaten doğrulanmış." };
            }
          }
          return { ok: false, message: getFriendlyAuthError(error) };
        }
      },
      forgotPassword: async (email: string) => {
        try {
          await resetPassword(email);
          return { ok: true, message: {
            tr: "Bu e-posta için bir hesap varsa şifre sıfırlama bağlantısı gönderildi.",
            en: "If an account uses this email, a password reset link has been sent.",
            ru: "Если аккаунт с этим e-mail существует, ссылка для сброса отправлена.",
            uz: "Bu e-pochta bilan hisob mavjud bo‘lsa, parolni tiklash havolasi yuborildi."
          }[language] };
        } catch (error) {
          return { ok: false, message: getAuthErrorMessage(error, language) };
        }
      },
      resendVerificationEmail: async () => {
        try {
          const user = firebaseAuth.currentUser;
          if (!user) {
            return { ok: false, message: "Doğrulama e-postası göndermek için önce giriş yapmanız gerekir." };
          }
          await reload(user);
          if (isEmailVerifiedForApp(user)) {
            const pendingEmail = pendingVerificationEmail?.trim().toLowerCase();
            if (pendingEmail && user.email?.trim().toLowerCase() !== pendingEmail) {
              await requestEmailChange(pendingEmail, undefined, user);
              return { ok: true, message: "Yeni e-posta adresinize doğrulama bağlantısı tekrar gönderildi." };
            }
            await getIdToken(user, true);
            setIsEmailVerified(true);
            setPendingVerificationEmail(undefined);
            return { ok: true, message: "E-posta adresiniz zaten doğrulanmış." };
          }
          await sendEmailVerification(user);
          setPendingVerificationEmail(user.email ?? pendingVerificationEmail);
          return { ok: true, message: "Doğrulama e-postası tekrar gönderildi." };
        } catch (error) {
          return { ok: false, message: getFriendlyAuthError(error) };
        }
      },
      changeAccountEmail: async (nextEmail: string, currentPassword?: string) => {
        try {
          const user = firebaseAuth.currentUser;
          if (!user) {
            return { ok: false, message: "E-posta değiştirmek için önce giriş yapmanız gerekir." };
          }

          const normalizedEmail = nextEmail.trim().toLowerCase();
          if (!normalizedEmail || !normalizedEmail.includes("@")) {
            return { ok: false, message: "Lütfen geçerli bir e-posta adresi yazın." };
          }

          await reload(user);
          const emailChanged = normalizedEmail !== user.email?.trim().toLowerCase();
          await requestEmailChange(normalizedEmail, currentPassword, user);
          if (!emailChanged && isEmailVerifiedForApp(user)) {
            await getIdToken(user, true);
            setIsEmailVerified(true);
            setPendingVerificationEmail(undefined);
            return { ok: true, message: "E-posta adresiniz zaten doğrulanmış." };
          }

          setPendingVerificationEmail(normalizedEmail);
          return {
            ok: true,
            message: emailChanged
              ? "Yeni e-posta adresinize doğrulama bağlantısı gönderildi. Bağlantıyı açınca adresiniz otomatik güncellenecek."
              : "Doğrulama e-postası tekrar gönderildi.",
            requiresVerification: true
          };
        } catch (error) {
          return { ok: false, message: getFriendlyAuthError(error) };
        }
      },
      signInWithGoogle: async (idToken?: string) => {
        try {
          const credential = idToken ? await loginWithGoogleIdToken(idToken) : await loginWithGooglePopup();
          const user = credential.user;
          const email = user.email ?? "";
          return completeSocialSignIn({
            user,
            email,
            displayName: user.displayName || socialUsername(email, user.uid),
            photoURL: user.photoURL || "",
            message: "Google ile giriş yapıldı."
          });
        } catch (error) {
          console.warn("[Auth] Google sign-in failed.", authErrorCode(error));
          logAuthStage("login-action", "google", "error", error);
          return { ok: false, message: getAuthErrorMessage(error, language, true) };
        }
      },
      signInWithApple: async () => {
        try {
          if (Platform.OS === "web") {
            const credential = await loginWithApplePopup();
            const user = credential.user;
            const email = user.email ?? "";
            return completeSocialSignIn({
              user,
              email,
              displayName: user.displayName || socialUsername(email, user.uid),
              photoURL: user.photoURL || "",
              message: "Apple ile giriş yapıldı."
            });
          }

          if (Platform.OS !== "ios") {
            return { ok: false, message: "Apple ile giriş yalnızca Apple cihazlarda kullanılabilir." };
          }

          if (!(await isAppleSignInAvailable())) {
            return { ok: false, message: "Apple ile giriş yalnızca desteklenen Apple cihazlarda kullanılabilir." };
          }

          const appleSignIn = await traceAuthStep("native-provider", "apple", requestAppleSignInCredential);
          const appleCredential = appleSignIn.credential;

          if (!appleCredential.identityToken) {
            console.error("[Apple Sign In] Missing Apple identity token.");
            return { ok: false, message: "Apple token alınamadı. Lütfen tekrar deneyin." };
          }

          const credential = await loginWithAppleIdentityToken(appleCredential.identityToken, appleSignIn.rawNonce);
          const email = credential.user.email ?? appleCredential.email ?? "";
          return completeSocialSignIn({
            user: credential.user,
            email,
            displayName: appleFullName(appleCredential) || credential.user.displayName || socialUsername(email, credential.user.uid),
            photoURL: credential.user.photoURL || "",
            message: "Apple ile giriş yapıldı."
          });
        } catch (error) {
          if (isAppleCancelError(error)) {
            return { ok: false, message: "" };
          }
          console.warn("[Apple Sign In] Failed.", authErrorCode(error));
          logAuthStage("login-action", "apple", "error", error);
          return { ok: false, message: getAuthErrorMessage(error, language, true) };
        }
      },
      updateAccount: (nextAccount: Partial<Account>) => {
        setAccount((current) => ({ ...current, ...nextAccount }));
      },
      saveAccountProfile: async (nextAccount: Partial<Account> & { avatarUri?: string; completeOnboarding?: boolean; removeAvatar?: boolean }) => {
        try {
          const user = firebaseAuth.currentUser;
          if (!user) {
            return { ok: false, message: "Profil kaydetmek için giriş yapmanız gerekir." };
          }

          if (!isAuthenticated) {
            return { ok: false, message: "Profil kaydetmek için giriş yapmanız gerekir." };
          }

          const username = nextAccount.username ? normalizeUsername(nextAccount.username) : account.username;
          if (username !== account.username) {
            const existingProfile = await findUserByUsername(username);
            if (existingProfile && existingProfile.uid !== user.uid) {
              return { ok: false, message: "Bu kullanıcı adı başka bir hesap tarafından kullanılıyor." };
            }
          }

          const avatarSource = nextAccount.avatarUri ?? nextAccount.avatar;
          const photoURL = nextAccount.removeAvatar
            ? ""
            : avatarSource
              ? await uploadProfilePhoto(user.uid, avatarSource)
              : account.avatar ?? "";
          const avatarType = nextAccount.removeAvatar
            ? "default"
            : nextAccount.avatarType ?? account.avatarType ?? (photoURL ? "uploaded" : "default");
          const avatarArtistId = avatarType === "artist" ? nextAccount.avatarArtistId : undefined;

          const displayName = nextAccount.displayName ? normalizeDisplayName(nextAccount.displayName) : account.displayName;
          const previousUsername = username !== account.username ? account.username : undefined;
          const identityChanged = Boolean(previousUsername) || displayName !== account.displayName;

          const countryFields = getCountryProfileFields(nextAccount.country !== undefined || nextAccount.countryCode !== undefined
            ? { country: nextAccount.country, countryCode: nextAccount.countryCode }
            : account);
          const country = countryFields.country;
          const countryCode = countryFields.countryCode;
          const countryChanged = country !== account.country || countryCode !== (account.countryCode ?? resolveCountryCode(account.country));

          if (displayName !== user.displayName || photoURL !== user.photoURL) {
            await updateProfile(user, {
              displayName,
              photoURL: nextAccount.removeAvatar ? null : photoURL || undefined
            });
          }
          const isCurrentSession = sessionScope.current.capture(user.uid);

          // Keep the completion marker in the same Firestore update as the
          // required profile fields. Auth metadata is updated first so a later
          // Auth failure can never leave a half-completed onboarding document.
          await updateUserProfile(user.uid, {
            username,
            displayName,
            bio: nextAccount.bio ?? account.bio,
            country,
            countryCode,
            city: nextAccount.city ?? account.city,
            interests: nextAccount.interests ?? account.interests,
            socialLinks: nextAccount.socialLinks ?? account.socialLinks,
            showInCountryExplore: nextAccount.isDiscoverableByCountry ?? account.isDiscoverableByCountry,
            ...(nextAccount.completeOnboarding ? {
              profileOnboardingCompleted: true,
              profileOnboardingVersion: 1
            } : {}),
            photoURL,
            avatarType,
            avatarArtistId: avatarArtistId ?? ""
          });

          const photoChanged = photoURL !== (account.avatar ?? "");
          if (!isCurrentSession() || firebaseAuth.currentUser?.uid !== user.uid) return { ok: false, message: "" };
          if (identityChanged || photoChanged) {
            syncUserIdentityDenormalizedFields({
              uid: user.uid,
              username,
              displayName,
              previousUsername,
              photoURL
            }).then(() => { if (isCurrentSession()) setRefreshCounter((value) => value + 1); }).catch(() => undefined);
          }

          if (countryChanged && countryCode) {
            syncUserCountryDenormalizedFields({
              uid: user.uid,
              country,
              countryCode
            }).catch(() => undefined);
            invalidateCountryCache([user.uid, username, account.username]);
          }

          const nextLocalAccount: Account = {
            ...account,
            username,
            displayName,
            bio: nextAccount.bio ?? account.bio,
            country,
            countryCode,
            city: nextAccount.city ?? account.city,
            interests: nextAccount.interests ?? account.interests,
            socialLinks: nextAccount.socialLinks ?? account.socialLinks,
            avatar: photoURL || undefined,
            avatarType,
            avatarArtistId,
            isDiscoverableByCountry: nextAccount.isDiscoverableByCountry ?? account.isDiscoverableByCountry
          };
          const incomplete = nextAccount.completeOnboarding ? false : needsProfileCompletionRef.current;
          setAccount(nextLocalAccount);
          setProfileHydrated(true);
          setNeedsProfileCompletion(incomplete);
          void saveResourceCache(`account:${user.uid}`, {
            account: nextLocalAccount,
            needsProfileCompletion: incomplete
          } satisfies CachedAccountSnapshot);

          if (photoChanged && account.avatar) {
            void deleteOwnedProfilePhoto(user.uid, account.avatar).catch(() => undefined);
          }

          // Server hydration reconciles the optimistic atomic snapshot without
          // keeping the onboarding UI open on an extra profile read.
          void getUserProfile(user.uid).then((profile) => {
            if (!profile || !isCurrentSession() || firebaseAuth.currentUser?.uid !== user.uid) return;
            const hydratedAccount = accountFromProfile(profile);
            const hydratedIncomplete = profileNeedsCompletion(profile);
            setAccount(hydratedAccount);
            setProfileHydrated(true);
            setNeedsProfileCompletion(hydratedIncomplete);
            void saveResourceCache(`account:${user.uid}`, {
              account: hydratedAccount,
              needsProfileCompletion: hydratedIncomplete
            } satisfies CachedAccountSnapshot);
          }).catch(() => undefined);

          return { ok: true, message: "Profil kaydedildi.", avatarUrl: photoURL };
        } catch (error) {
          return { ok: false, message: getFriendlyAuthError(error) };
        }
      },
      deleteAccount: async (input: DeleteAccountInput) => {
        try {
          await deleteUserAccount(input);
          setAccount(initialAccount);
          setProfileHydrated(false);
          setIsAuthenticated(false);
          setIsEmailVerified(false);
          setNeedsProfileCompletion(false);
          setPendingVerificationEmail(undefined);
          return { ok: true, message: "Hesabınız silindi." };
        } catch (error) {
          return { ok: false, message: getFriendlyAuthError(error) };
        }
      },
      logout: async () => {
        if (account.uid) void disablePushDevice(account.uid).catch(() => undefined);
        const nativeCleanup = signOutGoogleNativeSession().catch((error) => {
          console.warn("[Google Sign In] Native sign-out cleanup failed.", authErrorCode(error));
        });
        await firebaseLogout();
        registrationHint.current = null;
        await nativeCleanup;
      },
      canJoinWeeklyQuiz: (weekId: string) => {
        if (account.isAdmin) return true;
        const periodId = extractWeekPeriodId(weekId);
        return !account.completedWeeks.some((item) => extractWeekPeriodId(item) === periodId);
      },
      completeWeeklyQuiz: (weekId: string, score: number, quizId = "") => {
        if (account.isAdmin) return;
        const periodId = extractWeekPeriodId(weekId);
        const user = firebaseAuth.currentUser;
        setAccount((current) => {
          if (current.completedWeeks.some((item) => extractWeekPeriodId(item) === periodId)) {
            return current;
          }
          if (user && quizId) {
            saveQuizAttempt({
              uid: user.uid,
              weekId: periodId,
              quizId,
              score,
              displayName: current.displayName,
              username: current.username
            }).catch(() => undefined);
          }
          return {
            ...current,
            totalScore: current.totalScore + quizParticipationPoints(score),
            completedWeeks: [...current.completedWeeks, periodId]
          };
        });
      }
    }),
    [account, authLoading, completeSocialSignIn, isAuthenticated, isEmailVerified, language, needsProfileCompletion, pendingVerificationEmail, profileHydrated, profileHydrationError]
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

function mergeMemberScore(account: Account, summary: Awaited<ReturnType<typeof loadMemberScore>>) {
  return {
    ...account,
    completedWeeks: summary.completedWeeks,
    totalScore: summary.totalScore
  };
}

function accountFromProfile(profile: FirebaseUserProfile): Account {
  const badges = normalizeProfileBadges(profile);

  return {
    ...initialAccount,
    uid: profile.uid,
    username: profile.username,
    displayName: profile.displayName,
    bio: profile.bio,
    country: profile.country,
    countryCode: getCountryProfileFields(profile).countryCode || undefined,
    city: profile.city,
    interests: profile.interests,
    socialLinks: profile.socialLinks,
    isDiscoverableByCountry: profile.showInCountryExplore,
    role: mapFirebaseRole(profile.appRole ?? (profile.role === "admin" ? "art_lover" : profile.role)),
    isAdmin: profile.role === "admin",
    isPremium: isPremiumProfileActive(profile),
    premiumExpiresAt: profile.expireDate?.toDate().toISOString(),
    isSuspended: Boolean(profile.isDisabled),
    badges,
    email: firebaseAuth.currentUser?.uid === profile.uid ? firebaseAuth.currentUser.email ?? "" : "",
    avatar: profile.photoURL || undefined,
    avatarType: profile.avatarType,
    avatarArtistId: profile.avatarArtistId,
    password: "",
    totalScore: 0,
    completedWeeks: [],
    restrictions: parseUserRestrictions(profile.restrictions),
    profileVisitVisibility: profile.profileVisitVisibility
  };
}

function normalizeProfileBadges(profile: FirebaseUserProfile): BadgeId[] {
  const translatedAdminBadges = profile.adminBadges
    .map((badge) => {
      if (badge === "art_lover") return undefined;
      if (badge === "curator_pick") return "editor_pick";
      if (badge === "artist") return undefined;
      return badge;
    })
    .filter(Boolean) as BadgeId[];

  return Array.from(new Set([
    ...profile.badges,
    ...profile.systemBadges,
    ...translatedAdminBadges
  ]));
}

function mapFirebaseRole(role: FirebaseUserProfile["role"]): MemberRole {
  if (role === "art_lover" || role === "user") return "art_lover";
  if (role === "artist") return "artist";
  if (role === "collector") return "collector";
  if (role === "critic") return "critic";
  if (role === "researcher") return "researcher";
  if (role === "educator") return "educator";
  if (role === "curator") return "curator";
  if (role === "art_patron") return "art_patron";
  if (role === "verified_gallery") return "verified_gallery";
  if (role === "museum") return "museum";
  return "art_lover";
}

function accountFromFirebaseUser(uid: string, email: string, displayName: string): Account {
  const username = email.split("@")[0] || uid;

  return {
    ...initialAccount,
    uid,
    username,
    displayName: displayName || username,
    bio: "",
    country: "",
    countryCode: undefined,
    city: "",
    interests: [],
    email,
    socialLinks: {
      instagram: "",
      x: "",
      facebook: "",
      website: ""
    },
    password: "",
    profileVisitVisibility: "visible",
    isAdmin: false,
    isPremium: false,
    isSuspended: false,
    badges: [],
    totalScore: 0,
    completedWeeks: []
  };
}

async function getOrCreateSocialProfile(input: {
  user: User;
  email: string;
  displayName: string;
  photoURL: string;
}) {
  const providerDisplayName = socialDisplayName(input.displayName, input.email, input.user.uid);
  const profile = await getOrCreateUserProfile({
    uid: input.user.uid,
    username: socialUsername(input.email, input.user.uid),
    email: input.email,
    displayName: providerDisplayName,
    photoURL: input.photoURL,
    role: "user",
    country: "",
    city: "",
    bio: "",
    interests: [],
    socialLinks: {},
    profileOnboardingCompleted: false,
    profileOnboardingVersion: 1
  });

  const shouldRestoreProviderName = profile.profileOnboardingCompleted === false
    && (!profile.displayName.trim() || profile.displayName === profile.username)
    && providerDisplayName !== profile.displayName;
  const shouldRestoreProviderPhoto = profile.profileOnboardingCompleted === false
    && profile.avatarType !== "default" && !profile.photoURL && Boolean(input.photoURL);
  if (!shouldRestoreProviderName && !shouldRestoreProviderPhoto) return profile;

  const patch = {
    ...(shouldRestoreProviderName ? { displayName: providerDisplayName } : {}),
    ...(shouldRestoreProviderPhoto ? { photoURL: input.photoURL } : {})
  };
  await updateUserProfile(input.user.uid, patch);
  return { ...profile, ...patch };
}

async function ensureFirestoreProfile(user: User, registrationUsername?: string) {
  const email = user.email ?? "";
  const username = registrationUsername || socialUsername(email, user.uid);

  return getOrCreateUserProfile({
    uid: user.uid,
    username,
    email,
    displayName: socialDisplayName(user.displayName || username, email, user.uid),
    photoURL: user.photoURL || "",
    role: "user",
    country: "",
    city: "",
    bio: "",
    interests: [],
    socialLinks: {},
    profileOnboardingCompleted: false,
    profileOnboardingVersion: 1
  });
}

function isCachedAccountSnapshot(value: unknown): value is CachedAccountSnapshot {
  if (!value || typeof value !== "object") return false;
  const cached = value as Partial<CachedAccountSnapshot>;
  if (!cached.account || typeof cached.account !== "object") return false;
  return typeof cached.account.uid === "string"
    && typeof cached.account.username === "string"
    && typeof cached.account.displayName === "string"
    && typeof cached.needsProfileCompletion === "boolean";
}

function getFriendlyAuthError(error: unknown) {
  const firebaseLikeError = error as { code?: string; message?: string; customData?: { serverResponse?: string } };
  const code = error instanceof FirebaseError ? error.code : firebaseLikeError.code ?? "";
  const rawMessage = firebaseLikeError.message ?? "";
  const serverResponse = firebaseLikeError.customData?.serverResponse ?? "";
  const combinedMessage = `${code} ${rawMessage} ${serverResponse}`;

  if (combinedMessage.includes("EMAIL_EXISTS") || code === "auth/email-already-in-use") return "Bu e-posta adresi zaten kullanılıyor.";
  if (combinedMessage.includes("OPERATION_NOT_ALLOWED") || code === "auth/operation-not-allowed") return "E-posta ile kayıt şu an kullanılamıyor. Lütfen daha sonra tekrar deneyin.";
  if (combinedMessage.includes("INVALID_LOGIN_CREDENTIALS") || code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") return "E-posta veya şifre hatalı.";
  if (combinedMessage.includes("INVALID_EMAIL") || code === "auth/invalid-email") return "Lütfen geçerli bir e-posta adresi yazın.";
  if (combinedMessage.includes("WEAK_PASSWORD") || code === "auth/weak-password") return "Şifre en az 6 karakter olmalı.";
  if (combinedMessage.includes("TOO_MANY_ATTEMPTS_TRY_LATER") || code === "auth/too-many-requests") return "Güvenlik nedeniyle kısa bir gönderim molası verildi. 15-30 dakika sonra tek kez tekrar deneyin.";
  if (code === "auth/network-request-failed") return "Bağlantı hatası. İnternet bağlantınızı kontrol edin.";
  if (code === "auth/requires-recent-login" || code === "auth/credential-too-old-login-again") return "E-posta değiştirmek için mevcut şifrenizi Şifre alanına yazıp tekrar Kaydet'e basın. Gerekirse çıkış yapıp yeniden giriş yapın.";
  if (code === "auth/user-token-expired") return "Oturum süresi doldu. Lütfen tekrar giriş yapın.";
  if (code === "auth/expired-action-code") return "Bu doğrulama bağlantısının süresi dolmuş. Lütfen yeni bir bağlantı isteyin.";
  if (code === "auth/invalid-action-code") return "Bu doğrulama bağlantısı geçersiz veya daha önce kullanılmış.";
  if (code === "permission-denied") return "Hesap oluşturuldu ancak profil bilgileri kaydedilemedi. Lütfen tekrar deneyin veya destekle iletişime geçin.";
  if (code === "unavailable") return "Servise şu an ulaşılamıyor. Lütfen bağlantıyı kontrol edip tekrar deneyin.";
  if (combinedMessage.includes("API_KEY_SERVICE_BLOCKED") || combinedMessage.includes("API_KEY_INVALID")) return "Bağlantı yapılandırmasında bir sorun var. Lütfen daha sonra tekrar deneyin.";

  return code ? "İşlem sırasında bir sorun oluştu. Lütfen tekrar deneyin." : "İşlem sırasında bir sorun oluştu. Lütfen tekrar deneyin.";
}
