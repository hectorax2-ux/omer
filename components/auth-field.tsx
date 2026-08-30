import { ReactNode, useState } from "react";
import { Platform, StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/hooks/use-app-theme";
import { getThemeColors } from "@/constants/theme";

export function AuthField({ icon, label, trailing, ...props }: TextInputProps & {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  trailing?: ReactNode;
}) {
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const [focused, setFocused] = useState(false);
  return <View style={styles.field}>
    {Platform.OS === "web" ? <style>{`
      input[data-testid="auth-field-input"] { background: ${colors.panelSoft}; color: ${colors.ivory}; outline: none; }
      input[data-testid="auth-field-input"]:-webkit-autofill,
      input[data-testid="auth-field-input"]:-webkit-autofill:hover,
      input[data-testid="auth-field-input"]:-webkit-autofill:focus {
        -webkit-box-shadow: 0 0 0 1000px ${colors.panelSoft} inset !important;
        -webkit-text-fill-color: ${colors.ivory} !important;
        caret-color: ${colors.ivory};
      }
    `}</style> : null}
    <Text style={[styles.label, { color: colors.ivory }]}>{label}</Text>
    <View style={[styles.inputSurface, { backgroundColor: colors.panelSoft, borderColor: focused ? colors.gold : colors.line }]}>
      <Ionicons name={icon} size={18} color={colors.gold} />
      <TextInput {...props} testID="auth-field-input" accessibilityLabel={label} autoCapitalize="none" autoCorrect={false}
        placeholderTextColor={colors.muted} onFocus={(event) => { setFocused(true); props.onFocus?.(event); }}
        onBlur={(event) => { setFocused(false); props.onBlur?.(event); }} style={[styles.input, { color: colors.ivory, backgroundColor: colors.panelSoft }, props.style]} />
      {trailing}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  field: { gap: 4, minWidth: 0, marginBottom: 4 },
  label: { fontSize: 11, lineHeight: 14, fontWeight: "600" },
  inputSurface: { minHeight: 46, borderRadius: 12, borderWidth: 1, paddingLeft: 12, paddingRight: 4, flexDirection: "row", alignItems: "center", gap: 8, overflow: "hidden" },
  input: { flex: 1, minWidth: 0, fontSize: 15, fontWeight: "400", paddingVertical: 10, paddingRight: 8 }
});
