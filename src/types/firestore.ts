import { Timestamp } from "firebase/firestore";
import type { ImageFocus } from "@/firebase/shared/image-focus";
import type { PremiumPlan, PremiumSubscriptionStatus } from "@/constants/premiumProducts";

export type FirestoreTimestamp = Timestamp | null;
export type LanguageCode = "tr" | "en" | "ru" | "uz";
export type PublishStatus = "draft" | "scheduled" | "pending" | "published" | "rejected" | "archived";
export type UserRole =
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
export type SystemBadgeId = "quiz_master" | "weekly_winner" | "duel_champion" | "lucky_one";
export type AdminBadgeId =
  | "art_lover"
  | "artist"
  | "premium"
  | "museum_explorer"
  | "curator_pick"
  | "editor_pick"
  | "trusted_member"
  | "top_writer";
export type BadgeId = SystemBadgeId | AdminBadgeId;
export type ReactionValue = "like" | "dislike";
export type ContentType =
  | "artwork"
  | "artist"
  | "museum"
  | "communityImage"
  | "post"
  | "comment"
  | "quiz"
  | "bookFilm"
  | "artStory"
  | "ad"
  | "profile";

export type LocalizedString = Partial<Record<LanguageCode, string>>;

export type BaseDocument = {
  id: string;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
};

export type UserProfileDocument = BaseDocument & {
  uid: string;
  username: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: UserRole;
  appRole?: UserRole;
  country: string;
  countryCode?: string;
  city: string;
  bio: string;
  interests: string[];
  socialLinks: {
    instagram: string;
    x: string;
    facebook: string;
    website: string;
    email: string;
  };
  systemBadges: SystemBadgeId[];
  adminBadges: AdminBadgeId[];
  followersCount: number;
  followingCount: number;
  showInCountryExplore: boolean;
  profileOnboardingCompleted?: boolean;
  profileOnboardingVersion?: number;
  profileVisitVisibility?: "visible" | "anonymous";
  isDisabled: boolean;
} & PremiumSubscriptionFields;

// Canonical premium subscription state. Firebase is the single source of truth;
// these fields are written only by trusted Cloud Functions (purchase activation,
// App Store Server Notifications, and the reconcile/expiry jobs).
export type PremiumSubscriptionFields = {
  premium?: boolean;
  premiumPlan?: PremiumPlan | null;
  purchasePlatform?: "ios" | "android" | null;
  purchaseDate?: FirestoreTimestamp;
  expireDate?: FirestoreTimestamp;
  autoRenew?: boolean;
  subscriptionStatus?: PremiumSubscriptionStatus | null;
  premiumOriginalTransactionId?: string | null;
  premiumEnvironment?: string | null;
};

export type ArtworkDocument = BaseDocument & {
  title: LocalizedString;
  artistId: string;
  artistName: LocalizedString;
  museumId: string;
  museumName: LocalizedString;
  country: LocalizedString;
  period: LocalizedString;
  year: string;
  description: LocalizedString;
  detail: LocalizedString;
  imageURL: string;
  image?: string;
  imageFocus?: { x: number; y: number };
  tags: string[];
  status: PublishStatus;
  pinned: boolean;
  scheduledAt: FirestoreTimestamp;
  publishedAt: FirestoreTimestamp;
};

export type ArtistDocument = BaseDocument & {
  name: LocalizedString;
  imageURL: string;
  image?: string;
  imageFocus?: { x: number; y: number };
  lifeYears: string;
  country: LocalizedString;
  movement: LocalizedString;
  biography: LocalizedString;
  featuredArtworkIds: string[];
  status: PublishStatus;
  pinned: boolean;
  scheduledAt: FirestoreTimestamp;
};

export type MuseumDocument = BaseDocument & {
  name: LocalizedString;
  imageURL: string;
  image?: string;
  imageFocus?: { x: number; y: number };
  city: LocalizedString;
  country: LocalizedString;
  description: LocalizedString;
  artworkIds: string[];
  status: PublishStatus;
  pinned: boolean;
  scheduledAt: FirestoreTimestamp;
};

export type ArtStoryDocument = BaseDocument & {
  language?: LanguageCode | "all";
  translationGroupId?: string;
  title: LocalizedString;
  excerpt: LocalizedString;
  body: LocalizedString;
  readTime: LocalizedString;
  imageURL: string;
  image?: string;
  imageFocus?: ImageFocus;
  status: PublishStatus;
  pinned: boolean;
  scheduledAt: FirestoreTimestamp;
  publishedAt: FirestoreTimestamp;
  source?: "art_atlas" | "member";
  category?: "article" | "research" | "essay" | "history" | "opinion" | "philosophy" | "other";
  authorId?: string;
  authorUsername?: string;
  authorDisplayName?: string;
};

export type CommunityImageDocument = BaseDocument & {
  ownerId: string;
  ownerUsername: string;
  ownerDisplayName: string;
  language: LanguageCode;
  imageURL: string;
  image?: string;
  title: string;
  story: string;
  age: number;
  country: string;
  status: "pending" | "published" | "rejected" | "archived";
  likeCount: number;
  dislikeCount: number;
  netScore: number;
  weekId: string;
  competitionEntry: boolean;
  competitionWeekArchived?: boolean;
  deletedByUser?: boolean;
  deletedByAdmin?: boolean;
  archivedAt?: FirestoreTimestamp;
  quotaGeneration?: number;
  reviewedBy: string;
  reviewedAt: FirestoreTimestamp;
  boostedAt?: FirestoreTimestamp;
  rankingHidden?: boolean;
};

export type PostDocument = BaseDocument & {
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  authorPhotoURL?: string;
  language: LanguageCode;
  text: string;
  kind: "quote" | "own" | "knowledge" | "note";
  status: "draft" | "pending" | "published" | "hidden" | "removed" | "archived";
  isPremium: boolean;
  likeCount: number;
  favoriteCount: number;
  commentCount?: number;
  pinned: boolean;
  imageURL?: string;
  image?: string;
  scheduledAt: FirestoreTimestamp;
  publishedAt: FirestoreTimestamp;
  profileLinkDisabled?: boolean;
  publishedByAdmin?: boolean;
  adminBatchId?: string;
};

export type PostCommentDocument = BaseDocument & {
  postId: string;
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  text: string;
  status: PublishStatus;
  isPremium: boolean;
  editedAt?: FirestoreTimestamp;
};

export type CommunityImageCommentDocument = BaseDocument & {
  communityImageId: string;
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  text: string;
  status: PublishStatus;
  isPremium: boolean;
};

export type LikeDocument = BaseDocument & {
  userId: string;
  targetType: ContentType;
  targetId: string;
  value: ReactionValue;
};

export type FavoriteDocument = BaseDocument & {
  userId: string;
  targetType: ContentType;
  targetId: string;
};

export type ReportDocument = BaseDocument & {
  reporterId: string;
  targetType: ContentType;
  targetId: string;
  category: "content" | "profile" | "copyright" | "abuse" | "other";
  subject: string;
  message: string;
  status: "open" | "reviewing" | "resolved" | "rejected";
};

export type SupportMessage = {
  senderId: string;
  senderRole: "user" | "admin";
  message: string;
  createdAt: FirestoreTimestamp;
};

export type SupportTicketDocument = BaseDocument & {
  userId: string;
  userDisplayName?: string;
  category: "account" | "artwork" | "app" | "profile" | "copyright" | "roleBadge" | "other";
  subcategory: string;
  subject: string;
  email: string;
  status: "open" | "answered" | "resolved";
  messages: SupportMessage[];
  lastMessageAt: FirestoreTimestamp;
};

export type QuizQuestion = {
  id: string;
  question: LocalizedString;
  options: Partial<Record<LanguageCode, string[]>>;
  answerIndex: number;
  imageURL?: string;
  image?: string;
  pointsPerSecond: number;
  seconds: number;
};

export type QuizDocument = BaseDocument & {
  title: LocalizedString;
  type: "weekly" | "daily" | "guessArtwork";
  language: LanguageCode | "all";
  status: PublishStatus;
  weekId?: string;
  questions: QuizQuestion[];
  allowReplay: boolean;
  leaderboardEnabled: boolean;
  scheduledAt: FirestoreTimestamp;
  publishedAt: FirestoreTimestamp;
};

export type NotificationDocument = BaseDocument & {
  recipientId?: string;
  actorId?: string;
  actorUsername?: string;
  actorPhotoURL?: string;
  userId?: string;
  role?: UserRole;
  country?: string;
  language?: LanguageCode | "all";
  title: LocalizedString;
  body: LocalizedString;
  type:
    | "system"
    | "follow"
    | "like"
    | "approval"
    | "badge"
    | "quiz"
    | "weekly"
    | "system_announcement"
    | "admin_message"
    | "post_liked"
    | "post_disliked"
    | "post_commented"
    | "post_approved"
    | "post_rejected"
    | "post_reported_admin"
    | "comment_liked"
    | "comment_replied"
    | "comment_reported_admin"
    | "community_image_liked"
    | "community_image_disliked"
    | "community_image_approved"
    | "community_image_rejected"
    | "community_image_featured"
    | "community_image_weekly_winner"
    | "community_image_boost_started"
    | "community_image_commented"
    | "community_image_reported_admin"
    | "new_follower"
    | "profile_visit_summary"
    | "premium_profile_visitor"
    | "museum_liked"
    | "museum_followed"
    | "museum_artwork_added"
    | "museum_featured_admin"
    | "new_artwork_duel"
    | "new_artist_duel"
    | "duel_result"
    | "prophecy_opened"
    | "prophecy_result"
    | "prophecy_correct"
    | "prophecy_wrong"
    | "badge_awarded"
    | "badge_removed"
    | "prophet_level_up"
    | "weekly_winner_badge"
    | "daily_quiz_available"
    | "weekly_quiz_available"
    | "quiz_result"
    | "quiz_badge_awarded"
    | "time_capsule_due"
    | "premium_draw_available"
    | "premium_draw_result"
    | "content_removed"
    | "account_warning"
    | "direct_message";
  targetType?: "post" | "comment" | "communityImage" | "profile" | "museum" | "artwork" | "duel" | "quiz" | "badge" | "system";
  targetId?: string;
  targetOwnerId?: string;
  targetPath?: string;
  isRead?: boolean;
  isDeleted?: boolean;
  readAt?: FirestoreTimestamp;
  readBy?: string[];
  pushEnabled?: boolean;
  pushSent?: boolean;
  metadata?: Record<string, unknown>;
  dedupeKey?: string;
  status: PublishStatus;
  scheduledAt?: FirestoreTimestamp;
};

export type RoleBadgeDocument = BaseDocument & {
  id: UserRole | BadgeId;
  kind: "role" | "systemBadge" | "adminBadge";
  label: LocalizedString;
  description: LocalizedString;
  icon: string;
  active: boolean;
  assignableByAdminOnly: boolean;
};

export type AdDocument = BaseDocument & {
  title: string;
  placement:
    | "home"
    | "home_manual"
    | "home_banner"
    | "gallery"
    | "category_top"
    | "category_footer"
    | "artworkDetail"
    | "artwork_detail_bottom"
    | "artwork_detail_sheet"
    | "weekly"
    | "weekly_top"
    | "quiz"
    | "quiz_start"
    | "quiz_finish"
    | "feed"
    | "discover_inline"
    | "profile"
    | "profile_banner"
    | "books_films"
    | "support"
    | "popup_interstitial"
    | "admob_banner"
    | "admob_interstitial"
    | "admob_rewarded"
    | "menu";
  type: "manualBanner" | "popup" | "admob";
  deliveryType?: "manual" | "admob";
  imageURL?: string;
  image?: string;
  linkURL?: string;
  body?: string;
  admobUnitId?: string;
  language: LanguageCode | "all";
  status: PublishStatus;
  hideForPremium: boolean;
  startsAt: FirestoreTimestamp;
  endsAt: FirestoreTimestamp;
  pinned: boolean;
};

export type AdSettingsDocument = {
  interstitialPageInterval?: number;
  interstitialCooldownSeconds?: number;
  interstitialInitialDelaySeconds?: number;
  interstitialMaxPerSession?: number;
  bottomSheetCooldownSeconds?: number;
  feedInlineInterval?: number;
  feedInlineFirstIndex?: number;
};

export type RewardInfoDocument = BaseDocument & {
  title: LocalizedString;
  text: LocalizedString;
  body?: LocalizedString;
  icon: string;
  language: LanguageCode | "all";
  status: PublishStatus;
  order: number;
  pinned: boolean;
  scheduledAt: FirestoreTimestamp;
  publishedAt: FirestoreTimestamp;
};

export const IMAGE_UPLOAD_LIMITS = {
  profileAvatar: { maxBytes: 2 * 1024 * 1024, minWidth: 256, minHeight: 256, maxWidth: 2400, maxHeight: 2400 },
  communityImage: { maxBytes: 4 * 1024 * 1024, minWidth: 800, minHeight: 800, maxWidth: 5000, maxHeight: 5000 },
  adminAsset: { maxBytes: 10 * 1024 * 1024, minWidth: 800, minHeight: 450, maxWidth: 6000, maxHeight: 6000 }
} as const;

export const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
