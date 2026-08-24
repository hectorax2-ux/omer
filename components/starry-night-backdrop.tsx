import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";

const STARSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 168" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0" stop-color="#0a1c40"/>
      <stop offset="0.45" stop-color="#123163"/>
      <stop offset="0.8" stop-color="#1b4c84"/>
      <stop offset="1" stop-color="#225f8f"/>
    </linearGradient>
    <radialGradient id="starGlow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#fde7a6" stop-opacity="0.9"/>
      <stop offset="0.4" stop-color="#f3cd72" stop-opacity="0.45"/>
      <stop offset="1" stop-color="#f3cd72" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="moonGlow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#fbe7a0" stop-opacity="0.95"/>
      <stop offset="0.45" stop-color="#f4c869" stop-opacity="0.5"/>
      <stop offset="1" stop-color="#f4c869" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="hills" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#13335f"/>
      <stop offset="1" stop-color="#0a1f3d"/>
    </linearGradient>
    <linearGradient id="cypress" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#123a2c"/>
      <stop offset="1" stop-color="#06160f"/>
    </linearGradient>
    <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#060e1e" stop-opacity="0"/>
      <stop offset="1" stop-color="#060e1e" stop-opacity="0.6"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="320" height="168" fill="url(#sky)"/>
  <g stroke="#cdddf3" stroke-opacity="0.16" stroke-width="1.4" fill="none">
    <path d="M-6,22 C50,10 110,30 165,20 C220,10 280,28 326,18"/>
    <path d="M-6,46 C52,36 112,56 168,46 C224,36 284,54 326,44"/>
    <path d="M-6,72 C54,64 96,52 150,66 C210,82 270,70 326,78"/>
    <path d="M-6,98 C40,90 90,104 150,96 C210,88 270,102 326,96"/>
  </g>
  <g fill="none" stroke-linecap="round">
    <path d="M104,80 C100,58 130,48 148,62 C166,76 158,102 132,102 C112,102 104,86 116,76 C124,69 138,74 136,86" stroke="#dfe9f7" stroke-opacity="0.4" stroke-width="3"/>
    <path d="M110,80 C108,66 126,60 138,70" stroke="#f3cd72" stroke-opacity="0.32" stroke-width="2"/>
    <path d="M176,104 C172,86 198,80 210,94 C220,105 210,124 192,120 C180,117 178,104 188,99" stroke="#dfe9f7" stroke-opacity="0.34" stroke-width="2.6"/>
    <path d="M236,40 C232,28 250,24 260,34" stroke="#cdddf3" stroke-opacity="0.28" stroke-width="2"/>
  </g>
  <circle cx="280" cy="40" r="30" fill="url(#moonGlow)"/>
  <circle cx="280" cy="40" r="14" fill="#f8de8c"/>
  <circle cx="285" cy="37" r="12" fill="#f3cd72" fill-opacity="0.55"/>
  <g>
    <circle cx="30" cy="34" r="10.2" fill="url(#starGlow)"/><circle cx="30" cy="34" r="3" fill="#fff7d6"/>
    <circle cx="58" cy="26" r="7.48" fill="url(#starGlow)"/><circle cx="58" cy="26" r="2.2" fill="#fff7d6"/>
    <circle cx="42" cy="66" r="8.84" fill="url(#starGlow)"/><circle cx="42" cy="66" r="2.6" fill="#fff7d6"/>
    <circle cx="27" cy="92" r="7.48" fill="url(#starGlow)"/><circle cx="27" cy="92" r="2.2" fill="#fff7d6"/>
    <circle cx="72" cy="104" r="8.16" fill="url(#starGlow)"/><circle cx="72" cy="104" r="2.4" fill="#fff7d6"/>
    <circle cx="118" cy="36" r="7.48" fill="url(#starGlow)"/><circle cx="118" cy="36" r="2.2" fill="#fff7d6"/>
    <circle cx="150" cy="58" r="9.52" fill="url(#starGlow)"/><circle cx="150" cy="58" r="2.8" fill="#fff7d6"/>
    <circle cx="196" cy="96" r="8.84" fill="url(#starGlow)"/><circle cx="196" cy="96" r="2.6" fill="#fff7d6"/>
    <circle cx="232" cy="44" r="8.16" fill="url(#starGlow)"/><circle cx="232" cy="44" r="2.4" fill="#fff7d6"/>
    <circle cx="256" cy="80" r="6.8" fill="url(#starGlow)"/><circle cx="256" cy="80" r="2" fill="#fff7d6"/>
  </g>
  <path d="M0,124 C60,112 120,132 180,120 C240,108 300,126 320,120 L320,168 L0,168 Z" fill="url(#hills)"/>
  <g fill="#0a1f3a" fill-opacity="0.92">
    <path d="M150,128 L150,118 L156,112 L162,118 L162,128 Z"/>
    <rect x="138" y="122" width="10" height="8"/>
    <rect x="166" y="123" width="12" height="7"/>
    <rect x="182" y="124" width="9" height="6"/>
  </g>
  <g fill="#f4c869" fill-opacity="0.85">
    <rect x="141" y="124" width="2" height="2"/>
    <rect x="169" y="125" width="2" height="2"/>
    <rect x="154" y="120" width="1.6" height="1.6"/>
  </g>
  <path d="M44,168 C30,150 33,120 39,98 C43,82 35,68 44,50 C48,40 45,28 52,17 C58,28 54,42 58,56 C64,76 56,96 59,118 C61,138 56,156 51,168 Z" fill="url(#cypress)"/>
  <path d="M48,150 C42,138 45,120 49,104 C52,92 47,80 52,66" stroke="#1c5038" stroke-opacity="0.5" stroke-width="1.4" fill="none"/>
  <rect x="0" y="92" width="320" height="76" fill="url(#scrim)"/>
</svg>`;

const starryNightUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(STARSVG)}`;

export function StarryNightBackdrop() {
  return (
    <View style={styles.wrap} pointerEvents="none">
      <Image source={{ uri: starryNightUri }} style={styles.image} contentFit="cover" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  image: { width: "100%", height: "100%" }
});
