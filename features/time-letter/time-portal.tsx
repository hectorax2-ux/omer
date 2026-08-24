import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Ellipse } from "react-native-svg";
import { CoverImage } from "@/components/cover-image";
import { hexAlpha } from "@/constants/design";
import { getThemeColors } from "@/constants/theme";
import { Artist, Language } from "@/types/content";

type ThemeColors = ReturnType<typeof getThemeColors>;

const FEATURED_KEYS = ["van gogh", "da vinci", "dalí", "dali", "picasso"];

const REST = [
  { x: 0, y: -0.34, scale: 1, opacity: 1, duration: 16000, dx: 6, dy: 4 },
  { x: -0.36, y: 0.04, scale: 0.92, opacity: 0.82, duration: 18000, dx: -7, dy: 5 },
  { x: 0.34, y: -0.12, scale: 0.78, opacity: 0.55, duration: 14000, dx: 5, dy: -4 },
  { x: -0.16, y: 0.32, scale: 0.86, opacity: 0.7, duration: 20000, dx: -4, dy: 6 }
];

export function pickOrbitArtists(artists: Artist[]) {
  const withImage = artists.filter((artist) => artist.image);
  const preferred = FEATURED_KEYS.flatMap((key) => {
    const match = withImage.find((artist) => artistSearchBlob(artist).includes(key));
    return match ? [match] : [];
  });
  const unique = [...new Map(preferred.map((artist) => [artist.id, artist])).values()];
  const rest = withImage.filter((artist) => !unique.some((item) => item.id === artist.id));
  return [...unique, ...rest].slice(0, 4);
}

function artistSearchBlob(artist: Artist) {
  return [artist.name.tr, artist.name.en, artist.name.ru, artist.name.uz].join(" ").toLocaleLowerCase("tr");
}

export function TimePortal({
  colors,
  dispatch,
  glow,
  height,
  language,
  orbitArtists,
  reducedMotion,
  selectedArtist,
  width
}: {
  colors: ThemeColors;
  dispatch: Animated.Value;
  glow: Animated.Value;
  height: number;
  language: Language;
  orbitArtists: Artist[];
  reducedMotion: boolean;
  selectedArtist: Artist | null;
  width: number;
}) {
  const breath = useRef(new Animated.Value(0)).current;
  const lock = useRef(new Animated.Value(selectedArtist ? 1 : 0)).current;
  const particle = useRef(new Animated.Value(0)).current;
  const compact = width < 360;
  const medal = compact ? 44 : 52;
  const core = compact ? 82 : 92;
  const lockedMedal = compact ? 82 : 92;

  useEffect(() => {
    breath.stopAnimation();
    particle.stopAnimation();
    if (reducedMotion) {
      breath.setValue(0);
      particle.setValue(0);
      return undefined;
    }
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(breath, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(breath, { toValue: 0, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true })
    ]));
    const drift = Animated.loop(Animated.timing(particle, { toValue: 1, duration: 28000, easing: Easing.linear, useNativeDriver: true }));
    pulse.start();
    drift.start();
    return () => {
      pulse.stop();
      drift.stop();
    };
  }, [breath, particle, reducedMotion]);

  useEffect(() => {
    Animated.timing(lock, {
      toValue: selectedArtist ? 1 : 0,
      duration: reducedMotion ? 0 : 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [lock, reducedMotion, selectedArtist]);

  return (
    <View style={{ width, height, alignItems: "center", justifyContent: "center" }}>
      <View pointerEvents="none" style={[styles.coreLight, {
        width: core * 1.55,
        height: core * 1.55,
        backgroundColor: hexAlpha(colors.plum, 0.14)
      }]} />

      <FaintOrbit color={hexAlpha(colors.plum, 0.22)} height={height * 0.62} tilt="-18deg" width={width * 0.92} />
      <FaintOrbit color={hexAlpha(colors.gold, 0.14)} height={height * 0.48} tilt="16deg" width={width * 0.72} />

      <Animated.View pointerEvents="none" style={{
        position: "absolute",
        width: width * 0.78,
        height: height * 0.52,
        opacity: lock.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.18] }),
        transform: [{ rotate: particle.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }, { scaleY: 0.46 }]
      }}>
        {[0, 0.28, 0.57, 0.81].map((slot, index) => (
          <View
            key={`spark-${index}`}
            style={{
              position: "absolute",
              top: "50%",
              left: `${slot * 100}%`,
              width: index === 1 ? 4 : 3,
              height: index === 1 ? 4 : 3,
              marginTop: -2,
              borderRadius: 2,
              backgroundColor: index % 2 ? colors.gold : colors.plum,
              opacity: 0.55
            }}
          />
        ))}
      </Animated.View>

      <Animated.View style={{
        position: "absolute",
        width: core,
        height: core,
        alignItems: "center",
        justifyContent: "center",
        opacity: lock.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
        transform: [
          { scale: Animated.multiply(breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] }), glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] })) }
        ]
      }}>
        <View style={[styles.core, {
          borderColor: hexAlpha(colors.gold, 0.42),
          backgroundColor: hexAlpha(colors.navy, 0.92),
          shadowColor: colors.plum
        }]}>
          <View style={[styles.coreInner, { backgroundColor: hexAlpha(colors.plum, 0.18), borderColor: hexAlpha(colors.plum, 0.28) }]} />
          <Ionicons color={colors.ivory} name="hourglass-outline" size={Math.round(core * 0.28)} />
        </View>
      </Animated.View>

      {orbitArtists.map((artist, index) => (
        <GalleryPortrait
          artist={artist}
          colors={colors}
          height={height}
          index={index}
          key={artist.id}
          lock={lock}
          lockedMedal={lockedMedal}
          medal={medal}
          reducedMotion={reducedMotion}
          selected={selectedArtist?.id === artist.id}
          selectedAny={Boolean(selectedArtist)}
          width={width}
        />
      ))}

      {selectedArtist && !orbitArtists.some((artist) => artist.id === selectedArtist.id) ? (
        <SelectedCenter artist={selectedArtist} colors={colors} lock={lock} size={lockedMedal} />
      ) : null}

      {selectedArtist ? (
        <Animated.View pointerEvents="none" style={[styles.selectedMeta, { opacity: lock }]}>
          <Text numberOfLines={1} style={[styles.selectedName, { color: colors.ivory }]}>{selectedArtist.name[language]}</Text>
          {selectedArtist.life ? <Text numberOfLines={1} style={[styles.selectedLife, { color: colors.gold }]}>{selectedArtist.life}</Text> : null}
        </Animated.View>
      ) : null}

      <Animated.View pointerEvents="none" style={{
        position: "absolute",
        opacity: dispatch.interpolate({ inputRange: [0, 0.2, 0.75, 1], outputRange: [0, 0.9, 0.9, 0] }),
        transform: [{ translateY: dispatch.interpolate({ inputRange: [0, 1], outputRange: [18, -28] }) }]
      }}>
        <View style={{ width: 2, height: 22, borderRadius: 1, backgroundColor: hexAlpha(colors.gold, 0.7) }} />
      </Animated.View>
    </View>
  );
}

function FaintOrbit({ color, height, tilt, width }: { color: string; height: number; tilt: string; width: number }) {
  return (
    <View pointerEvents="none" style={{ position: "absolute", width, height, transform: [{ rotate: tilt }] }}>
      <Svg height="100%" viewBox="0 0 100 100" width="100%">
        <Ellipse cx="50" cy="50" fill="none" rx="47" ry="47" stroke={color} strokeWidth="0.6" />
      </Svg>
    </View>
  );
}

function GalleryPortrait({
  artist,
  colors,
  height,
  index,
  lock,
  lockedMedal,
  medal,
  reducedMotion,
  selected,
  selectedAny,
  width
}: {
  artist: Artist;
  colors: ThemeColors;
  height: number;
  index: number;
  lock: Animated.Value;
  lockedMedal: number;
  medal: number;
  reducedMotion: boolean;
  selected: boolean;
  selectedAny: boolean;
  width: number;
}) {
  const rest = REST[index] ?? REST[0];
  const drift = useRef(new Animated.Value(0)).current;
  const restX = rest.x * width;
  const restY = rest.y * height;

  useEffect(() => {
    drift.stopAnimation();
    if (reducedMotion) {
      drift.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(drift, { toValue: 1, duration: rest.duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(drift, { toValue: 0, duration: rest.duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true })
    ]));
    loop.start();
    return () => loop.stop();
  }, [drift, reducedMotion, rest.duration]);

  const idleX = reducedMotion ? 0 : drift.interpolate({ inputRange: [0, 1], outputRange: [-rest.dx, rest.dx] });
  const idleY = reducedMotion ? 0 : drift.interpolate({ inputRange: [0, 1], outputRange: [-rest.dy, rest.dy] });
  const idleScale = reducedMotion ? rest.scale : drift.interpolate({ inputRange: [0, 1], outputRange: [rest.scale * 0.97, rest.scale * 1.03] });
  const lockScale = lockedMedal / medal;

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        width: medal,
        height: medal,
        marginLeft: -medal / 2,
        marginTop: -medal / 2,
        opacity: selected
          ? 1
          : selectedAny
            ? lock.interpolate({ inputRange: [0, 1], outputRange: [rest.opacity, 0.22] })
            : rest.opacity,
        transform: [
          { translateX: selected ? lock.interpolate({ inputRange: [0, 1], outputRange: [restX, 0] }) : restX },
          { translateY: selected ? lock.interpolate({ inputRange: [0, 1], outputRange: [restY, -6] }) : restY },
          { translateX: selected ? 0 : idleX },
          { translateY: selected ? 0 : idleY },
          { scale: selected ? lock.interpolate({ inputRange: [0, 1], outputRange: [rest.scale, lockScale] }) : idleScale }
        ]
      }}
    >
      <View style={[styles.medal, {
        borderColor: selected ? colors.gold : hexAlpha(colors.plum, 0.7),
        backgroundColor: colors.navy,
        shadowColor: selected ? colors.gold : colors.plum
      }]}>
        {artist.image ? (
          <CoverImage imageFocus={artist.imageFocus} source={{ uri: artist.image }} style={styles.medalImage} />
        ) : null}
      </View>
      {selected ? (
        <View style={[styles.seal, { backgroundColor: colors.navy, borderColor: colors.gold }]}>
          <Ionicons color={colors.gold} name="hourglass" size={9} />
        </View>
      ) : null}
    </Animated.View>
  );
}

function SelectedCenter({
  artist,
  colors,
  lock,
  size
}: {
  artist: Artist;
  colors: ThemeColors;
  lock: Animated.Value;
  size: number;
}) {
  return (
    <Animated.View pointerEvents="none" style={{
      position: "absolute",
      width: size,
      height: size,
      marginLeft: -size / 2,
      marginTop: -size / 2,
      opacity: lock,
      transform: [{ scale: lock.interpolate({ inputRange: [0, 1], outputRange: [0.84, 1] }) }]
    }}>
      <View style={[styles.medal, { borderColor: colors.gold, backgroundColor: colors.navy, shadowColor: colors.gold }]}>
        {artist.image ? <CoverImage imageFocus={artist.imageFocus} source={{ uri: artist.image }} style={styles.medalImage} /> : null}
        <View style={[styles.seal, { backgroundColor: colors.navy, borderColor: colors.gold }]}>
          <Ionicons color={colors.gold} name="hourglass" size={9} />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  coreLight: { position: "absolute", borderRadius: 999 },
  core: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8
  },
  coreInner: { position: "absolute", width: "68%", height: "68%", borderRadius: 999, borderWidth: 1 },
  medal: {
    width: "100%",
    height: "100%",
    borderRadius: 999,
    overflow: "hidden",
    borderWidth: 1.5,
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5
  },
  medalImage: { width: "100%", height: "100%" },
  seal: { position: "absolute", right: 2, bottom: 2, width: 18, height: 18, borderRadius: 9, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  selectedMeta: { position: "absolute", bottom: 8, left: 16, right: 16, alignItems: "center" },
  selectedName: { fontSize: 13, fontWeight: "700", letterSpacing: 0.2, textAlign: "center" },
  selectedLife: { marginTop: 2, fontSize: 11, fontWeight: "600", textAlign: "center" }
});
