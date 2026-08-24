import { StyleSheet, Text, type StyleProp, type TextStyle } from "react-native";
import { useRouter } from "expo-router";
import { profileRouteParam } from "@/utils/profile-route";

const mentionPattern = /@([a-zA-Z0-9_]{2,32})/g;

type Props = {
  text: string;
  style?: StyleProp<TextStyle>;
  linkStyle?: StyleProp<TextStyle>;
  mine?: boolean;
};

export function MessageMentionText({ text, style, linkStyle, mine }: Props) {
  const router = useRouter();
  const parts = text.split(mentionPattern);

  if (parts.length <= 1) {
    return <Text selectable style={style}>{text}</Text>;
  }

  return (
    <Text selectable style={style}>
      {parts.map((part, index) => {
        if (index % 2 === 1) {
          const username = part;
          return (
            <Text
              key={`${username}-${index}`}
              style={[styles.link, mine ? styles.linkMine : undefined, linkStyle]}
              onPress={() => router.push({
                pathname: "/profile/[name]",
                params: { name: profileRouteParam({ username, displayName: username }) }
              })}
            >
              @{username}
            </Text>
          );
        }
        return part;
      })}
    </Text>
  );
}

const styles = StyleSheet.create({
  link: {
    fontWeight: "800",
    textDecorationLine: "underline"
  },
  linkMine: {
    color: "#15120d"
  }
});
