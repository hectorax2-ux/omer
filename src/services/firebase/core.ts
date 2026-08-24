import { FirebaseApp, FirebaseError, FirebaseOptions, getApp, getApps, initializeApp } from "firebase/app";
// Added Apple Sign In
import {
  Auth,
  EmailAuthProvider,
  User,
  UserCredential,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  getReactNativePersistence,
  GoogleAuthProvider,
  initializeAuth,
  OAuthProvider,
  reauthenticateWithCredential,
  sendEmailVerification as firebaseSendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut
} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import {
  DocumentData,
  Firestore,
  Timestamp,
  doc,
  getDoc,
  getFirestore,
  initializeFirestore,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc
} from "firebase/firestore";
import { FirebaseStorage, getStorage } from "firebase/storage";
import {
  DISPLAY_NAME_MIN_LENGTH,
  USERNAME_MIN_LENGTH,
  isValidDisplayName,
  isValidUsername,
  normalizeDisplayName,
  normalizeUsername
} from "@/constants/account-limits";
import * as ImageManipulator from "expo-image-manipulator";
import { isPremiumPlan, isPremiumSubscriptionStatus, PremiumPlan, PremiumSubscriptionStatus } from "@/constants/premiumProducts";
import { parseUserRestrictions, UserRestrictionRecord } from "@/utils/user-restrictions";
import { resolveCountryCode } from "@/utils/country-utils";
import { museumCoverPath, profileAvatarPath, uploadImage } from "./storage-service";
import { purgeUserAccountRemote } from "./account-deletion-service";
import { APP_WEB_ORIGIN } from "@/constants/app-links";

export const firebaseConfig: FirebaseOptions = {
  apiKey: "AIzaSyAJt-zyn1UORtiHLIYKdS32936JqZReQQo",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim() || "auth.artatlas.app",
  projectId: "artco-62499",
  storageBucket: "artco-62499.firebasestorage.app",
  messagingSenderId: "349078695494",
  appId: "1:349078695494:web:124b1605af35732fb1e447",
  measurementId: "G-4DQLHK71FQ"
};

export type FirebaseUserRole =
  | "user"
  | "art_lover"
  | "artist"
  | "collector"
  | "critic"
  | "researcher"
  | "educator"
  | "curator"
  | "art_patron"
  | "verified_gallery"
  | "museum"
  | "admin";

export type FirebaseBadgeId =
  | "premium"
  | "weekly_winner"
  | "quiz_master"
  | "museum_explorer"
  | "editor_pick"
  | "trusted_member"
  | "top_writer"
  | "duel_champion"
  | "lucky_one";

export type FirebaseSystemBadgeId = "quiz_master" | "weekly_winner" | "duel_champion" | "lucky_one";
export type FirebaseAdminBadgeId =
  | "art_lover"
  | "artist"
  | "premium"
  | "museum_explorer"
  | "curator_pick"
  | "editor_pick"
  | "trusted_member"
  | "top_writer";

export type FirebaseSocialLinks = {
  instagram: string;
  x: string;
  facebook: string;
  website: string;
  email: string;
};

export type FirebaseUserProfile = {
  uid: string;
  username: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: FirebaseUserRole;
  appRole?: FirebaseUserRole;
  country: string;
  countryCode?: string;
  city: string;
  bio: string;
  interests: string[];
  socialLinks: FirebaseSocialLinks;
  badges: FirebaseBadgeId[];
  systemBadges: FirebaseSystemBadgeId[];
  adminBadges: FirebaseAdminBadgeId[];
  followersCount: number;
  followingCount: number;
  showInCountryExplore: boolean;
  profileOnboardingCompleted?: boolean;
  profileOnboardingVersion?: number;
  profileVisitVisibility: "visible" | "anonymous";
  isDisabled?: boolean;
  restrictions?: UserRestrictionRecord[];
  premium?: boolean;
  premiumPlan?: PremiumPlan | null;
  purchasePlatform?: "ios" | "android" | null;
  purchaseDate?: Timestamp | null;
  expireDate?: Timestamp | null;
  autoRenew?: boolean;
  subscriptionStatus?: PremiumSubscriptionStatus | null;
  premiumEnvironment?: string | null;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
};

export type CreateUserProfileInput = {
  uid: string;
  username: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role?: FirebaseUserRole;
  country?: string;
  city?: string;
  bio?: string;
  interests?: string[];
  socialLinks?: Partial<FirebaseSocialLinks>;
  badges?: FirebaseBadgeId[];
  systemBadges?: FirebaseSystemBadgeId[];
  adminBadges?: FirebaseAdminBadgeId[];
  followersCount?: number;
  followingCount?: number;
  showInCountryExplore?: boolean;
  profileOnboardingCompleted?: boolean;
  profileOnboardingVersion?: number;
  profileVisitVisibility?: "visible" | "anonymous";
};

export type UpdateUserProfileInput = Partial<Omit<FirebaseUserProfile, "uid" | "createdAt" | "updatedAt">>;

export type DeleteAccountInput = {
  password?: string;
  googleIdToken?: string;
  appleIdentityToken?: string;
  appleRawNonce?: string;
};

const defaultSocialLinks: FirebaseSocialLinks = {
  instagram: "",
  x: "",
  facebook: "",
  website: "",
  email: ""
};

const existingFirebaseApp: FirebaseApp | null = getApps().length ? getApp() : null;
export const firebaseApp: FirebaseApp = existingFirebaseApp ?? initializeApp(firebaseConfig);
const firebaseAuthRuntime = createFirebaseAuth(firebaseApp);
export const firebaseAuth: Auth = firebaseAuthRuntime.auth;
export const firebaseAuthReady = firebaseAuthRuntime.ready.then(
  () => {
    console.info(`[Auth] Durable Firebase session storage is ready on ${Platform.OS}.`);
    return true;
  },
  (error) => {
    console.error("[Auth] Durable Firebase session storage could not be initialized.", error);
    return false;
  }
);
// ignoreUndefinedProperties prevents the web SDK from throwing (and silently failing writes)
// when payloads contain undefined fields, e.g. optional notification/profile fields.
export const firestoreDb: Firestore = existingFirebaseApp
  ? getFirestore(firebaseApp)
  : initializeFirestore(firebaseApp, { ignoreUndefinedProperties: true });
export const firebaseStorage: FirebaseStorage = getStorage(firebaseApp);

function createFirebaseAuth(app: FirebaseApp) {
  if (Platform.OS === "web") {
    const auth = getAuth(app);
    return {
      auth,
      ready: setPersistence(auth, browserLocalPersistence).then(() => auth.authStateReady())
    };
  }

  const persistence = getReactNativePersistence(AsyncStorage);

  try {
    const auth = initializeAuth(app, { persistence });
    return { auth, ready: auth.authStateReady() };
  } catch (error) {
    if (error instanceof FirebaseError && error.code === "auth/already-initialized") {
      const auth = getAuth(app);
      return {
        auth,
        ready: setPersistence(auth, persistence).then(() => auth.authStateReady())
      };
    }
    throw error;
  }
}

async function requireDurableAuthPersistence() {
  if (await firebaseAuthReady) return;
  throw new Error("Secure session storage is unavailable. Please restart the app and try again.");
}

export function getFirebaseServices() {
  return {
    app: firebaseApp,
    auth: firebaseAuth,
    db: firestoreDb,
    storage: firebaseStorage
  };
}

export function isFirebaseConnectionReady() {
  return Boolean(firebaseApp.options.projectId && firebaseAuth && firestoreDb && firebaseStorage);
}

export async function registerWithEmail(email: string, password: string): Promise<UserCredential> {
  await requireDurableAuthPersistence();
  return createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
}

export async function loginWithEmail(email: string, password: string): Promise<UserCredential> {
  await requireDurableAuthPersistence();
  return signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
}

export async function loginWithAppleIdentityToken(identityToken: string, rawNonce?: string): Promise<UserCredential> {
  await requireDurableAuthPersistence();
  const provider = new OAuthProvider("apple.com");
  const credential = provider.credential({
    idToken: identityToken,
    ...(rawNonce ? { rawNonce } : {})
  });
  return signInWithCredential(firebaseAuth, credential);
}

export async function loginWithApplePopup(): Promise<UserCredential> {
  await requireDurableAuthPersistence();
  const provider = new OAuthProvider("apple.com");
  provider.addScope("email");
  provider.addScope("name");
  return signInWithPopup(firebaseAuth, provider);
}

export async function loginWithGooglePopup(): Promise<UserCredential> {
  await requireDurableAuthPersistence();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return signInWithPopup(firebaseAuth, provider);
}

export async function loginWithGoogleIdToken(idToken: string): Promise<UserCredential> {
  await requireDurableAuthPersistence();
  const credential = GoogleAuthProvider.credential(idToken);
  return signInWithCredential(firebaseAuth, credential);
}

export async function logout(): Promise<void> {
  return signOut(firebaseAuth);
}

export async function sendEmailVerification(user: User = firebaseAuth.currentUser as User): Promise<void> {
  if (!user) {
    throw new Error("E-posta doğrulaması için oturum açmış kullanıcı bulunamadı.");
  }

  return firebaseSendEmailVerification(user, {
    url: APP_WEB_ORIGIN,
    handleCodeInApp: false
  });
}

export async function resetPassword(email: string): Promise<void> {
  return sendPasswordResetEmail(firebaseAuth, email.trim());
}

export async function createUserProfile(profile: CreateUserProfileInput): Promise<FirebaseUserProfile> {
  const normalizedProfile = buildUserProfile(profile);
  await setDoc(doc(firestoreDb, "users", normalizedProfile.uid), {
    ...normalizedProfile,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  return normalizedProfile;
}

export async function getOrCreateUserProfile(profile: CreateUserProfileInput): Promise<FirebaseUserProfile> {
  const profileRef = doc(firestoreDb, "users", profile.uid);
  return runTransaction(firestoreDb, async (transaction) => {
    const snapshot = await transaction.get(profileRef);
    if (snapshot.exists()) return normalizeUserProfile(snapshot.data(), snapshot.id);

    const normalizedProfile = buildUserProfile(profile);
    transaction.set(profileRef, {
      ...normalizedProfile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return normalizedProfile;
  });
}

export async function getUserProfile(uid: string): Promise<FirebaseUserProfile | null> {
  const snapshot = await getDoc(doc(firestoreDb, "users", uid));

  if (!snapshot.exists()) {
    return null;
  }

  return normalizeUserProfile(snapshot.data(), uid);
}

export async function updateUserProfile(uid: string, profile: UpdateUserProfileInput): Promise<void> {
  if (typeof profile.username === "string" && !isValidUsername(profile.username)) {
    throw new Error(`Kullanıcı adı en az ${USERNAME_MIN_LENGTH} karakter olmalı.`);
  }

  if (typeof profile.displayName === "string" && !isValidDisplayName(profile.displayName)) {
    throw new Error(`İsim en az ${DISPLAY_NAME_MIN_LENGTH} karakter olmalı.`);
  }

  await updateDoc(doc(firestoreDb, "users", uid), {
    ...profile,
    ...(typeof profile.username === "string" ? { username: normalizeUsername(profile.username) } : {}),
    ...(typeof profile.displayName === "string" ? { displayName: normalizeDisplayName(profile.displayName) } : {}),
    updatedAt: serverTimestamp()
  });
}

function isRemoteImageUri(uri: string) {
  return /^https?:\/\//i.test(uri);
}

export async function uploadMuseumCover(uid: string, localUri: string): Promise<string> {
  if (isRemoteImageUri(localUri)) {
    return localUri;
  }

  const optimized = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: 1280 } }],
    { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG }
  );
  const response = await fetch(optimized.uri);
  const blob = await response.blob();
  if (blob.size > 3 * 1024 * 1024) {
    throw new Error("Kapak görseli 3 MB sınırını aşıyor. Daha küçük bir görsel seçin.");
  }

  const fileName = `${Date.now()}-cover.jpg`;
  return uploadImage(museumCoverPath(uid, fileName), blob, {
    mimeType: "image/jpeg",
    sizeBytes: blob.size,
    width: optimized.width,
    height: optimized.height
  });
}

export async function uploadProfilePhoto(uid: string, localUri: string): Promise<string> {
  if (isRemoteImageUri(localUri)) {
    return localUri;
  }

  const optimized = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: 960 } }],
    { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG }
  );
  const response = await fetch(optimized.uri);
  const blob = await response.blob();
  if (blob.size > 2 * 1024 * 1024) {
    throw new Error("Profil fotoğrafı 2 MB sınırını aşıyor. Daha küçük bir görsel seçin.");
  }

  const fileName = `${Date.now()}-avatar.jpg`;
  return uploadImage(profileAvatarPath(uid, fileName), blob, {
    mimeType: "image/jpeg",
    sizeBytes: blob.size,
    width: optimized.width,
    height: optimized.height
  });
}

export async function reauthenticateCurrentUser(input: DeleteAccountInput): Promise<void> {
  const user = firebaseAuth.currentUser;
  if (!user) {
    throw new Error("Hesap silmek için oturum açmış olmanız gerekir.");
  }

  if (input.password && user.email) {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, input.password));
    return;
  }

  if (input.googleIdToken) {
    await reauthenticateWithCredential(user, GoogleAuthProvider.credential(input.googleIdToken));
    return;
  }

  if (input.appleIdentityToken) {
    const provider = new OAuthProvider("apple.com");
    await reauthenticateWithCredential(user, provider.credential({
      idToken: input.appleIdentityToken,
      ...(input.appleRawNonce ? { rawNonce: input.appleRawNonce } : {})
    }));
    return;
  }

  throw new Error("Hesabı silmek için kimliğinizi tekrar doğrulamanız gerekir.");
}

export async function deleteUserAccount(input: DeleteAccountInput): Promise<void> {
  const user = firebaseAuth.currentUser;
  if (!user) {
    throw new Error("Hesap silmek için oturum açmış olmanız gerekir.");
  }

  await reauthenticateCurrentUser(input);
  await purgeUserAccountRemote();
}

function buildUserProfile(profile: CreateUserProfileInput): FirebaseUserProfile {
  if (!isValidUsername(profile.username)) {
    throw new Error(`Kullanıcı adı en az ${USERNAME_MIN_LENGTH} karakter olmalı.`);
  }

  const displayName = normalizeDisplayName(profile.displayName || profile.username);

  if (!isValidDisplayName(displayName)) {
    throw new Error(`İsim en az ${DISPLAY_NAME_MIN_LENGTH} karakter olmalı.`);
  }

  const appRole = profile.role && profile.role !== "user" && profile.role !== "admin"
    ? profile.role
    : "art_lover";

  return {
    uid: profile.uid,
    username: normalizeUsername(profile.username),
    email: profile.email.trim(),
    displayName,
    photoURL: profile.photoURL ?? "",
    role: profile.role === "admin" ? "admin" : "user",
    appRole,
    country: profile.country ?? "",
    countryCode: resolveCountryCode(profile.country ?? "") ?? "",
    city: profile.city ?? "",
    bio: profile.bio ?? "",
    interests: profile.interests ?? [],
    socialLinks: {
      ...defaultSocialLinks,
      ...profile.socialLinks
    },
    badges: profile.badges ?? [],
    systemBadges: profile.systemBadges ?? [],
    adminBadges: profile.adminBadges ?? [],
    followersCount: profile.followersCount ?? 0,
    followingCount: profile.followingCount ?? 0,
    showInCountryExplore: profile.showInCountryExplore ?? true,
    profileOnboardingCompleted: profile.profileOnboardingCompleted ?? false,
    profileOnboardingVersion: profile.profileOnboardingVersion ?? 1,
    profileVisitVisibility: profile.profileVisitVisibility ?? "visible",
    isDisabled: false,
    createdAt: null,
    updatedAt: null
  };
}

export function normalizeUserProfile(data: DocumentData, uid: string): FirebaseUserProfile {
  return {
    uid,
    username: typeof data.username === "string" ? data.username : "",
    email: typeof data.email === "string" ? data.email : "",
    displayName: typeof data.displayName === "string" ? data.displayName : "",
    photoURL: typeof data.photoURL === "string" ? data.photoURL : "",
    role: typeof data.role === "string" ? data.role as FirebaseUserRole : "user",
    appRole: typeof data.appRole === "string" ? data.appRole as FirebaseUserRole : undefined,
    country: typeof data.country === "string" ? data.country : "",
    countryCode: typeof data.countryCode === "string" && data.countryCode.trim()
      ? data.countryCode.trim().toUpperCase()
      : "",
    city: typeof data.city === "string" ? data.city : "",
    bio: typeof data.bio === "string" ? data.bio : "",
    interests: Array.isArray(data.interests) ? data.interests.filter((item: unknown) => typeof item === "string") : [],
    socialLinks: {
      ...defaultSocialLinks,
      ...(typeof data.socialLinks === "object" && data.socialLinks ? data.socialLinks : {})
    },
    badges: Array.isArray(data.badges) ? data.badges.filter((item: unknown) => typeof item === "string") as FirebaseBadgeId[] : [],
    systemBadges: Array.isArray(data.systemBadges) ? data.systemBadges.filter((item: unknown) => typeof item === "string") as FirebaseSystemBadgeId[] : [],
    adminBadges: Array.isArray(data.adminBadges) ? data.adminBadges.filter((item: unknown) => typeof item === "string") as FirebaseAdminBadgeId[] : [],
    followersCount: typeof data.followersCount === "number" ? data.followersCount : 0,
    followingCount: typeof data.followingCount === "number" ? data.followingCount : 0,
    showInCountryExplore: typeof data.showInCountryExplore === "boolean" ? data.showInCountryExplore : true,
    profileOnboardingCompleted: typeof data.profileOnboardingCompleted === "boolean" ? data.profileOnboardingCompleted : undefined,
    profileOnboardingVersion: typeof data.profileOnboardingVersion === "number" ? data.profileOnboardingVersion : undefined,
    profileVisitVisibility: data.profileVisitVisibility === "anonymous" ? "anonymous" : "visible",
    isDisabled: Boolean(data.isDisabled),
    restrictions: parseUserRestrictions(data.restrictions),
    premium: typeof data.premium === "boolean" ? data.premium : undefined,
    premiumPlan: isPremiumPlan(data.premiumPlan) ? data.premiumPlan : null,
    purchasePlatform: data.purchasePlatform === "ios" || data.purchasePlatform === "android" ? data.purchasePlatform : null,
    purchaseDate: data.purchaseDate instanceof Timestamp ? data.purchaseDate : null,
    expireDate: data.expireDate instanceof Timestamp ? data.expireDate : null,
    autoRenew: typeof data.autoRenew === "boolean" ? data.autoRenew : undefined,
    subscriptionStatus: isPremiumSubscriptionStatus(data.subscriptionStatus) ? data.subscriptionStatus : null,
    premiumEnvironment: typeof data.premiumEnvironment === "string" ? data.premiumEnvironment : null,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt : null,
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt : null
  };
}
