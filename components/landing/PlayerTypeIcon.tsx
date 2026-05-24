import { Guitar, Building2, MicVocal, Tent, Disc3 } from "lucide-react";
import type { PlayerType } from "@/lib/types";

type Props = {
  type: PlayerType;
  className?: string;
  strokeWidth?: number;
};

// Renders the right Lucide icon for each player type.
// Used in both the player type cards and the modal header.
export function PlayerTypeIcon({ type, className, strokeWidth = 1.5 }: Props) {
  const props = { className, strokeWidth };

  switch (type) {
    case "band":
      return <Guitar {...props} />;
    case "venue":
      return <Building2 {...props} />;
    case "talent_buyer":
      return <MicVocal {...props} />;
    case "festival":
      return <Tent {...props} />;
    case "record_label":
      return <Disc3 {...props} />;
    default:
      return null;
  }
}
