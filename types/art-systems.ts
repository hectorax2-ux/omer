import { Language, LocalizedText } from "@/types/content";

export type DuelKind = "artwork" | "artist";
export type DuelStatus = "scheduled" | "active" | "finished" | "inactive";

export type DuelSide = {
  id: string;
  sourceId?: string;
  title: LocalizedText;
  subtitle: LocalizedText;
  image: string;
};

export type ArtDuel = {
  id: string;
  kind: DuelKind;
  title: LocalizedText;
  sideA: DuelSide;
  sideB: DuelSide;
  startsAt: string;
  endsAt: string;
  status: DuelStatus;
  active: boolean;
  votesA: number;
  votesB: number;
  notificationEnabled: boolean;
};

export type ProphecyWeek = {
  id: string;
  kind: DuelKind;
  question: LocalizedText;
  candidates: Array<DuelSide & { predictions: number }>;
  winnerId?: string;
  startsAt: string;
  endsAt: string;
};

export type SeerLevel = {
  id: string;
  name: LocalizedText;
  requiredPoints: number;
  icon: string;
};

export type ArtDnaPoolResult = {
  id: string;
  keywords: string[];
  movements: { label: LocalizedText; percent: number }[];
  paragraph: LocalizedText;
  mood: LocalizedText;
  active: boolean;
};

export type ArtDnaResult = ArtDnaPoolResult & {
  createdAt: string;
  sourceText: string;
};

export type ChanceCardType =
  | "points"
  | "profile_frame"
  | "profile_background"
  | "showcase_boost"
  | "extra_duel"
  | "collection_badge"
  | "seer_points";

export type ChanceCard = {
  id: string;
  type: ChanceCardType;
  title: LocalizedText;
  description: LocalizedText;
  value?: number;
  probability: number;
  active: boolean;
};

export type ChanceDraw = {
  id: string;
  uid?: string;
  username: string;
  displayName: string;
  cardId?: string;
  cardType?: ChanceCardType;
  score: number;
  drawnAt: string;
  dayKey?: string;
  weekKey?: string;
  monthKey?: string;
  countryCode?: string;
  leaderboardEligible?: boolean;
};

export type ProphecyScore = {
  username: string;
  displayName: string;
  points: number;
  monthPoints: number;
  threeMonthPoints: number;
};

export type ProfileVisit = {
  id: string;
  visitorName: string;
  visitorUsername: string;
  visitedAt: string;
  hidden: boolean;
};

export type PersonalMuseum = {
  id: string;
  ownerId?: string;
  ownerUsername: string;
  ownerName: string;
  name: string;
  bio?: string;
  coverImage: string;
  coverImageUpdatedAt?: string;
  artworkIds: string[];
  active: boolean;
  createdAt: string;
};

export type TimeCapsule = {
  id: string;
  ownerId?: string;
  ownerUsername: string;
  note: string;
  createdAt: string;
  deliverAt: string;
  active: boolean;
  opened: boolean;
  reply?: string;
  repliedAt?: string;
  title?: string;
  artistId?: string;
  artistName?: string;
  artistYears?: string;
  artistImage?: string;
  language?: Language;
  status?: "submitted" | "read" | "draft_reply" | "answered" | "archived";
  replyLanguage?: Language;
  answeredAt?: string;
  answeredBy?: string;
};

export type ArtSystemsNotificationType =
  | "duel"
  | "match"
  | "weekly_winner"
  | "seer_result"
  | "badge"
  | "chance_card"
  | "time_capsule"
  | "message"
  | "like"
  | "system";

export type NotificationCategory = "all" | "system" | "message" | "like" | "social";

export type ArtSystemsNotification = {
  id: string;
  type: ArtSystemsNotificationType;
  category: NotificationCategory;
  title: LocalizedText;
  body: LocalizedText;
  targetPath?: string;
  createdAt: string;
  read: boolean;
  actorUsername?: string;
};

export type FirebaseCollectionName =
  | "duels"
  | "prophecyWeeks"
  | "prophecyPredictions"
  | "seerLevels"
  | "artDnaPools"
  | "artDnaResults"
  | "chanceCards"
  | "chanceCardDraws"
  | "profileVisits"
  | "personalMuseums"
  | "timeCapsules";

export type LimitedFieldName =
  | "biography"
  | "username"
  | "museumName"
  | "museumBio"
  | "timeCapsule"
  | "artDna"
  | "showcaseDescription"
  | "supportMessage"
  | "social"
  | "city"
  | "country"
  | "letterTitle";

export const fieldLimits: Record<LimitedFieldName, { min?: number; max: number }> = {
  biography: { max: 150 },
  username: { min: 3, max: 20 },
  museumName: { min: 3, max: 15 },
  museumBio: { max: 140 },
  timeCapsule: { min: 20, max: 500 },
  letterTitle: { min: 3, max: 60 },
  artDna: { min: 20, max: 600 },
  showcaseDescription: { min: 10, max: 300 },
  supportMessage: { min: 10, max: 500 },
  social: { max: 50 },
  city: { max: 30 },
  country: { max: 30 }
};

export function getText(text: LocalizedText, language: Language) {
  return text[language] ?? text.tr;
}
