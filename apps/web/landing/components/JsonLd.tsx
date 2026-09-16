type JsonLdProps = {
  data: Record<string, unknown>;
};

/** Structured-data script tag; escapes "<" so content can't break out of the JSON. */
export default function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
