import { Language } from "@/types/content";

export type UserRole = "art_lover" | "artist" | "gallery";
export type StaffRole = "admin" | "moderator" | "editor";
export type BadgeId = "premium" | "weekly_winner" | "quiz_master" | "museum_explorer" | "curator";
export type RestrictionType = "discover_post" | "image_upload" | "contest_entry" | "support_create";
export type ContentStatus = "pending" | "approved" | "rejected" | "hidden";
export type SupportStatus = "open" | "resolved";

export type UserDocument = {
  uid: string;
  username: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
  bio: string;
  country: string;
  city: string;
  language: Language;
  role: UserRole;
  badges: BadgeId[];
  staffRoles: StaffRole[];
  isDiscoverableByCountry: boolean;
  createdAt: number;
  updatedAt: number;
  lastActiveAt: number;
};

export type UserRestrictionDocument = {
  id: string;
  userId: string;
  type: RestrictionType;
  reason: string;
  startsAt: number;
  endsAt?: number;
  createdBy: string;
  createdAt: number;
  active: boolean;
};

export type ArtworkDocument = {
  id: string;
  ownerId: string;
  ownerUsername: string;
  ownerDisplayName: string;
  title: string;
  story: string;
  imagePath: string;
  imageUrl: string;
  language: Language | "all";
  source: "competition" | "profile";
  age?: number;
  country?: string;
  status: ContentStatus;
  approvedBy?: string;
  approvedAt?: number;
  createdAt: number;
  updatedAt: number;
};

export type DiscoveryPostDocument = {
  id: string;
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  text: string;
  kind: "quote" | "own" | "knowledge" | "note";
  language: Language;
  status: "active" | "hidden" | "removed";
  createdAt: number;
  updatedAt: number;
};

export type VoteDocument = {
  id: string;
  userId: string;
  targetType: "artwork" | "post" | "book_movie";
  targetId: string;
  value: "like" | "dislike" | "favorite";
  createdAt: number;
};

export type QuizDocument = {
  id: string;
  language: Language;
  type: "weekly" | "daily";
  title: string;
  startsAt: number;
  endsAt: number;
  active: boolean;
  questions: {
    id: string;
    question: string;
    imageUrl?: string;
    options: string[];
    answerIndex: number;
    seconds: number;
  }[];
};

export type GameScoreDocument = {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  gameType: "guess_artwork" | "true_false" | "color_period";
  weekId: string;
  score: number;
  createdAt: number;
};

export type SupportTicketDocument = {
  id: string;
  userId?: string;
  category: "account" | "artwork" | "app" | "user" | "copyright" | "role_badge";
  subcategory: string;
  subject: string;
  status: SupportStatus;
  createdAt: number;
  updatedAt: number;
};

export type NotificationDocument = {
  id: string;
  userId: string;
  title: string;
  body: string;
  targetPath?: string;
  read: boolean;
  pushSent: boolean;
  createdAt: number;
};

