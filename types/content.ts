import type { ImageFocus } from "@/firebase/shared/image-focus";

export type { ImageFocus };

export type Language = "tr" | "en" | "ru" | "uz";

export type LocalizedText = Record<Language, string>;

export type Artwork = {
  id: string;
  year: string;
  createdAt?: { toMillis?: () => number } | null;
  publishedAt?: { toMillis?: () => number } | null;
  pinned?: boolean;
  origin: string;
  country?: LocalizedText;
  tags?: LocalizedText[];
  image: string;
  imageFocus?: ImageFocus;
  title: LocalizedText;
  artist: LocalizedText;
  period: LocalizedText;
  description: LocalizedText;
  detail?: LocalizedText;
};

export type QuizQuestion = {
  id: string;
  image: string;
  imageFocus?: ImageFocus;
  question: LocalizedText;
  options: Record<Language, string[]>;
  answerIndex: number;
};

export type ArtEvent = {
  id: string;
  language: Language;
  date: string;
  type: LocalizedText;
  title: LocalizedText;
  location: LocalizedText;
};

export type Artist = {
  id: string;
  image: string;
  imageFocus?: ImageFocus;
  name: LocalizedText;
  life: string;
  country: LocalizedText;
  movement: LocalizedText;
  biography: LocalizedText;
  featuredArtworkIds: string[];
};

export type ArtStory = {
  id: string;
  language?: Language | "all";
  translationGroupId?: string;
  image: string;
  imageFocus?: ImageFocus;
  readTime: LocalizedText;
  title: LocalizedText;
  excerpt: LocalizedText;
  body: LocalizedText;
  createdAt?: { toMillis?: () => number } | null;
  publishedAt?: { toMillis?: () => number } | null;
  source?: "art_atlas" | "member";
  category?: string;
  authorId?: string;
  authorUsername?: string;
  authorDisplayName?: string;
};

export type CountryCommunity = {
  id: string;
  name: LocalizedText;
  code: string;
  members: number;
};

export type AppNotification = {
  id: string;
  icon: string;
  targetPath?: string;
  title: LocalizedText;
  body: LocalizedText;
  date: string;
};

export type Museum = {
  id: string;
  image: string;
  imageFocus?: ImageFocus;
  name: LocalizedText;
  city: LocalizedText;
  country: LocalizedText;
  description: LocalizedText;
  artworkIds: string[];
};
