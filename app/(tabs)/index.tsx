import HomeExperienceScreen from "@/features/home/home-screen";
import { TabScreenMountGate } from "@/components/tab-screen-mount-gate";

export default function HomeTabScreen() {
  return <TabScreenMountGate title="Art Atlas"><HomeExperienceScreen /></TabScreenMountGate>;
}
