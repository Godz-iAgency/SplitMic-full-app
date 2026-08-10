import {
  Guitar,
  Building2,
  MicVocal,
  Disc3,
  Tent,
  DoorOpen,
  Piano,
  Truck,
  type LucideProps,
} from "lucide-react";
import type { DirectoryCategory } from "@/lib/directory/categories";

/** Mirrors components/landing/PlayerTypeIcon for the 8 directory categories. */
const ICONS: Record<DirectoryCategory, React.ComponentType<LucideProps>> = {
  venue: Building2,
  band: Guitar,
  talent_buyer: MicVocal,
  record_label: Disc3,
  festival: Tent,
  rehearsal_studio: DoorOpen,
  instrument_rental: Piano,
  backline: Truck,
};

export function DirectoryCategoryIcon({
  category,
  ...props
}: { category: DirectoryCategory } & LucideProps) {
  const Icon = ICONS[category];
  return <Icon aria-hidden="true" {...props} />;
}
