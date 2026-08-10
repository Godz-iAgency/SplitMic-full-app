import { buildFaqJsonLd } from "@/lib/events/jsonld";

function toScriptSafeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function FaqJsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: toScriptSafeJson(buildFaqJsonLd()) }}
    />
  );
}
