import { useEffect, useState } from "react";
import { View, type ImageStyle, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import Svg, { Circle, Path } from "react-native-svg";
import { getThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";

export function hasProfilePhoto(uri?: string) {
  return Boolean(uri?.trim());
}

function DefaultProfileAvatarGlyph({ size, backgroundColor, foregroundColor }: { size: number; backgroundColor: string; foregroundColor: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Circle cx={32} cy={32} r={32} fill={backgroundColor} />
      <Circle cx={32} cy={23} r={8.5} fill={foregroundColor} />
      <Path d="M32 34c-9.2 0-16.5 6.3-16.5 15.8V64h33V49.8C48.5 40.3 41.2 34 32 34z" fill={foregroundColor} />
    </Svg>
  );
}

export function ProfileAvatar({
  uri,
  size = 44,
  style,
  borderRadius,
  borderColor
}: {
  uri?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
  borderRadius?: number;
  borderColor?: string;
}) {
  const [failed, setFailed] = useState(false);
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const radius = borderRadius ?? size / 2;
  const frameStyle = {
    width: size,
    height: size,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: borderColor ?? colors.line,
    backgroundColor: colors.panelSoft,
    overflow: "hidden" as const
  };

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  if (!hasProfilePhoto(uri) || failed) {
    return (
      <View style={[frameStyle, style]}>
        <DefaultProfileAvatarGlyph size={size} backgroundColor={colors.panelSoft} foregroundColor={colors.bronze} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: uri!.trim() }}
      style={[frameStyle, style as StyleProp<ImageStyle>]}
      contentFit="cover"
      cachePolicy="memory-disk"
      transition={180}
      onError={() => setFailed(true)}
    />
  );
}
