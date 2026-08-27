import { ArtAtlasLoader } from "@/components/art-atlas-loader";

type NavigationTransitionProps = {
  visible: boolean;
  label?: string;
  bottomInset?: number;
};

export function NavigationTransition({ visible, label, bottomInset = 0 }: NavigationTransitionProps) {
  if (!visible) return null;
  return <ArtAtlasLoader visible label={label} variant="overlay" bottomInset={bottomInset} />;
}
