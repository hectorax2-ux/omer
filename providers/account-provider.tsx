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
  createUserProfile,
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
  updateUserProfile,
  uploadProfilePhoto,
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
import { resolveCountryCode } from "@/utils/country-utils";
import { appleFullName, isAppleCancelError, isAppleSignInAvailable, requestAppleSignInCredential } from "@/utils/apple-auth";
import { signOutGoogleNativeSession } from "@/hooks/use-google-sign-in";
import { findUserByUsername } from "@/src/services/firebase/user-service";
import { disablePushDevice } from "@/src/services/firebase/push-notification-service";
import { markPerformanceEvent } from "@/utils/performance";
import { loadResourceCache, saveResourceCache } from "@/src/services/cache/resource-cache";
import { socialDisplayName, socialUsername } from "@/utils/social-auth-profile";
import { useStartupPhase } from "@/hooks/use-startup-phase";

export type MemberRole = UserRoleId;

export type Account = {
  uid: string;
  username: string;
  displayName: string;
  bio: string;
  country: string;
  city: string;
  interests: string[];
  socialLinks: {
    instagram: string;
    x: string;
    facebook: string;
    website: string;
    email: string;
  };
  isProfileVisible: boolean;
  isDiscoverableByCountry: boolean;
  password: string;
  role: MemberRole;
  isAdmin: boolean;
  isPremium: boolean;
  isSuspended: boolean;
  badges: BadgeId[];
  staffBadges: ("moderator" | "editor")[];
  email: string;
  avatar?: string;
  totalScore: number;
  completedWeeks: string[];
  restrictions: UserRestrictionRecord[];
  profileVisitVisibility: "visible" | "anonymous";
};

export type AuthActionResult = {
  ok: boolean;
  message: string;
  requiresVerification?: boolean;
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
  isSuspended: false,
  badges: [],
  staffBadges: [],
  email: "member@artatlas.app",
  avatar: undefined,
  country: "Türkiye",
  city: "İstanbul",
  interests: ["Rönesans", "Müze", "Modernizm"],
  socialLinks: {
    instagram: "resimlerle.sanat",
    x: "",
    facebook: "",
    website: "",
    email: "member@artatlas.app"
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
  const [account, setAccount] = useState<Account>(initialAccount);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | undefined>();
  const [authLoading, setAuthLoading] = useState(true);
  const [profileHydrated, setProfileHydrated] = useState(false);
  const [profileHydrationError, setProfileHydrationError] = useState(false);
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);
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
    const provisionalAccount = accountFromFirebaseUser(input.user.uid, input.email, socialDisplayName(input.displayName, input.email, input.user.uid));
    setAccount({
      ...provisionalAccount,
      username: socialUsername(input.email, input.user.uid),
      avatar: input.photoURL || undefined
    });
    setProfileHydrated(false);
    setProfileHydrationError(false);
    setNeedsProfileCompletion(true);
    setIsAuthenticated(true);
    setIsEmailVerified(true);
    setPendingVerificationEmail(undefined);

    void getOrCreateSocialProfile(input).then((profile) => {
      if (firebaseAuth.currentUser?.uid !== input.user.uid) return;
      const hydratedAccount = accountFromProfile(profile);
      const incomplete = profileNeedsCompletion(profile);
      profileServerReadyUidRef.current = input.user.uid;
      setAccount(hydratedAccount);
      setProfileHydrated(true);
      setProfileHydrationError(false);
      setNeedsProfileCompletion(incomplete);
      void saveResourceCache(`account:${input.user.uid}`, {
        account: hydratedAccount,
        needsProfileCompletion: incomplete
      } satisfies CachedAccountSnapshot);
    }).catch((error) => {
      console.warn("[Auth] Social Firebase account is active; profile provisioning will retry in background.", error);
    });

    return { ok: true, message: input.message };
  }, []);

  useRegisterRefresh(() => setRefreshCounter((value) => value + 1), { scope: ["/account"] });

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let disposed = false;

    void firebaseAuthReady.then(() => {
      if (disposed) return;
      unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
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
        const sociallyVerified = hasSocialAuthProvider(authenticatedUser);
        const verified = authenticatedUser.emailVerified || sociallyVerified;

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
          if (!cached || firebaseAuth.currentUser?.uid !== authenticatedUser.uid || profileServerReadyUidRef.current === authenticatedUser.uid) return;
          setAccount(cached.account);
          setProfileHydrated(true);
          setProfileHydrationError(false);
          setNeedsProfileCompletion(cached.needsProfileCompletion);
          markPerformanceEvent("PROFILE_DATA_READY", { source: "disk" });
        });

        markPerformanceEvent("AUTH_READY", { authenticated: true });
      });
    });

    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    const user = firebaseAuth.currentUser;
    if (!isAuthenticated || !user) return undefined;

    const sociallyVerified = hasSocialAuthProvider(user);

    return onSnapshot(doc(firestoreDb, "users", user.uid), async (snapshot) => {
      const loadedProfile = snapshot.exists()
        ? normalizeUserProfile(snapshot.data(), snapshot.id)
        : sociallyVerified
          ? await ensureFirestoreProfile(user).catch(() => null)
          : null;
      if (firebaseAuth.currentUser?.uid !== user.uid) return;
      const authEmail = firebaseAuth.currentUser?.email?.trim() ?? "";
      const shouldSyncVerifiedEmail = Boolean(
        loadedProfile
        && authEmail
        && (firebaseAuth.currentUser?.emailVerified || sociallyVerified)
        && loadedProfile.email.trim().toLowerCase() !== authEmail.toLowerCase()
      );
      const profile = loadedProfile && shouldSyncVerifiedEmail
        ? {
            ...loadedProfile,
            email: authEmail,
            socialLinks: {
              ...loadedProfile.socialLinks,
              email: !loadedProfile.socialLinks.email || loadedProfile.socialLinks.email === loadedProfile.email
                ? authEmail
                : loadedProfile.socialLinks.email
            }
          }
        : loadedProfile;
      if (profile && shouldSyncVerifiedEmail) {
        void updateUserProfile(user.uid, {
          email: profile.email,
          socialLinks: profile.socialLinks
        }).catch((error) => console.warn("[Auth] Verified email profile sync failed.", error));
      }
      if (profile) {
        if (firebaseAuth.currentUser?.uid !== user.uid) return;
        profileServerReadyUidRef.current = user.uid;
        const hydratedAccount = accountFromProfile(profile);
        const incomplete = profileNeedsCompletion(profile);
        setProfileHydrated(true);
        setProfileHydrationError(false);
        setNeedsProfileCompletion(incomplete);
        setAccount((current) => {
          const usernameChanged = current.username !== hydratedAccount.username;
          const displayNameChanged = current.displayName !== hydratedAccount.displayName;
          const countryChanged = current.country !== hydratedAccount.country;
          if (usernameChanged || displayNameChanged) {
            syncUserIdentityDenormalizedFields({
              uid: hydratedAccount.uid,
              username: hydratedAccount.username,
              displayName: hydratedAccount.displayName || hydratedAccount.username,
              previousUsername: usernameChanged ? current.username : undefined
            }).catch(() => undefined);
          }
          if (countryChanged) {
            const countryCode = resolveCountryCode(hydratedAccount.country) ?? "";
            if (countryCode) {
              syncUserCountryDenormalizedFields({
                uid: hydratedAccount.uid,
                country: hydratedAccount.country,
                countryCode
              }).catch(() => undefined);
            }
            invalidateCountryCache([hydratedAccount.uid, hydratedAccount.username, current.username]);
          }
          const nextAccount = current.uid === hydratedAccount.uid
            ? { ...hydratedAccount, completedWeeks: current.completedWeeks, totalScore: current.totalScore }
            : hydratedAccount;
          void saveResourceCache(`account:${user.uid}`, { account: nextAccount, needsProfileCompletion: incomplete } satisfies CachedAccountSnapshot);
          return nextAccount;
        });
        markPerformanceEvent("PROFILE_DATA_READY", { source: snapshot.metadata.fromCache ? "cache" : "server" });
        return;
      }
      setProfileHydrated(false);
      setNeedsProfileCompletion(true);
      setProfileHydrationError(true);
    }, (error) => {
      console.warn("[Auth] Firebase session restored, but profile hydration failed.", error);
      if (firebaseAuth.currentUser?.uid !== user.uid) return;
      setProfileHydrationError(true);
    });
  }, [isAuthenticated, refreshCounter]);

  useEffect(() => {
    const user = firebaseAuth.currentUser;
    if (startupPhase === "critical" || !isAuthenticated || !isEmailVerified || !user) return undefined;
    loadMemberScore(user.uid)
      .then((summary) => {
        if (firebaseAuth.currentUser?.uid !== user.uid) return;
        setAccount((current) => {
          const scoredAccount = mergeMemberScore(current, summary);
          void saveResourceCache(`account:${user.uid}`, { account: scoredAccount, needsProfileCompletion: needsProfileCompletionRef.current } satisfies CachedAccountSnapshot);
          return scoredAccount;
        });
      })
      .catch(() => undefined);
  }, [isAuthenticated, isEmailVerified, refreshCounter, startupPhase]);

  useEffect(() => {
    const refreshVerification = async () => {
      const user = firebaseAuth.currentUser;
      if (!user || hasSocialAuthProvider(user) || verificationRefreshInFlight.current) return;
      if (isEmailVerified && !pendingVerificationEmail) return;
      verificationRefreshInFlight.current = true;
      try {
        await reload(user);
        const pendingEmail = pendingVerificationEmail?.trim().toLowerCase();
        if (!user.emailVerified || (pendingEmail && user.email?.trim().toLowerCase() !== pendingEmail)) return;
        await getIdToken(user, true);
        setIsEmailVerified(true);
        setPendingVerificationEmail(undefined);
        const verifiedEmail = user.email?.trim();
        if (verifiedEmail) {
          setAccount((current) => {
            if (current.uid !== user.uid || current.email === verifiedEmail) return current;
            const socialLinks = {
              ...current.socialLinks,
              email: !current.socialLinks.email || current.socialLinks.email === current.email
                ? verifiedEmail
                : current.socialLinks.email
            };
            void updateUserProfile(user.uid, { email: verifiedEmail, socialLinks })
              .catch((error) => console.warn("[Auth] Verified email refresh sync failed.", error));
            return { ...current, email: verifiedEmail, socialLinks };
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
    return () => subscription.remove();
  }, [isEmailVerified, pendingVerificationEmail]);

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
  }, [isAuthenticated, isEmailVerified, startupPhase]);

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
          const credential = await loginWithEmail(email, password);

          if (!credential.user.emailVerified) {
            const profile = await getUserProfile(credential.user.uid);
            setAccount(profile ? accountFromProfile(profile) : accountFromFirebaseUser(credential.user.uid, credential.user.email ?? email, credential.user.displayName ?? ""));
            setProfileHydrated(Boolean(profile));
            setNeedsProfileCompletion(profile ? profileNeedsCompletion(profile) : true);
            setPendingVerificationEmail(credential.user.email ?? email);
            setIsAuthenticated(true);
            setIsEmailVerified(false);
            return { ok: false, message: "Lütfen e-posta adresinizi doğrulayın.", requiresVerification: true };
          }

          const profile = await getUserProfile(credential.user.uid);
          setAccount(profile ? accountFromProfile(profile) : accountFromFirebaseUser(credential.user.uid, credential.user.email ?? email, credential.user.displayName ?? ""));
          setProfileHydrated(Boolean(profile));
          setNeedsProfileCompletion(profile ? profileNeedsCompletion(profile) : true);
          setPendingVerificationEmail(undefined);
          setIsAuthenticated(true);
          setIsEmailVerified(true);
          return { ok: true, message: "" };
        } catch (error) {
          return { ok: false, message: getFriendlyAuthError(error) };
        }
      },
      register: async (nextAccount: Pick<Account, "username" | "password" | "email">) => {
        try {
          const credential = await registerWithEmail(nextAccount.email, nextAccount.password);
          const username = nextAccount.username.trim();
          const displayName = username.replace(/[._-]+/g, " ").trim() || username;

          const profile = await createUserProfile({
            uid: credential.user.uid,
            username,
            email: nextAccount.email,
            displayName,
            role: "user",
            country: "",
            city: "",
            bio: "",
            interests: [],
            socialLinks: { email: nextAccount.email },
            badges: [],
            showInCountryExplore: true,
            profileOnboardingCompleted: false,
            profileOnboardingVersion: 1
          });
          await sendEmailVerification(credential.user);
          setAccount(accountFromProfile(profile));
          setProfileHydrated(true);
          setPendingVerificationEmail(nextAccount.email);
          setIsAuthenticated(true);
          setIsEmailVerified(false);
          setNeedsProfileCompletion(true);

          return { ok: true, message: "Doğrulama bağlantısı e-posta adresinize gönderildi.", requiresVerification: true };
        } catch (error) {
          return { ok: false, message: getFriendlyAuthError(error) };
        }
      },
      verifyEmailCode: async (code?: string) => {
        try {
          const user = firebaseAuth.currentUser;

          if (user && (user.emailVerified || hasSocialAuthProvider(user))) {
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

          if (!user.emailVerified) {
            return { ok: false, message: "Lütfen e-posta adresinizi doğrulayın.", requiresVerification: true };
          }

          const profile = await getUserProfile(user.uid);
          setAccount(profile ? accountFromProfile(profile) : accountFromFirebaseUser(user.uid, user.email ?? "", user.displayName ?? ""));
          setProfileHydrated(Boolean(profile));
          setNeedsProfileCompletion(profile ? profileNeedsCompletion(profile) : true);
          setPendingVerificationEmail(undefined);
          setIsAuthenticated(true);
          setIsEmailVerified(true);
          await getIdToken(user, true);
          return { ok: true, message: "" };
        } catch (error) {
          const user = firebaseAuth.currentUser;
          if (user) {
            await reload(user).catch(() => undefined);
            if (user.emailVerified || hasSocialAuthProvider(user)) {
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
          return { ok: true, message: "Şifre sıfırlama bağlantısı e-posta adresinize gönderildi." };
        } catch (error) {
          return { ok: false, message: getFriendlyAuthError(error) };
        }
      },
      resendVerificationEmail: async () => {
        try {
          const user = firebaseAuth.currentUser;
          if (!user) {
            return { ok: false, message: "Doğrulama e-postası göndermek için önce giriş yapmanız gerekir." };
          }
          await reload(user);
          if (user.emailVerified || hasSocialAuthProvider(user)) {
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
          if (!emailChanged && user.emailVerified) {
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
          return { ok: false, message: getFriendlySocialSignInError("Google", error) };
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

          const appleSignIn = await requestAppleSignInCredential();
          const appleCredential = appleSignIn.credential;

          if (!appleCredential.identityToken) {
            console.error("[Apple Sign In] Missing Apple identity token.", { user: appleCredential.user });
            return { ok: false, message: "Apple token alınamadı. Lütfen tekrar deneyin." };
          }

          const credential = await loginWithAppleIdentityToken(appleCredential.identityToken, appleSignIn.rawNonce);
          const email = credential.user.email ?? appleCredential.email ?? `${appleCredential.user}@privaterelay.appleid.com`;
          return completeSocialSignIn({
            user: credential.user,
            email,
            displayName: appleFullName(appleCredential) || credential.user.displayName || socialUsername(email, credential.user.uid),
            photoURL: credential.user.photoURL || "",
            message: "Apple ile giriş yapıldı."
          });
        } catch (error) {
          if (isAppleCancelError(error)) {
            return { ok: false, message: "Apple ile giriş iptal edildi." };
          }
          console.warn("[Apple Sign In] Failed.", error);
          return { ok: false, message: getFriendlyAppleSignInError(error) };
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

          const displayName = nextAccount.displayName ? normalizeDisplayName(nextAccount.displayName) : account.displayName;
          const previousUsername = username !== account.username ? account.username : undefined;
          const identityChanged = Boolean(previousUsername) || displayName !== account.displayName;

          const country = nextAccount.country ?? account.country;
          const countryCode = resolveCountryCode(country) ?? "";
          const countryChanged = country !== account.country || countryCode !== resolveCountryCode(account.country);

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
            photoURL
          });

          if (displayName !== user.displayName || photoURL !== user.photoURL) {
            await updateProfile(user, {
              displayName,
              photoURL: nextAccount.removeAvatar ? null : photoURL || undefined
            });
          }

          const photoChanged = photoURL !== (account.avatar ?? "");
          if (identityChanged || photoChanged) {
            syncUserIdentityDenormalizedFields({
              uid: user.uid,
              username,
              displayName,
              previousUsername,
              photoURL
            }).then(() => setRefreshCounter((value) => value + 1)).catch(() => undefined);
          }

          if (countryChanged && countryCode) {
            syncUserCountryDenormalizedFields({
              uid: user.uid,
              country,
              countryCode
            }).catch(() => undefined);
            invalidateCountryCache([user.uid, username, account.username]);
          }

          const profile = await getUserProfile(user.uid);
          if (profile) {
            const hydratedAccount = accountFromProfile(profile);
            setAccount(hydratedAccount);
            setProfileHydrated(true);
            const incomplete = profileNeedsCompletion(profile);
            setNeedsProfileCompletion(incomplete);
            void saveResourceCache(`account:${user.uid}`, {
              account: hydratedAccount,
              needsProfileCompletion: incomplete
            } satisfies CachedAccountSnapshot);
          } else {
            setAccount((current) => ({
              ...current,
              ...nextAccount,
              username,
              displayName,
              avatar: photoURL || undefined,
              isDiscoverableByCountry: nextAccount.isDiscoverableByCountry ?? current.isDiscoverableByCountry
            }));
            if (nextAccount.completeOnboarding) setNeedsProfileCompletion(false);
          }

          return { ok: true, message: "Profil kaydedildi." };
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
        if (account.uid) await disablePushDevice(account.uid).catch(() => undefined);
        await signOutGoogleNativeSession().catch((error) => {
          console.warn("[Google Sign In] Native session sign-out failed; continuing Firebase logout.", error);
        });
        await firebaseLogout();
        setProfileHydrated(false);
        setIsAuthenticated(false);
        setIsEmailVerified(false);
        setNeedsProfileCompletion(false);
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
    [account, authLoading, completeSocialSignIn, isAuthenticated, isEmailVerified, needsProfileCompletion, pendingVerificationEmail, profileHydrated, profileHydrationError]
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

function hasSocialAuthProvider(user: User | null = firebaseAuth.currentUser) {
  if (!user) return false;
  return user.providerData.some((provider) => provider.providerId === "google.com" || provider.providerId === "apple.com");
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
    city: profile.city,
    interests: profile.interests,
    socialLinks: profile.socialLinks,
    isDiscoverableByCountry: profile.showInCountryExplore,
    role: mapFirebaseRole(profile.appRole ?? (profile.role === "admin" ? "art_lover" : profile.role)),
    isAdmin: profile.role === "admin",
    isPremium: isPremiumProfileActive(profile),
    isSuspended: Boolean(profile.isDisabled),
    badges,
    email: profile.email,
    avatar: profile.photoURL || undefined,
    password: "",
    totalScore: 0,
    completedWeeks: [],
    restrictions: parseUserRestrictions(profile.restrictions),
    profileVisitVisibility: profile.profileVisitVisibility
  };
}

function profileNeedsCompletion(profile: FirebaseUserProfile) {
  if (profile.role === "admin") return false;
  if (profile.profileOnboardingCompleted === true) return false;
  if (profile.profileOnboardingCompleted === false) return true;

  const username = profile.username.trim().toLocaleLowerCase("en");
  const displayName = profile.displayName.trim().toLocaleLowerCase("en");
  const generatedUsername = /^(?:user|hz)[a-z0-9]{6,}$/i.test(username)
    || (/^[a-z0-9]{8,12}$/i.test(username) && /\d/.test(username));
  const providerBio = /^(google|apple) ile hızlı kayıt\.?$/i.test(profile.bio.trim());
  const incompleteLegacyProfile = !profile.bio.trim()
    && !profile.country.trim()
    && (!displayName || displayName === username);

  return providerBio || incompleteLegacyProfile || (generatedUsername && (!displayName || displayName === username));
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
    city: "",
    interests: [],
    email,
    socialLinks: {
      instagram: "",
      x: "",
      facebook: "",
      website: "",
      email
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
    socialLinks: { email: input.email },
    profileOnboardingCompleted: false,
    profileOnboardingVersion: 1
  });

  const shouldRestoreProviderName = profile.profileOnboardingCompleted !== true
    && (!profile.displayName.trim() || profile.displayName === profile.username)
    && providerDisplayName !== profile.displayName;
  const shouldRestoreProviderPhoto = !profile.photoURL && Boolean(input.photoURL);
  const shouldRestoreProviderEmail = !profile.email && Boolean(input.email);
  if (!shouldRestoreProviderName && !shouldRestoreProviderPhoto && !shouldRestoreProviderEmail) return profile;

  const patch = {
    ...(shouldRestoreProviderName ? { displayName: providerDisplayName } : {}),
    ...(shouldRestoreProviderPhoto ? { photoURL: input.photoURL } : {}),
    ...(shouldRestoreProviderEmail ? {
      email: input.email,
      socialLinks: { ...profile.socialLinks, email: input.email }
    } : {})
  };
  await updateUserProfile(input.user.uid, patch);
  return { ...profile, ...patch };
}

async function ensureFirestoreProfile(user: User) {
  if (!user.providerData.some((provider) => provider.providerId === "google.com" || provider.providerId === "apple.com")) {
    return null;
  }

  const email = user.email ?? "";
  const username = socialUsername(email, user.uid);

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
    socialLinks: { email },
    profileOnboardingCompleted: false,
    profileOnboardingVersion: 1
  }).catch(() => null);
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

function getFriendlyAppleSignInError(error: unknown) {
  const firebaseLikeError = error as { code?: string; message?: string; customData?: { serverResponse?: string } };
  const code = error instanceof FirebaseError ? error.code : firebaseLikeError.code ?? "";

  if (code === "auth/network-request-failed" || code === "unavailable") {
    return "Ağ hatası. İnternet bağlantınızı kontrol edip tekrar deneyin.";
  }

  if (code === "ERR_REQUEST_FAILED") {
    return "Apple token alınamadı. Lütfen tekrar deneyin.";
  }

  return getFriendlySocialSignInError("Apple", error);
}

function getFriendlySocialSignInError(provider: "Google" | "Apple", error: unknown) {
  const firebaseLikeError = error as { code?: string; message?: string; customData?: { serverResponse?: string } };
  const code = error instanceof FirebaseError ? error.code : firebaseLikeError.code ?? "";
  const combinedMessage = `${code} ${firebaseLikeError.message ?? ""} ${firebaseLikeError.customData?.serverResponse ?? ""}`;

  if (code === "auth/account-exists-with-different-credential") {
    return `Bu e-posta başka bir giriş yöntemine bağlı. Önce mevcut yöntemle giriş yapıp ardından ${provider} hesabınızı bağlayın.`;
  }
  if (code === "auth/user-disabled") return "Bu hesap devre dışı bırakılmış. Destek ekibiyle iletişime geçin.";
  if (code === "auth/network-request-failed" || code === "unavailable") return "Ağ hatası. İnternet bağlantınızı kontrol edip tekrar deneyin.";
  if (code === "auth/operation-not-allowed") return `${provider} ile giriş şu anda etkin değil. Lütfen destek ekibiyle iletişime geçin.`;
  if (code === "auth/invalid-credential" || combinedMessage.includes("INVALID_LOGIN_CREDENTIALS")) {
    return `${provider} kimlik doğrulaması yenilenemedi. Hesabı tekrar seçip yeniden deneyin.`;
  }
  if (code === "auth/too-many-requests") return "Çok fazla giriş denemesi yapıldı. Lütfen biraz sonra tekrar deneyin.";
  return `${provider} ile giriş tamamlanamadı. Lütfen tekrar deneyin.`;
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
