import { buildEventsJsonLd } from "@/lib/events/jsonld";
import type { LiveEventCard } from "@/lib/events/queries";

type Props = {
  events: LiveEventCard[];
  baseUrl: string;
};

/** The `<` escape guards against a `</script>` breakout if any third-party
 * scraped text (artist/venue name) ever contained it. */
function toScriptSafeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function EventsJsonLd({ events, baseUrl }: Props) {
  if (events.length === 0) return null;
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: toScriptSafeJson(buildEventsJsonLd(events, baseUrl)),
      }}
    />
  );
}
