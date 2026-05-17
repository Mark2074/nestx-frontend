export const EVENT_CATEGORY_OPTIONS = [
  { value: "announcements", label: "Events & Announcements" },
  { value: "art", label: "Art & Drawing" },
  { value: "business", label: "Business & Entrepreneurship" },
  { value: "coding", label: "Coding & Development" },
  { value: "comedy", label: "Comedy" },
  { value: "community", label: "Community Talk" },
  { value: "coaching", label: "Advice / Coaching" },
  { value: "daily_life", label: "Daily Life" },
  { value: "debate", label: "Opinions & Debate" },
  { value: "design", label: "Design & Creative" },
  { value: "diy", label: "DIY & Makers" },
  { value: "experimental", label: "Experimental" },
  { value: "fashion", label: "Fashion & Style" },
  { value: "finance_investing", label: "Finance & Investing" },
  { value: "fitness", label: "Fitness & Health" },
  { value: "food", label: "Food & Cooking" },
  { value: "gaming", label: "Gaming" },
  { value: "history_culture", label: "History & Culture" },
  { value: "live_shows", label: "Live Shows" },
  { value: "news", label: "News & Commentary" },
  { value: "NSFW", label: "NSFW" },
  { value: "psychology", label: "Psychology & Mind" },
  { value: "qa_chat", label: "Q&A / Chat" },
  { value: "science", label: "Science & Research" },
  { value: "storytelling", label: "Storytelling" },
  { value: "technology_ai", label: "Technology & AI" },
  { value: "travel", label: "Travel" },
  { value: "tutorials", label: "Tutorials & How-To" },
] as const;

const CATEGORY_LABELS = EVENT_CATEGORY_OPTIONS.reduce<Record<string, string>>((acc, item) => {
  acc[item.value.toLowerCase()] = item.label;
  return acc;
}, {});

export function normalizeCategoryKey(value: any): string {
  const key = String(value || "").trim();
  if (!key) return "";
  return key.toLowerCase();
}

export function isNsfwCategory(value: any): boolean {
  return normalizeCategoryKey(value) === "nsfw";
}

export function isHotEvent(item: any): boolean {
  const scope = String(
    item?.contentScope ||
      item?.eventContentScope ||
      item?.meta?.contentScope ||
      item?.data?.contentScope ||
      item?.content ||
      ""
  )
    .trim()
    .toUpperCase();

  return scope === "HOT" || isNsfwCategory(item?.category || item?.eventCategory || item?.meta?.category || item?.data?.category);
}

export function getEventDisplayCategory(itemOrCategory: any, maybeScope?: any): string {
  const item =
    itemOrCategory && typeof itemOrCategory === "object"
      ? itemOrCategory
      : { category: itemOrCategory, contentScope: maybeScope };

  if (isHotEvent(item)) return "NSFW";

  const key = normalizeCategoryKey(item?.category || item?.eventCategory || item?.meta?.category || item?.data?.category);
  if (!key || key === "general") return "";

  return CATEGORY_LABELS[key] || titleCase(key.replace(/[_-]+/g, " "));
}

export function categoryValueToApiKey(value: string): string {
  return isNsfwCategory(value) ? "nsfw" : normalizeCategoryKey(value);
}

export function categoryMatchesSelection(item: any, selectedCategories: string[]): boolean {
  const selected = selectedCategories.map(categoryValueToApiKey).filter(Boolean);
  const hot = isHotEvent(item);

  if (!selected.length) return !hot;
  if (hot) return selected.includes("nsfw");

  const key = normalizeCategoryKey(item?.category || item?.eventCategory || item?.meta?.category || item?.data?.category);
  return Boolean(key && selected.includes(key));
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
