import { collection, limit, onSnapshot, query, where, type Unsubscribe } from "firebase/firestore";
import { firestoreDb } from "./core";
import type { LanguageCode, LocalizedString } from "@/src/types/firestore";
import { FavoriteDocument, LikeDocument } from "@/src/types/firestore";
import type { ReadDocument } from "./read-service";
import type { UserRatingRecord } from "./rating-service";

export type BookFilmDocument = {
  id: string;
  type?: "book" | "film";
  language?: LanguageCode | "all";
  title?: LocalizedString | string;
  description?: LocalizedString | string;
  imageURL?: string;
  image?: string;
  imageUrl?: string;
  coverImage?: string;
  rating?: number;
  voteCount?: number;
  status?: string;
};

export type BookFilmEngagement = {
  favorites: string[];
  seenIds: string[];
  likedIds: string[];
  userRatings: Record<string, number>;
};

function localizedText(value: LocalizedString | string | undefined, language: LanguageCode, fallback: string) {
  if (typeof value === "string") return value;
  if (!value) return fallback;
  return value[language] || value.tr || value.en || value.ru || value.uz || fallback;
}

export function mapBookFilmDocument(item: BookFilmDocument, language: LanguageCode) {
  return {
    id: item.id,
    kind: item.type === "film" ? "film" as const : "book" as const,
    title: localizedText(item.title, language, "Art Atlas"),
    image: item.imageURL || item.image || item.imageUrl || item.coverImage || "",
    description: localizedText(item.description, language, ""),
    score: typeof item.rating === "number" ? item.rating : 8,
    votes: typeof item.voteCount === "number" ? item.voteCount : 0,
    language: item.language
  };
}

export function subscribePublishedBookFilms(
  language: LanguageCode,
  onChange: (items: ReturnType<typeof mapBookFilmDocument>[]) => void,
  onError?: () => void
): Unsubscribe {
  return onSnapshot(
    query(
      collection(firestoreDb, "bookFilms"),
      where("status", "==", "published"),
      limit(120)
    ),
    (snapshot) => {
      onChange(snapshot.docs.map((item) => mapBookFilmDocument({ id: item.id, ...item.data() } as BookFilmDocument, language)));
    },
    () => {
      onError?.();
      onChange([]);
    }
  );
}

export function subscribeUserBookFilmEngagement(
  uid: string,
  onChange: (engagement: BookFilmEngagement) => void
): Unsubscribe {
  const next: BookFilmEngagement = {
    favorites: [],
    seenIds: [],
    likedIds: [],
    userRatings: {}
  };

  function publish() {
    onChange({
      favorites: [...next.favorites],
      seenIds: [...next.seenIds],
      likedIds: [...next.likedIds],
      userRatings: { ...next.userRatings }
    });
  }

  const unsubscribers = [
    onSnapshot(
      query(collection(firestoreDb, "favorites"), where("userId", "==", uid)),
      (snapshot) => {
        next.favorites = snapshot.docs
          .map((item) => ({ id: item.id, ...item.data() } as FavoriteDocument))
          .filter((item) => item.targetType === "bookFilm")
          .map((item) => item.targetId);
        publish();
      },
      () => {
        next.favorites = [];
        publish();
      }
    ),
    onSnapshot(
      query(collection(firestoreDb, "reads"), where("userId", "==", uid)),
      (snapshot) => {
        next.seenIds = snapshot.docs
          .map((item) => ({ id: item.id, ...item.data() } as ReadDocument))
          .filter((item) => item.targetType === "bookFilm")
          .map((item) => item.targetId);
        publish();
      },
      () => {
        next.seenIds = [];
        publish();
      }
    ),
    onSnapshot(
      query(collection(firestoreDb, "likes"), where("userId", "==", uid)),
      (snapshot) => {
        next.likedIds = snapshot.docs
          .map((item) => ({ id: item.id, ...item.data() } as LikeDocument))
          .filter((item) => item.targetType === "bookFilm" && item.value === "like")
          .map((item) => item.targetId);
        publish();
      },
      () => {
        next.likedIds = [];
        publish();
      }
    ),
    onSnapshot(
      query(
        collection(firestoreDb, "ratings"),
        where("uid", "==", uid),
        where("targetType", "==", "bookFilm"),
        limit(500)
      ),
      (snapshot) => {
        next.userRatings = Object.fromEntries(snapshot.docs.map((item) => {
          const data = item.data() as UserRatingRecord & { targetId: string; value: number };
          return [String(data.targetId), Number(data.value) || 0];
        }));
        publish();
      },
      () => {
        next.userRatings = {};
        publish();
      }
    )
  ];

  return () => {
    unsubscribers.forEach((unsubscribe) => unsubscribe());
  };
}
