import { createContext, PropsWithChildren, useEffect, useMemo, useState } from "react";
import { usePathname } from "expo-router";
import { demoArtDnaPools, demoSeerLevels } from "@/data/art-systems";
import { useAccount } from "@/hooks/use-account";
import { useLanguage } from "@/hooks/use-language";
import { useSocial } from "@/hooks/use-social";
import { useRegisterRefresh } from "@/providers/refresh-provider";
import { useStartupPhase } from "@/hooks/use-startup-phase";
import { resolveCountryCode } from "@/utils/country-utils";
import {
  ArtDnaPoolResult,
  ArtDnaResult,
  ArtDuel,
  ArtSystemsNotification,
  ChanceCard,
  ChanceDraw,
  PersonalMuseum,
  ProphecyScore,
  ProphecyWeek,
  SeerLevel,
  TimeCapsule,
  fieldLimits
} from "@/types/art-systems";
import { NotificationDocument } from "@/src/types/firestore";
import {
  castOrChangeDuelVote,
  createPersonalMuseumDocument,
  upsertProphecyPrediction,
  getDuelVote,
  getChanceCardDraw,
  getProphecyPrediction,
  ArtDuelDocument,
  listActiveChanceCards,
  listProphecyWeeksForDisplay,
  listSeerScores,
  getSeerScore,
  listRankingOverrides,
  listChanceCardDraws,
  listPublicPersonalMuseums,
  listPersonalMuseumsForOwner,
  listUserChanceCardDraws,
  PersonalMuseumDocument,
  RankingOverrideDocument,
  TimeCapsuleDocument,
  updatePersonalMuseumDocument
} from "@/src/services/firebase/art-systems-service";
import { submitArtistLetterRemote } from "@/src/services/firebase/artist-letter-service";
import { openChanceCard } from "@/src/services/firebase/chance-card-service";
import { hasExpiredActiveDuel, requestDuelRotationCatchUp } from "@/src/services/firebase/duel-automation-service";
import { listUserNotifications, markNotificationRead, notificationVisibleInApp } from "@/src/services/firebase/notification-service";
import { duelCopy } from "@/app/i18n/duels";
import { msg, msgFormat, systemMessages } from "@/app/i18n/system-messages";
import { getNextArtistLetterResetAt, isSameArtistLetterWindow } from "@/utils/artist-letter-window";
import { isOwnedMuseum, isOwnedTimeCapsule } from "@/utils/user-identity";
import {
  formatProphecyCountdown,
  getProphecyChangeCooldownRemainingMs,
  getProphecyLastWriteAt,
  type ProphecyPredictionTimes
} from "@/app/utils/prophecy-prediction";
import { firestoreDb } from "@/src/services/firebase";
import { collection, limit, onSnapshot, query, where } from "firebase/firestore";
import { notificationTargetsAccount as matchesNotificationTarget } from "@/firebase/shared/notification-targeting";

const emptyProphecyWeeks: Record<ProphecyWeek["kind"], ProphecyWeek> = {
  artwork: { id: "", kind: "artwork", question: { tr: "", en: "", ru: "", uz: "" }, candidates: [], startsAt: "", endsAt: "" },
  artist: { id: "", kind: "artist", question: { tr: "", en: "", ru: "", uz: "" }, candidates: [], startsAt: "", endsAt: "" }
};

const defaultChanceCard: ChanceCard = {
  id: "daily-luck-points",
  type: "points",
  title: {
    tr: "Günlük şans puanı",
    en: "Daily luck score",
    ru: "Ежедневный балл удачи",
    uz: "Kunlik omad balli"
  },
  description: {
    tr: "Her gün 1-100 arası şans puanı verir.",
    en: "Gives a daily luck score from 1 to 100.",
    ru: "Дает ежедневный балл удачи от 1 до 100.",
    uz: "Har kuni 1 dan 100 gacha omad balli beradi."
  },
  value: 0,
  probability: 1,
  active: true
};

type ArtSystemsContextValue = {
  duels: ArtDuel[];
  prophecyWeek: ProphecyWeek;
  prophecyWeeks: Record<ProphecyWeek["kind"], ProphecyWeek>;
  seerLevels: SeerLevel[];
  artDnaPools: ArtDnaPoolResult[];
  chanceCards: ChanceCard[];
  personalMuseums: PersonalMuseum[];
  timeCapsules: TimeCapsule[];
  notifications: ArtSystemsNotification[];
  markSystemNotificationRead: (notificationId: string) => void;
  markAllSystemNotificationsRead: () => void;
  userDuelVotes: Record<string, string>;
  userDuelVoteChanges: Record<string, number>;
  prophecyPrediction?: string;
  prophecyPredictions: Record<string, string>;
  prophecyPredictionTimes: Record<string, ProphecyPredictionTimes>;
  seerPoints: number;
  prophecyScores: ProphecyScore[];
  artDnaResult?: ArtDnaResult;
  lastChanceDraw?: { card: ChanceCard; drawnAt: string; score: number; activeScore: number };
  chanceDraws: ChanceDraw[];
  chanceDrawsLoaded: boolean;
  rankingOverrides: RankingOverrideDocument[];
  voteDuel: (duelId: string, optionId: string) => Promise<{ ok: boolean; message: string }>;
  makeProphecyPrediction: (weekId: string, candidateId: string) => Promise<{ ok: boolean; message: string }>;
  analyzeArtDna: (text: string) => { ok: boolean; message: string; result?: ArtDnaResult };
  drawChanceCard: () => Promise<{ ok: boolean; message: string; card?: ChanceCard }>;
  createMuseum: (name: string) => { ok: boolean; message: string };
  updateMuseum: (museumId: string, patch: Partial<Pick<PersonalMuseum, "name" | "coverImage" | "bio" | "coverImageUpdatedAt">>) => { ok: boolean; message: string };
  deleteMuseum: (museumId: string) => { ok: boolean; message: string };
  toggleArtworkInMuseum: (artworkId: string) => { ok: boolean; message: string; inMuseum: boolean };
  toggleMuseumActive: (museumId: string, active: boolean) => void;
  createTimeCapsule: (input: { note: string; title: string; artistId: string; artistName: string }) => Promise<{ ok: boolean; message: string }>;
};

const emptyValue: ArtSystemsContextValue = {
  duels: [],
  prophecyWeek: emptyProphecyWeeks.artist,
  prophecyWeeks: emptyProphecyWeeks,
  seerLevels: [],
  artDnaPools: [],
  chanceCards: [],
  personalMuseums: [],
  timeCapsules: [],
  notifications: [],
  markSystemNotificationRead: () => undefined,
  markAllSystemNotificationsRead: () => undefined,
  userDuelVotes: {},
  userDuelVoteChanges: {},
  seerPoints: 1,
  prophecyPredictions: {},
  prophecyPredictionTimes: {},
  prophecyScores: [],
  chanceDraws: [],
  chanceDrawsLoaded: false,
  rankingOverrides: [],
  voteDuel: async () => ({ ok: false, message: "" }),
  makeProphecyPrediction: async () => ({ ok: false, message: "" }),
  analyzeArtDna: () => ({ ok: false, message: "" }),
  drawChanceCard: async () => ({ ok: false, message: "" }),
  createMuseum: () => ({ ok: false, message: "" }),
  updateMuseum: () => ({ ok: false, message: "" }),
  deleteMuseum: () => ({ ok: false, message: "" }),
  toggleArtworkInMuseum: () => ({ ok: false, message: "", inMuseum: false }),
  toggleMuseumActive: () => undefined,
  createTimeCapsule: async () => ({ ok: false, message: "" })
};

export const ArtSystemsContext = createContext<ArtSystemsContextValue>(emptyValue);

export function ArtSystemsProvider({ children }: PropsWithChildren) {
  const { account } = useAccount();
  const { language } = useLanguage();
  const { isUserBlocked, isUserSuspended } = useSocial();
  const pathname = usePathname();
  const startupPhase = useStartupPhase();
  const notificationNetworkReady = startupPhase !== "critical" || pathname.startsWith("/notifications");
  const needsDuels = pathname.startsWith("/duels");
  const needsChance = pathname.startsWith("/chance-card") || pathname.startsWith("/leaderboards");
  const needsProphecy = needsDuels || pathname.startsWith("/leaderboards");
  const needsMuseums = pathname.startsWith("/account")
    || pathname.startsWith("/profile")
    || pathname.startsWith("/my-museum")
    || pathname.startsWith("/museum")
    || pathname.startsWith("/artwork")
    || pathname.startsWith("/user-museum");
  const needsTimeCapsules = pathname.startsWith("/time-capsule");
  const [duels, setDuels] = useState<ArtDuel[]>([]);
  const [userDuelVotes, setUserDuelVotes] = useState<Record<string, string>>({});
  const [userDuelVoteChanges, setUserDuelVoteChanges] = useState<Record<string, number>>({});
  const [prophecyWeeks, setProphecyWeeks] = useState<Record<ProphecyWeek["kind"], ProphecyWeek>>(emptyProphecyWeeks);
  const [prophecyPredictions, setProphecyPredictions] = useState<Record<string, string>>({});
  const [prophecyPredictionTimes, setProphecyPredictionTimes] = useState<Record<string, ProphecyPredictionTimes>>({});
  const [prophecyScores, setProphecyScores] = useState<ProphecyScore[]>([]);
  const [seerPoints, setSeerPoints] = useState(1);
  const [artDnaResult, setArtDnaResult] = useState<ArtDnaResult | undefined>();
  const [chanceCards, setChanceCards] = useState<ChanceCard[]>([]);
  const [lastChanceDraw, setLastChanceDraw] = useState<{ card: ChanceCard; drawnAt: string; score: number; activeScore: number } | undefined>();
  const [chanceDraws, setChanceDraws] = useState<ChanceDraw[]>([]);
  const [chanceDrawsLoaded, setChanceDrawsLoaded] = useState(false);
  const [rankingOverrides, setRankingOverrides] = useState<RankingOverrideDocument[]>([]);
  const [personalMuseums, setPersonalMuseums] = useState<PersonalMuseum[]>([]);
  const [museumCreationLocks, setMuseumCreationLocks] = useState<Record<string, string>>({});
  const [timeCapsules, setTimeCapsules] = useState<TimeCapsule[]>([]);
  const [remoteNotifications, setRemoteNotifications] = useState<ArtSystemsNotification[]>([]);
  const [remoteReadNotificationIds, setRemoteReadNotificationIds] = useState<string[]>([]);
  const [optimisticReadNotificationIds, setOptimisticReadNotificationIds] = useState<string[]>([]);
  const [refreshCounter, setRefreshCounter] = useState(0);

  useRegisterRefresh(() => setRefreshCounter((value) => value + 1), { scope: ["/", "/games", "/leaderboards", "/chance-card", "/duels", "/my-museum", "/museum"] });

  useEffect(() => {
    if (!needsDuels) return;
    const duelsQuery = query(collection(firestoreDb, "duels"), where("active", "==", true), limit(20));
    return onSnapshot(
      duelsQuery,
      (snapshot) => {
        const stale = snapshot.docs.some((docSnap) => hasExpiredActiveDuel(docSnap.data().endsAt));
        if (stale || !snapshot.docs.length) {
          void requestDuelRotationCatchUp();
        }
        setDuels(
          snapshot.docs
            .map((docSnap) => mapRemoteDuel({ id: docSnap.id, ...docSnap.data() } as ArtDuelDocument))
            .filter((duel) => !duel.status || duel.status === "active")
            .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())
        );
      },
      () => setDuels([])
    );
  }, [needsDuels]);

  useEffect(() => {
    if (!needsChance) return;
    let active = true;
    listActiveChanceCards()
      .then((remoteCards) => {
        if (!active) return;
        const activeCards = remoteCards.filter((card) => card.active !== false);
        setChanceCards(activeCards.length ? activeCards : [defaultChanceCard]);
      })
      .catch(() => {
        if (active) setChanceCards([defaultChanceCard]);
      });

    return () => {
      active = false;
    };
  }, [needsChance, refreshCounter]);

  useEffect(() => {
    if (!needsProphecy) return;
    let active = true;
    const loadWeeks = () => {
      listProphecyWeeksForDisplay(40)
        .then((remoteWeeks) => {
          if (!active) return;
          const next = { ...emptyProphecyWeeks };
          (["artwork", "artist"] as const).forEach((kind) => {
            const kindWeeks = remoteWeeks.filter((week) => week.kind === kind);
            const selected = kindWeeks.find((week) => (week as ProphecyWeek & { status?: string }).status === "active");
            if (!selected) return;
            next[kind] = {
              ...selected,
              kind,
              startsAt: toIsoDateString(selected.startsAt),
              endsAt: toIsoDateString(selected.endsAt),
              candidates: Array.isArray(selected.candidates) ? selected.candidates : []
            } as ProphecyWeek;
          });
          setProphecyWeeks(next);
        })
        .catch(() => {
          if (active) setProphecyWeeks(emptyProphecyWeeks);
        });
    };
    loadWeeks();
    const timer = setInterval(loadWeeks, 60_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [needsProphecy, refreshCounter]);

  useEffect(() => {
    if (!needsProphecy) return;
    let active = true;
    listSeerScores(100)
      .then((scores) => {
        if (!active) return;
        setProphecyScores(
          scores
            .filter((score) => (score.rankingStatus ?? "active") === "active")
            .map((score) => ({
            username: score.username,
            displayName: score.displayName,
            points: score.totalPoints ?? 0,
            monthPoints: score.monthPoints ?? 0,
            threeMonthPoints: score.threeMonthPoints ?? 0
          }))
        );
      })
      .catch(() => {
        if (active) setProphecyScores([]);
      });
    return () => {
      active = false;
    };
  }, [needsProphecy, refreshCounter]);

  useEffect(() => {
    if (!needsProphecy && !needsChance) return;
    let active = true;
    listRankingOverrides(300)
      .then((overrides) => {
        if (!active) return;
        setRankingOverrides(overrides);
      })
      .catch(() => {
        if (active) setRankingOverrides([]);
      });
    return () => {
      active = false;
    };
  }, [needsChance, needsProphecy, refreshCounter]);

  useEffect(() => {
    if (!account.uid || !needsProphecy) return;
    let active = true;
    getSeerScore(account.uid)
      .then((score) => {
        if (!active) return;
        setSeerPoints(score?.totalPoints ?? 1);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [account.uid, needsProphecy, refreshCounter]);

  useEffect(() => {
    let active = true;
    if (!account.uid || !needsProphecy) {
      setProphecyPredictions({});
      setProphecyPredictionTimes({});
      return () => {
        active = false;
      };
    }
    const weeks = Object.values(prophecyWeeks).filter((week) => week.id);
    if (!weeks.length) {
      setProphecyPredictions({});
      setProphecyPredictionTimes({});
      return () => {
        active = false;
      };
    }
    Promise.all(weeks.map((week) => getProphecyPrediction(week.id, account.uid).then((prediction) => [week.id, prediction] as const)))
      .then((entries) => {
        if (!active) return;
        const next: Record<string, string> = {};
        const times: Record<string, ProphecyPredictionTimes> = {};
        entries.forEach(([weekId, prediction]) => {
          if (!prediction?.candidateId) return;
          next[weekId] = prediction.candidateId;
          times[weekId] = {
            createdAt: prediction.createdAt ? timestampToIso(prediction.createdAt) : undefined,
            updatedAt: prediction.updatedAt ? timestampToIso(prediction.updatedAt) : undefined
          };
        });
        setProphecyPredictions(next);
        setProphecyPredictionTimes(times);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [account.uid, needsProphecy, prophecyWeeks.artwork.id, prophecyWeeks.artist.id]);

  const duelIdKey = duels.map((duel) => duel.id).sort().join("|");

  useEffect(() => {
    let active = true;
    if (!account.uid || !duelIdKey || !needsDuels) {
      setUserDuelVotes({});
      setUserDuelVoteChanges({});
      return () => {
        active = false;
      };
    }

    Promise.all(duels.map((duel) => getDuelVote(duel.id, account.uid).then((vote) => [duel.id, vote] as const)))
      .then((entries) => {
        if (!active) return;
        const nextVotes: Record<string, string> = {};
        const nextChanges: Record<string, number> = {};
        entries.forEach(([duelId, vote]) => {
          if (!vote) return;
          const duel = duels.find((item) => item.id === duelId);
          if (!duel) return;
          nextVotes[duelId] = vote.side === "a" ? duel.sideA.id : duel.sideB.id;
          nextChanges[duelId] = vote.changeCount ?? 0;
        });
        setUserDuelVotes(nextVotes);
        setUserDuelVoteChanges(nextChanges);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [account.uid, duelIdKey, needsDuels]);

  useEffect(() => {
    if (!needsMuseums && !needsChance) return;
    let active = true;
    if (needsChance) setChanceDrawsLoaded(false);

    Promise.allSettled([
      needsMuseums ? loadPersonalMuseumsMerged(account.uid, account.username) : Promise.resolve([]),
      needsChance ? loadChanceDrawDocuments(account.uid, account.isAdmin) : Promise.resolve([])
    ])
      .then(([museumResult, drawResult]) => {
        if (!active) return;
        if (needsMuseums && museumResult.status === "fulfilled") {
          setPersonalMuseums(museumResult.value);
        }
        if (needsChance) setChanceDraws(drawResult.status === "fulfilled" ? drawResult.value.map(mapChanceDrawDocument) : []);
      })
      .finally(() => {
        if (active && needsChance) setChanceDrawsLoaded(true);
      });

    return () => {
      active = false;
    };
  }, [account.isAdmin, account.uid, account.username, needsChance, needsMuseums, refreshCounter]);

  useEffect(() => {
    if (!account.uid || !needsTimeCapsules) {
      setTimeCapsules([]);
      return;
    }
    const lettersQuery = query(collection(firestoreDb, "timeCapsules"), where("uid", "==", account.uid), limit(50));
    return onSnapshot(
      lettersQuery,
      (snapshot) => {
        setTimeCapsules(
          snapshot.docs
            .map((docSnap) => mapTimeCapsuleDocument({ id: docSnap.id, ...docSnap.data() } as TimeCapsuleDocument))
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        );
      },
      () => setTimeCapsules([])
    );
  }, [account.uid, needsTimeCapsules]);

  useEffect(() => {
    if (!account.uid && !account.username) {
      setLastChanceDraw(undefined);
      return;
    }

    const userTodayDraws = getUserTodayChanceDraws(chanceDraws, account);
    if (!userTodayDraws.length) {
      setLastChanceDraw(undefined);
      return;
    }

    const latestDraw = [...userTodayDraws].sort((a, b) => new Date(b.drawnAt).getTime() - new Date(a.drawnAt).getTime())[0];
    const activeScore = Math.max(...userTodayDraws.map((draw) => draw.score));
    const card = getChanceCardForDraw(latestDraw, chanceCards);
    setLastChanceDraw({ card, drawnAt: latestDraw.drawnAt, score: latestDraw.score, activeScore });
  }, [account.uid, account.username, chanceCards, chanceDraws]);

  useEffect(() => {
    if (!account.uid || !needsMuseums) return;
    setChanceDraws((current) => current.map((draw) => (
      draw.uid === account.uid
        ? { ...draw, username: account.username, displayName: account.displayName }
        : draw
    )));
    setPersonalMuseums((current) => current.map((museum) => (
      isOwnedMuseum(museum, account)
        ? {
          ...museum,
          ownerId: account.uid,
          ownerUsername: account.username,
          ownerName: account.displayName
        }
        : museum
    )));
    loadPersonalMuseumsMerged(account.uid, account.username)
      .then((museums) => setPersonalMuseums(museums))
      .catch(() => undefined);
  }, [account.displayName, account.uid, account.username, needsMuseums]);

  useEffect(() => {
    if (!account.uid) {
      setRemoteNotifications([]);
      setRemoteReadNotificationIds([]);
      setOptimisticReadNotificationIds([]);
      return;
    }
    if (!notificationNetworkReady) return;

    const notificationQuery = query(
      collection(firestoreDb, "notifications"),
      where("status", "==", "published"),
      where("recipientId", "in", [account.uid, "all"]),
      limit(80)
    );

    const unsubscribe = onSnapshot(notificationQuery, (snapshot) => {
      setRemoteNotifications(snapshot.docs
        .filter((item) => {
          return notificationVisibleInApp(item.data()) && matchesNotificationTarget(item.data(), {
            uid: account.uid,
            role: account.role,
            country: account.country,
            countryCode: account.countryCode ?? resolveCountryCode(account.country) ?? undefined,
            isPremium: account.isPremium,
            badges: account.badges,
            staffBadges: account.staffBadges
          }, language);
        })
        .map((item) => mapNotificationDocument({ id: item.id, ...item.data() } as NotificationDocument, account.uid))
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)));
    }, () => {
      listUserNotifications(account.uid, 80).then((items) => {
        setRemoteNotifications(items
          .filter((item) => matchesNotificationTarget(item, {
            uid: account.uid,
            role: account.role,
            country: account.country,
            countryCode: account.countryCode ?? resolveCountryCode(account.country) ?? undefined,
            isPremium: account.isPremium,
            badges: account.badges,
            staffBadges: account.staffBadges
          }, language))
          .map((item) => mapNotificationDocument(item, account.uid))
          .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)));
      }).catch(() => undefined);
    });

    const unsubscribeReads = onSnapshot(
      query(collection(firestoreDb, "notificationReads"), where("userId", "==", account.uid), limit(500)),
      (snapshot) => {
        const readIds = snapshot.docs.map((item) => String(item.data().notificationId ?? "")).filter(Boolean);
        setRemoteReadNotificationIds(readIds);
        setOptimisticReadNotificationIds((current) => current.filter((id) => !readIds.includes(id)));
      },
      () => setRemoteReadNotificationIds([])
    );

    return () => {
      unsubscribe();
      unsubscribeReads();
    };
  }, [account.badges, account.country, account.countryCode, account.isPremium, account.role, account.staffBadges, account.uid, language, notificationNetworkReady]);

  const notifications = useMemo<ArtSystemsNotification[]>(() => {
    const readIds = new Set([...remoteReadNotificationIds, ...optimisticReadNotificationIds]);
    return remoteNotifications.map((item) => readIds.has(item.id) ? { ...item, read: true } : item);
  }, [optimisticReadNotificationIds, remoteNotifications, remoteReadNotificationIds]);

  const visiblePersonalMuseums = useMemo(
    () => personalMuseums.filter((museum) => !isUserSuspended({
      uid: museum.ownerId,
      ownerUsername: museum.ownerUsername,
      ownerName: museum.ownerName
    }) && !isUserBlocked({
      uid: museum.ownerId,
      ownerUsername: museum.ownerUsername,
      ownerName: museum.ownerName
    })),
    [isUserBlocked, isUserSuspended, personalMuseums]
  );

  const visibleProphecyScores = useMemo(
    () => prophecyScores.filter((score) => !isUserSuspended({ username: score.username, displayName: score.displayName })
      && !isUserBlocked({ username: score.username, displayName: score.displayName })),
    [isUserBlocked, isUserSuspended, prophecyScores]
  );

  const visibleChanceDraws = useMemo(
    () => chanceDraws.filter((draw) => !isUserSuspended({ username: draw.username, displayName: draw.displayName })
      && !isUserBlocked({ username: draw.username, displayName: draw.displayName })),
    [chanceDraws, isUserBlocked, isUserSuspended]
  );

  const value = useMemo<ArtSystemsContextValue>(() => ({
    duels,
    prophecyWeek: prophecyWeeks.artist.id ? prophecyWeeks.artist : prophecyWeeks.artwork,
    prophecyWeeks,
    seerLevels: demoSeerLevels,
    artDnaPools: demoArtDnaPools,
    chanceCards,
    personalMuseums: visiblePersonalMuseums,
    timeCapsules,
    notifications,
    markSystemNotificationRead: (notificationId) => {
      if (!account.uid) return;
      setOptimisticReadNotificationIds((current) => current.includes(notificationId) ? current : [...current, notificationId]);
      markNotificationRead(notificationId, account.uid).catch(() => {
        setOptimisticReadNotificationIds((current) => current.filter((id) => id !== notificationId));
      });
    },
    markAllSystemNotificationsRead: () => {
      if (!account.uid) return;
      const unreadIds = notifications.filter((item) => !item.read).map((item) => item.id);
      if (!unreadIds.length) return;
      setOptimisticReadNotificationIds((current) => [...new Set([...current, ...unreadIds])]);
      Promise.allSettled(unreadIds.map((id) => markNotificationRead(id, account.uid))).then((results) => {
        const failedIds = results.flatMap((result, index) => result.status === "rejected" ? [unreadIds[index]] : []);
        if (failedIds.length) {
          setOptimisticReadNotificationIds((current) => current.filter((id) => !failedIds.includes(id)));
        }
      });
    },
    userDuelVotes,
    userDuelVoteChanges,
    prophecyPrediction: prophecyPredictions[prophecyWeeks.artist.id || prophecyWeeks.artwork.id],
    prophecyPredictions,
    prophecyPredictionTimes,
    seerPoints,
    prophecyScores: visibleProphecyScores,
    artDnaResult,
    lastChanceDraw,
    chanceDraws: visibleChanceDraws,
    chanceDrawsLoaded,
    rankingOverrides,
    voteDuel: async (duelId, optionId) => {
      const duel = duels.find((item) => item.id === duelId);
      if (!duel) return { ok: false, message: msg(systemMessages.duel.voteAlreadyCast, language) };
      const selectedSide = optionId === duel.sideA.id ? "A" : optionId === duel.sideB.id ? "B" : undefined;
      if (!selectedSide) return { ok: false, message: msg(systemMessages.duel.voteAlreadyCast, language) };
      const previousVote = userDuelVotes[duelId];
      if (previousVote === optionId) return { ok: false, message: msg(systemMessages.duel.voteAlreadySame, language) };
      if (previousVote && !account.isPremium && !account.isAdmin) return { ok: false, message: msg(systemMessages.duel.voteAlreadyCast, language) };
      if (previousVote && !account.isAdmin && (userDuelVoteChanges[duelId] ?? 0) >= 1) {
        return { ok: false, message: msg(systemMessages.duel.premiumVoteChangeUsed, language) };
      }
      if (!account.uid) {
        return { ok: false, message: msg(systemMessages.duel.signInToVote, language) };
      }
      try {
        await castOrChangeDuelVote(
          duelId,
          account.uid,
          selectedSide === "A" ? "a" : "b",
          Boolean(previousVote && (account.isPremium || account.isAdmin)),
          account.isAdmin
        );
        setUserDuelVotes((current) => ({ ...current, [duelId]: optionId }));
        if (previousVote) {
          setUserDuelVoteChanges((current) => ({ ...current, [duelId]: (current[duelId] ?? 0) + 1 }));
        }
        return { ok: true, message: previousVote ? msg(systemMessages.duel.voteUpdated, language) : msg(systemMessages.duel.voteSaved, language) };
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : msg(systemMessages.duel.voteAlreadyCast, language) };
      }
    },
    makeProphecyPrediction: async (weekId, candidateId) => {
      const week = Object.values(prophecyWeeks).find((item) => item.id === weekId);
      const copy = duelCopy(language);
      if (!week) return { ok: false, message: copy.noActiveProphecy };
      if (!account.uid) return { ok: false, message: msg(systemMessages.duel.signInToPredict, language) };
      const weekStatus = (week as ProphecyWeek & { status?: string }).status;
      if (weekStatus === "finished" || week.winnerId) return { ok: false, message: copy.prophecyNewWeek };

      const existing = prophecyPredictions[weekId];
      const predictionTimes = prophecyPredictionTimes[weekId];
      const withinWindow = isWithinFirstHours(week.startsAt, 48);
      if (!withinWindow) {
        return { ok: false, message: copy.prophecyWindowClosed };
      }
      if (existing) {
        if (!account.isPremium && !account.isAdmin) return { ok: false, message: copy.prophecyLocked };
        if (existing === candidateId) return { ok: false, message: copy.prophecyLockedPremium };
        const cooldownRemaining = getProphecyChangeCooldownRemainingMs(getProphecyLastWriteAt(predictionTimes));
        if (!account.isAdmin && cooldownRemaining > 0) {
          return { ok: false, message: `${copy.prophecyChangeBlocked} ${formatProphecyCountdown(cooldownRemaining)}` };
        }
      }

      const previousWeek = prophecyWeeks[week.kind];
      const nowIso = new Date().toISOString();
      setProphecyPredictions((current) => ({ ...current, [weekId]: candidateId }));
      setProphecyPredictionTimes((current) => ({
        ...current,
        [weekId]: existing
          ? { ...current[weekId], updatedAt: nowIso }
          : { createdAt: nowIso }
      }));
      setProphecyWeeks((current) => ({
        ...current,
        [week.kind]: {
          ...current[week.kind],
          candidates: current[week.kind].candidates.map((candidate) => {
            const predictions = candidate.predictions ?? 0;
            if (existing && candidate.id === existing) return { ...candidate, predictions: Math.max(0, predictions - 1) };
            if (candidate.id === candidateId) return { ...candidate, predictions: predictions + 1 };
            return candidate;
          })
        }
      }));
      try {
        await upsertProphecyPrediction(weekId, account.uid, candidateId, Boolean(existing && (account.isPremium || account.isAdmin)), account.isAdmin);
        return { ok: true, message: existing ? copy.confirmPredictionChangeOk : copy.confirmPredictionOk };
      } catch (error) {
        setProphecyPredictions((current) => {
          const next = { ...current };
          if (existing) next[weekId] = existing;
          else delete next[weekId];
          return next;
        });
        setProphecyPredictionTimes((current) => {
          const next = { ...current };
          if (existing) next[weekId] = predictionTimes ?? { createdAt: nowIso };
          else delete next[weekId];
          return next;
        });
        setProphecyWeeks((current) => ({
          ...current,
          [week.kind]: previousWeek
        }));
        return {
          ok: false,
          message: error instanceof Error ? error.message : copy.prophecyWindowClosed
        };
      }
    },
    analyzeArtDna: (text) => {
      const trimmed = text.trim();
      const limit = fieldLimits.artDna;
      if (trimmed.length < (limit.min ?? 0) || trimmed.length > limit.max) {
        return { ok: false, message: msgFormat(systemMessages.artDna.lengthInvalid, language, { min: limit.min ?? 0, max: limit.max }) };
      }
      if (artDnaResult && isSameDay(artDnaResult.createdAt, new Date().toISOString())) {
        return { ok: false, message: msg(systemMessages.artDna.alreadyCreatedToday, language), result: artDnaResult };
      }
      const selected = selectDnaPool(trimmed);
      const result: ArtDnaResult = { ...selected, sourceText: trimmed, createdAt: new Date().toISOString() };
      setArtDnaResult(result);
      return { ok: true, message: msg(systemMessages.artDna.ready, language), result };
    },
    drawChanceCard: async () => {
      if (!account.uid) {
        return { ok: false, message: msg(systemMessages.chanceCard.signInRequired, language), card: lastChanceDraw?.card };
      }
      if (!chanceDrawsLoaded) {
        return { ok: false, message: msg(systemMessages.chanceCard.loadingDraws, language), card: lastChanceDraw?.card };
      }
      const userTodayDraws = getUserTodayChanceDraws(chanceDraws, account);
      const dailyLimit = account.isPremium ? 2 : 1;
      if (!account.isAdmin && userTodayDraws.length >= dailyLimit) {
        return {
          ok: false,
          message: account.isPremium
            ? msg(systemMessages.chanceCard.premiumSecondUsed, language)
            : msg(systemMessages.chanceCard.dailyLimit, language),
          card: lastChanceDraw?.card
        };
      }
      try {
        const result = await openChanceCard(
          `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`,
          Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
        );
        const previousBest = Math.max(0, ...chanceDraws
          .filter((draw) => isOwnChanceDraw(draw, account) && (draw.dayKey ?? getLocalDayKey(draw.drawnAt)) === result.draw.dayKey)
          .map((draw) => draw.score));
        const activeScore = Math.max(previousBest, result.activeScore, result.draw.score);
        setChanceDraws((current) => [result.draw, ...current.filter((draw) => draw.id !== result.draw.id)]);
        setLastChanceDraw({ card: result.card, drawnAt: result.draw.drawnAt, score: result.draw.score, activeScore });
        if (result.card.type === "seer_points") setSeerPoints((value) => value + (result.card.value ?? 1));
        return {
          ok: true,
          message: activeScore === result.draw.score
            ? msg(systemMessages.chanceCard.openedUpdated, language)
            : msg(systemMessages.chanceCard.openedKeptBest, language),
          card: result.card
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "";
        if (errorMessage.includes("CHANCE_DAILY_LIMIT_REACHED")) {
          return {
            ok: false,
            message: account.isPremium
              ? msg(systemMessages.chanceCard.premiumSecondUsed, language)
              : msg(systemMessages.chanceCard.dailyLimit, language),
            card: lastChanceDraw?.card
          };
        }
        return { ok: false, message: msg(systemMessages.chanceCard.openFailed, language), card: lastChanceDraw?.card };
      }
    },
    createMuseum: (name) => {
      const clean = name.trim().replace(/\s+/g, " ");
      const limit = fieldLimits.museumName;
      if (clean.length < (limit.min ?? 0) || clean.length > limit.max) {
        return { ok: false, message: msgFormat(systemMessages.museum.nameLengthInvalid, language, { min: limit.min ?? 0, max: limit.max }) };
      }
      if (personalMuseums.some((museum) => isOwnedMuseum(museum, account) && museum.active)) {
        return { ok: false, message: msg(systemMessages.museum.onlyOneAllowed, language) };
      }
      const lockKey = account.uid || account.username;
      const lockedAt = museumCreationLocks[lockKey];
      if (!account.isPremium && lockedAt && isSameWeek(lockedAt, new Date().toISOString())) {
        return { ok: false, message: msg(systemMessages.museum.weeklyLimit, language) };
      }
      const museumName = clean.endsWith("Müzesi") ? clean : `${clean} Müzesi`;
      if (!account.uid) {
        return { ok: false, message: msg(systemMessages.museum.signInRequired, language) };
      }
      const museumId = account.uid;
      const localMuseum: PersonalMuseum = {
        id: museumId,
        ownerId: account.uid,
        ownerUsername: account.username,
        ownerName: account.displayName,
        name: museumName,
        bio: "",
        coverImage: "",
        artworkIds: [],
        active: true,
        createdAt: new Date().toISOString()
      };
      setPersonalMuseums((current) => [localMuseum, ...current.filter((museum) => museum.id !== museumId)]);
      createPersonalMuseumDocument({
        id: museumId,
        ownerId: account.uid,
        ownerUsername: localMuseum.ownerUsername,
        ownerName: localMuseum.ownerName,
        name: localMuseum.name,
        bio: localMuseum.bio,
        coverImage: localMuseum.coverImage,
        artworkIds: localMuseum.artworkIds,
        active: localMuseum.active
      }).catch((error) => {
        console.warn("[personalMuseums] create failed", error);
      });
      if (!account.isPremium) {
        setMuseumCreationLocks((current) => ({ ...current, [lockKey]: new Date().toISOString() }));
      }
      return { ok: true, message: msg(systemMessages.museum.created, language) };
    },
    updateMuseum: (museumId, patch) => {
      const museum = personalMuseums.find((item) => item.id === museumId && isOwnedMuseum(item, account));
      if (!museum) return { ok: false, message: msg(systemMessages.museum.notFound, language) };
      const nextName = patch.name?.trim().replace(/\s+/g, " ");
      if (nextName !== undefined) {
        const limit = fieldLimits.museumName;
        if (nextName.length < (limit.min ?? 0) || nextName.length > limit.max) {
          return { ok: false, message: msgFormat(systemMessages.museum.nameLengthInvalid, language, { min: limit.min ?? 0, max: limit.max }) };
        }
      }
      const nextBio = patch.bio?.trim();
      if (nextBio !== undefined && nextBio.length > fieldLimits.museumBio.max) {
        return { ok: false, message: msgFormat(systemMessages.museum.bioTooLong, language, { max: fieldLimits.museumBio.max }) };
      }
      const coverChanged = patch.coverImage !== undefined && patch.coverImage !== museum.coverImage;
      const nextCoverImageUpdatedAt = coverChanged ? new Date().toISOString() : museum.coverImageUpdatedAt;
      setPersonalMuseums((current) => current.map((item) => item.id === museumId ? {
        ...item,
        ...patch,
        name: nextName !== undefined ? (nextName.endsWith("Müzesi") ? nextName : `${nextName} Müzesi`) : item.name,
        bio: nextBio !== undefined ? nextBio : item.bio,
        coverImageUpdatedAt: nextCoverImageUpdatedAt
      } : item));
      updatePersonalMuseumDocument(resolveMuseumDocumentId(museum, account.uid), {
        ...patch,
        name: nextName !== undefined ? (nextName.endsWith("Müzesi") ? nextName : `${nextName} Müzesi`) : museum.name,
        bio: nextBio !== undefined ? nextBio : museum.bio,
        coverImageUpdatedAt: nextCoverImageUpdatedAt
      }).catch((error) => {
        console.warn("[personalMuseums] update failed", error);
      });
      return { ok: true, message: msg(systemMessages.museum.updated, language) };
    },
    deleteMuseum: (museumId) => {
      const museum = personalMuseums.find((item) => item.id === museumId && isOwnedMuseum(item, account));
      if (!museum) return { ok: false, message: msg(systemMessages.museum.notFound, language) };
      setPersonalMuseums((current) => current.map((item) => item.id === museumId ? { ...item, active: false } : item));
      updatePersonalMuseumDocument(resolveMuseumDocumentId(museum, account.uid), { active: false }).catch((error) => {
        console.warn("[personalMuseums] delete failed", error);
      });
      if (!account.isPremium) {
        const lockKey = account.uid || account.username;
        setMuseumCreationLocks((current) => ({ ...current, [lockKey]: new Date().toISOString() }));
      }
      return { ok: true, message: msg(systemMessages.museum.deleted, language) };
    },
    toggleArtworkInMuseum: (artworkId) => {
      const museum = personalMuseums.find((item) => isOwnedMuseum(item, account) && item.active);
      if (!museum) return { ok: false, message: msg(systemMessages.museum.createFirst, language), inMuseum: false };
      if (museum.artworkIds.includes(artworkId)) {
        const nextArtworkIds = museum.artworkIds.filter((id) => id !== artworkId);
        setPersonalMuseums((current) => current.map((item) => item.id === museum.id ? {
          ...item,
          artworkIds: nextArtworkIds
        } : item));
        updatePersonalMuseumDocument(resolveMuseumDocumentId(museum, account.uid), { artworkIds: nextArtworkIds }).catch((error) => {
          console.warn("[personalMuseums] artwork remove failed", error);
        });
        return { ok: true, message: msg(systemMessages.museum.artworkRemoved, language), inMuseum: false };
      }
      if (museum.artworkIds.length >= (account.isPremium ? 100 : 8)) {
        return {
          ok: false,
          message: account.isPremium
            ? msgFormat(systemMessages.museum.artworkLimit, language, { limit: 100 })
            : msg(systemMessages.museum.artworkLimitPremium, language),
          inMuseum: false
        };
      }
      const nextArtworkIds = [...museum.artworkIds, artworkId];
      const nextCoverImage = museum.coverImage;
      setPersonalMuseums((current) => current.map((item) => item.id === museum.id ? {
        ...item,
        coverImage: nextCoverImage,
        artworkIds: nextArtworkIds
      } : item));
      updatePersonalMuseumDocument(resolveMuseumDocumentId(museum, account.uid), { artworkIds: nextArtworkIds, coverImage: nextCoverImage }).catch((error) => {
        console.warn("[personalMuseums] artwork add failed", error);
      });
      return { ok: true, message: msg(systemMessages.museum.artworkAdded, language), inMuseum: true };
    },
    toggleMuseumActive: (museumId, active) => {
      setPersonalMuseums((current) => current.map((museum) => museum.id === museumId ? { ...museum, active } : museum));
      updatePersonalMuseumDocument(resolveMuseumDocumentId({ id: museumId } as PersonalMuseum, account.uid), { active }).catch((error) => {
        console.warn("[personalMuseums] active toggle failed", error);
      });
    },
    createTimeCapsule: async (input) => {
      if (!account.uid) return { ok: false, message: msg(systemMessages.timeCapsule.signInRequired, language) };
      if (!account.isPremium) return { ok: false, message: msg(systemMessages.timeCapsule.premiumOnly, language) };
      const artistId = input.artistId.trim();
      const artistName = input.artistName.trim();
      if (!artistId || !artistName) return { ok: false, message: msg(systemMessages.timeCapsule.artistRequired, language) };
      const title = input.title.trim();
      const titleLimit = fieldLimits.letterTitle;
      if (title.length < (titleLimit.min ?? 0) || title.length > titleLimit.max) {
        return { ok: false, message: msgFormat(systemMessages.timeCapsule.titleInvalid, language, { min: titleLimit.min ?? 0, max: titleLimit.max }) };
      }
      const trimmed = input.note.trim();
      const limit = fieldLimits.timeCapsule;
      if (trimmed.length < (limit.min ?? 0) || trimmed.length > limit.max) {
        return { ok: false, message: msgFormat(systemMessages.timeCapsule.lengthInvalid, language, { min: limit.min ?? 0, max: limit.max }) };
      }
      if (timeCapsules.some((item) => isOwnedTimeCapsule(item, account) && isSameArtistLetterWindow(item.createdAt))) {
        return { ok: false, message: msg(systemMessages.timeCapsule.dailyLimit, language) };
      }
      const createdAt = new Date().toISOString();
      const deliverAt = getNextArtistLetterResetAt().toISOString();
      return submitArtistLetterRemote({
        note: trimmed,
        title,
        artistId,
        artistName,
        language,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
      }).then(({ id: savedId }) => {
        setTimeCapsules((current) => [{
          id: savedId,
          ownerId: account.uid,
          ownerUsername: account.username,
          note: trimmed,
          title,
          artistId,
          artistName,
          createdAt,
          deliverAt,
          active: true,
          opened: false,
          status: "submitted",
          language
        }, ...current]);
        return { ok: true, message: msg(systemMessages.timeCapsule.scheduled, language) };
      }).catch((error) => {
        console.warn("[artistLetter] send failed", error);
        return { ok: false, message: msg(systemMessages.timeCapsule.sendFailed, language) };
      });
    }
  }), [account.displayName, account.isAdmin, account.isPremium, account.uid, account.username, artDnaResult, chanceCards, chanceDraws, chanceDrawsLoaded, duels, language, lastChanceDraw, museumCreationLocks, notifications, personalMuseums, prophecyPredictionTimes, prophecyPredictions, prophecyWeeks, rankingOverrides, seerPoints, timeCapsules, userDuelVoteChanges, userDuelVotes, visibleChanceDraws, visiblePersonalMuseums, visibleProphecyScores]);

  return <ArtSystemsContext.Provider value={value}>{children}</ArtSystemsContext.Provider>;
}

function getLocalDayKey(value: string | Date = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getLocalMonthKey(value: string | Date = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getLocalWeekKey(value: string | Date = new Date()) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  date.setHours(0, 0, 0, 0);
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day);
  return getLocalDayKey(date);
}

function toIsoDateString(value: unknown) {
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return (value.toDate() as Date).toISOString();
  }
  return "";
}

function mapRemoteDuel(duel: ArtDuelDocument): ArtDuel {
  const legacy = duel as ArtDuelDocument & {
    type?: ArtDuel["kind"];
    sideATitle?: string;
    sideBTitle?: string;
    sideASubtitle?: string;
    sideBSubtitle?: string;
    sideAImage?: string;
    sideBImage?: string;
    sideAPoolId?: string;
    sideBPoolId?: string;
  };

  const sideA = duel.sideA ?? {
    id: "a",
    title: { tr: legacy.sideATitle ?? "", en: legacy.sideATitle ?? "", ru: legacy.sideATitle ?? "", uz: legacy.sideATitle ?? "" },
    subtitle: { tr: legacy.sideASubtitle ?? "", en: legacy.sideASubtitle ?? "", ru: legacy.sideASubtitle ?? "", uz: legacy.sideASubtitle ?? "" },
    image: legacy.sideAImage ?? ""
  };
  const sideB = duel.sideB ?? {
    id: "b",
    title: { tr: legacy.sideBTitle ?? "", en: legacy.sideBTitle ?? "", ru: legacy.sideBTitle ?? "", uz: legacy.sideBTitle ?? "" },
    subtitle: { tr: legacy.sideBSubtitle ?? "", en: legacy.sideBSubtitle ?? "", ru: legacy.sideBSubtitle ?? "", uz: legacy.sideBSubtitle ?? "" },
    image: legacy.sideBImage ?? ""
  };

  return {
    id: duel.id,
    kind: duel.kind ?? legacy.type ?? "artwork",
    title: duel.title,
    sideA: { ...sideA, sourceId: sideA.sourceId || legacy.sideAPoolId || (sideA.id !== "a" ? sideA.id : undefined) },
    sideB: { ...sideB, sourceId: sideB.sourceId || legacy.sideBPoolId || (sideB.id !== "b" ? sideB.id : undefined) },
    startsAt: toIsoDateString(duel.startsAt),
    endsAt: toIsoDateString(duel.endsAt),
    status: duel.status ?? "active",
    active: duel.active !== false,
    votesA: duel.votesA ?? 0,
    votesB: duel.votesB ?? 0,
    notificationEnabled: duel.notificationEnabled !== false
  };
}

function isSameDay(a: string, b: string) {
  return getLocalDayKey(a) === getLocalDayKey(b);
}

function isOwnChanceDraw(draw: ChanceDraw, account: { uid?: string | null; username: string }) {
  if (account.uid && draw.uid) return draw.uid === account.uid;
  return draw.username === account.username;
}

function getUserTodayChanceDraws(draws: ChanceDraw[], account: { uid?: string | null; username: string }) {
  const todayKey = getLocalDayKey();
  return draws.filter((draw) => isOwnChanceDraw(draw, account) && (draw.dayKey ?? getLocalDayKey(draw.drawnAt)) === todayKey);
}

function getChanceCardForDraw(draw: ChanceDraw, cards: ChanceCard[] = []): ChanceCard {
  const matchedCard = cards.find((card) => card.id === draw.cardId || card.type === draw.cardType);
  if (matchedCard) return matchedCard;
  return {
    id: draw.cardId ?? `points-${draw.score}`,
    type: "points",
    title: { tr: "Günlük şans puanı", en: "Daily luck score", ru: "Очки удачи", uz: "Kunlik omad balli" },
    description: { tr: "Bugünkü şans kartı sonucu.", en: "Today's chance card result.", ru: "Результат карты удачи за сегодня.", uz: "Bugungi omad kartasi natijasi." },
    value: draw.score,
    probability: 1,
    active: true
  };
}

async function loadChanceDrawDocuments(uid?: string | null, unlimited = false) {
  const ownDraws = uid ? await loadTodayUserChanceDraws(uid, unlimited) : [];
  try {
    const globalDraws = await listChanceCardDraws(1000);
    return mergeChanceDrawDocuments(globalDraws, ownDraws);
  } catch {
    try {
      const userDraws = uid ? await listUserChanceCardDraws(uid, 200) : [];
      return mergeChanceDrawDocuments(userDraws, ownDraws);
    } catch {
      return ownDraws;
    }
  }
}

async function loadTodayUserChanceDraws(uid: string, unlimited: boolean) {
  const todayKey = getLocalDayKey();
  if (unlimited) {
    const draws = await listUserChanceCardDraws(uid, 500);
    return draws.filter((draw) => (draw.dayKey || getLocalDayKey(timestampToIso(draw.drawnAt ?? draw.createdAt))) === todayKey);
  }
  const ids = [1, 2].map((drawNumber) => getChanceDrawDocumentId(uid, todayKey, drawNumber));
  const draws = await Promise.all(ids.map((id) => getChanceCardDraw(id).catch(() => null)));
  return draws.filter((draw): draw is NonNullable<typeof draw> => Boolean(draw));
}

function getChanceDrawDocumentId(uid: string, dayKey: string, drawNumber: number) {
  return `${uid}_${dayKey}_${drawNumber}`;
}

function mergeChanceDrawDocuments<T extends { id: string }>(primary: T[], secondary: T[]) {
  const map = new Map<string, T>();
  [...secondary, ...primary].forEach((item) => map.set(item.id, item));
  return Array.from(map.values());
}

function isSameWeek(a: string, b: string) {
  const first = new Date(a);
  const second = new Date(b);
  const startOfWeek = (date: Date) => {
    const copy = new Date(date);
    const day = (copy.getDay() + 6) % 7;
    copy.setHours(0, 0, 0, 0);
    copy.setDate(copy.getDate() - day);
    return copy.getTime();
  };
  return startOfWeek(first) === startOfWeek(second);
}

function resolveMuseumDocumentId(museum: Pick<PersonalMuseum, "id" | "ownerId">, accountUid?: string) {
  if (!museum.id.startsWith("museum-")) return museum.id;
  return museum.ownerId ?? accountUid ?? museum.id;
}

async function loadPersonalMuseumsMerged(ownerId?: string, ownerUsername?: string) {
  const [publicResult, ownerResult] = await Promise.allSettled([
    listPublicPersonalMuseums(150),
    ownerId ? listPersonalMuseumsForOwner(ownerId, ownerUsername ?? "") : Promise.resolve([])
  ]);

  const merged = new Map<string, PersonalMuseum>();
  if (publicResult.status === "fulfilled") {
    publicResult.value.map(mapPersonalMuseumDocument).forEach((museum) => merged.set(museum.id, museum));
  }
  if (ownerResult.status === "fulfilled") {
    ownerResult.value.map(mapPersonalMuseumDocument).forEach((museum) => merged.set(museum.id, museum));
  }

  return [...merged.values()].filter((museum) => museum.active || (ownerId && (museum.ownerId === ownerId || museum.id === ownerId)));
}

function mapPersonalMuseumDocument(museum: PersonalMuseumDocument): PersonalMuseum {
  return {
    id: museum.id,
    ownerId: museum.ownerId,
    ownerUsername: museum.ownerUsername,
    ownerName: museum.ownerName,
    name: museum.name,
    bio: museum.bio,
    coverImage: museum.coverImage,
    coverImageUpdatedAt: museum.coverImageUpdatedAt,
    artworkIds: museum.artworkIds ?? [],
    active: museum.active,
    createdAt: timestampToIso(museum.createdAt)
  };
}

function mapTimeCapsuleDocument(doc: TimeCapsuleDocument): TimeCapsule {
  const reply = typeof doc.reply === "string" ? doc.reply.trim() : "";
  return {
    id: doc.id,
    ownerId: doc.ownerId || doc.uid,
    ownerUsername: doc.ownerUsername,
    note: typeof doc.noteEncrypted === "string" ? doc.noteEncrypted : "",
    createdAt: toIsoDateString(doc.createdAt) || new Date().toISOString(),
    deliverAt: toIsoDateString(doc.deliverAt),
    active: doc.active !== false,
    opened: Boolean(doc.opened),
    reply: reply || undefined,
    repliedAt: toIsoDateString(doc.repliedAt) || undefined,
    answeredAt: toIsoDateString(doc.answeredAt) || undefined,
    answeredBy: typeof doc.answeredBy === "string" ? doc.answeredBy : undefined,
    replyLanguage: doc.replyLanguage,
    language: doc.language,
    status: doc.status,
    title: typeof doc.title === "string" ? doc.title : undefined,
    artistId: typeof doc.artistId === "string" ? doc.artistId : undefined,
    artistName: typeof doc.artistName === "string" ? doc.artistName : undefined,
    artistYears: typeof doc.artistYears === "string" ? doc.artistYears : undefined,
    artistImage: typeof doc.artistImage === "string" ? doc.artistImage : undefined
  };
}

function mapChanceDrawDocument(draw: { id: string; uid: string; username?: string; displayName?: string; countryCode?: string; cardId?: string; cardType?: ChanceCard["type"]; value?: number; dayKey?: string; weekKey?: string; monthKey?: string; leaderboardEligible?: boolean; drawnAt?: unknown; createdAt: unknown }): ChanceDraw {
  const username = draw.username || draw.uid;
  const drawnAt = timestampToIso(draw.drawnAt ?? draw.createdAt);
  return {
    id: draw.id,
    uid: draw.uid,
    username,
    displayName: draw.displayName || username,
    cardId: draw.cardId,
    cardType: draw.cardType,
    score: typeof draw.value === "number" ? draw.value : 0,
    drawnAt,
    dayKey: draw.dayKey || getLocalDayKey(drawnAt),
    weekKey: draw.weekKey || getLocalWeekKey(drawnAt),
    monthKey: draw.monthKey || getLocalMonthKey(drawnAt),
    countryCode: draw.countryCode,
    leaderboardEligible: draw.leaderboardEligible
  };
}

function timestampToIso(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  return new Date().toISOString();
}

function isWithinFirstHours(startsAt: string, hours: number) {
  const start = new Date(startsAt).getTime();
  return Date.now() >= start && Date.now() <= start + hours * 60 * 60 * 1000;
}

function selectDnaPool(text: string) {
  const lower = text.toLocaleLowerCase("tr");
  const scored = demoArtDnaPools.map((pool) => ({
    pool,
    score: pool.keywords.reduce((total, keyword) => total + (lower.includes(keyword.toLocaleLowerCase("tr")) ? 1 : 0), 0)
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored[0].pool;
}

function mapNotificationDocument(notification: NotificationDocument, uid: string): ArtSystemsNotification {
  const readBy = Array.isArray(notification.readBy) ? notification.readBy : [];
  const title = normalizeLocalized(notification.title, "Art Atlas");
  const body = normalizeLocalized(notification.body, "");
  const category = mapNotificationCategory(notification.type);

  return {
    id: notification.id,
    type: mapNotificationType(notification.type),
    category,
    title,
    body,
    targetPath: notificationTargetPath(notification),
    createdAt: timestampToIso(notification.createdAt),
    read: readBy.includes(uid) || ((notification.recipientId ?? notification.userId) === uid && notification.isRead === true),
    actorUsername: notification.actorUsername
  };
}

function mapNotificationType(type: NotificationDocument["type"]): ArtSystemsNotification["type"] {
  const rawType = String(type);
  if (type === "direct_message") return "message";
  if (type === "post_liked" || type === "post_disliked" || type === "community_image_liked" || type === "community_image_disliked" || type === "comment_liked" || type === "museum_liked" || type === "like") return "like";
  if (type === "system" || type === "system_announcement" || type === "admin_message") return "system";
  if (type === "badge" || rawType.includes("badge")) return "badge";
  if (type === "weekly" || rawType.includes("weekly")) return "weekly_winner";
  if (type === "quiz" || type === "daily_quiz_available" || type === "weekly_quiz_available" || type === "quiz_result") return "match";
  if (type === "time_capsule_due") return "time_capsule";
  if (type === "prophecy_result" || type === "prophecy_correct" || type === "prophecy_wrong" || rawType === "seer_result") return "seer_result";
  if (rawType.includes("duel")) return "duel";
  return "system";
}

function mapNotificationCategory(type: NotificationDocument["type"]): ArtSystemsNotification["category"] {
  if (type === "direct_message") return "message";
  if (
    type === "post_liked"
    || type === "post_disliked"
    || type === "community_image_liked"
    || type === "community_image_disliked"
    || type === "comment_liked"
    || type === "museum_liked"
    || type === "like"
  ) return "like";
  if (
    type === "new_follower"
    || type === "follow"
    || type === "post_commented"
    || type === "community_image_commented"
    || type === "comment_replied"
    || type === "museum_followed"
  ) return "social";
  return "system";
}

function normalizeLocalized(value: unknown, fallback: string) {
  if (typeof value === "string") {
    return { tr: value, en: value, ru: value, uz: value };
  }
  const source = value && typeof value === "object" ? value as Partial<Record<"tr" | "en" | "ru" | "uz", string>> : {};
  const first = source.tr || source.en || source.ru || source.uz || fallback;
  return {
    tr: source.tr || first,
    en: source.en || first,
    ru: source.ru || first,
    uz: source.uz || first
  };
}

function notificationTargetPath(notification: NotificationDocument) {
  if (notification.type === "direct_message" && notification.targetId) return `/messages/${notification.targetId}`;
  if (notification.targetType === "communityImage") return "/ranking";
  if (notification.targetPath) return normalizeNotificationPath(notification.targetPath);
  if (notification.targetType === "post" && notification.targetId) return `/post/${notification.targetId}`;
  if (notification.targetType === "profile" && notification.targetId) return `/profile/${notification.targetId}`;
  if (notification.targetType === "museum" && notification.targetId) return `/museum/${notification.targetId}`;
  if (notification.targetType === "artwork" && notification.targetId) return `/artwork/${notification.targetId}`;
  if (notification.targetType === "duel") return "/duels";
  if (notification.targetType === "quiz") return "/quiz";
  if (notification.targetType === "badge") return "/roles-badges";
  return "/notifications";
}

// Older notifications stored legacy/incorrect deep links; rewrite them to valid routes.
function normalizeNotificationPath(path: string) {
  if (path.startsWith("/weekly/")) return "/ranking";
  if (path.startsWith("/discover/post/")) return `/post/${path.slice("/discover/post/".length)}`;
  if (path.startsWith("/artworks/")) return `/artwork/${path.slice("/artworks/".length)}`;
  return path;
}
