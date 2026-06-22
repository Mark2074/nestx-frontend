export function formatProfileLanguage(
  language: string,
  additionalLanguages: unknown
) {
  const validAdditionalLanguages = Array.isArray(additionalLanguages)
    ? additionalLanguages
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)
    : [];

  return validAdditionalLanguages.length
    ? `${language} (${validAdditionalLanguages.join(", ")})`
    : language;
}
