import MessagesScreen from "../messages/index";
import { TabScreenMountGate } from "@/components/tab-screen-mount-gate";
import { useLanguage } from "@/hooks/use-language";

export default function MessagesTabScreen() {
  const { language } = useLanguage();
  const title = language === "tr" ? "Mesajlar" : language === "ru" ? "Сообщения" : language === "uz" ? "Xabarlar" : "Messages";
  return <TabScreenMountGate title={title}><MessagesScreen /></TabScreenMountGate>;
}
