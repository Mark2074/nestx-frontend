import { useMemo } from "react";
import { countries } from "countries-list";

export type SearchTab = "posts" | "users" | "events";

const PROFILE_TYPES = ["male", "female", "couple", "gay", "trans"] as const;

const LANGUAGES: string[] = ["it", "en", "es", "fr", "de", "pt", "ru", "tr", "ar", "zh", "ja", "ko"];

function vipOnlyLabel(canUseVipFilters: boolean) {
  return canUseVipFilters ? "" : "VIP only";
}

function canUseFilter(
  tab: SearchTab,
  filter: "profileType" | "country" | "language",
  canUseVipFilters: boolean
) {
  if (tab === "events") {
    if (filter === "language") return canUseVipFilters;
    return true; // profileType + country => base + vip
  }

  // posts/users: VIP or admin
  return canUseVipFilters;
}

export default function SearchFilters(props: {
  tab: SearchTab;
  isVip: boolean;
  isAdmin?: boolean;

  profileType: string;
  country: string;
  language: string;

  setProfileType: (v: string) => void;
  setCountry: (v: string) => void;
  setLanguage: (v: string) => void;
}) {
  const {
    tab,
    isVip,
    isAdmin = false,
    profileType,
    country,
    language,
    setProfileType,
    setCountry,
    setLanguage,
  } = props;

  const canUseVipFilters = isVip || isAdmin;

  const COUNTRY_OPTIONS = useMemo(
    () =>
      Object.values(countries)
        .map((c) => c.name)
        .sort((a, b) => a.localeCompare(b)),
    []
  );

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: 10,
        marginBottom: 14,
      }}
    >
      {/* ProfileType */}
      <div>
        <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>ProfileType</div>
        <select
          value={profileType}
          onChange={(e) => setProfileType(e.target.value)}
          disabled={!canUseFilter(tab, "profileType", canUseVipFilters)}
          title={!canUseFilter(tab, "profileType", canUseVipFilters) ? vipOnlyLabel(canUseVipFilters) : ""}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.04)",
            color: "inherit",
            opacity: !canUseFilter(tab, "profileType", canUseVipFilters) ? 0.55 : 1,
          }}
        >
          <option value="">Any</option>
          {PROFILE_TYPES.map((pt) => (
            <option key={pt} value={pt}>
              {pt}
            </option>
          ))}
        </select>
      </div>

      {/* Country */}
      <div>
        <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>Country</div>
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          disabled={!canUseFilter(tab, "country", canUseVipFilters)}
          title={!canUseFilter(tab, "country", canUseVipFilters) ? vipOnlyLabel(canUseVipFilters) : ""}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.04)",
            color: "inherit",
            opacity: !canUseFilter(tab, "country", canUseVipFilters) ? 0.55 : 1,
          }}
        >
          <option value="">Any</option>
          {COUNTRY_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Language */}
      <div>
        <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>Language</div>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          disabled={!canUseFilter(tab, "language", canUseVipFilters)}
          title={!canUseFilter(tab, "language", canUseVipFilters) ? vipOnlyLabel(canUseVipFilters) : ""}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.04)",
            color: "inherit",
            opacity: !canUseFilter(tab, "language", canUseVipFilters) ? 0.55 : 1,
          }}
        >
          <option value="">Any</option>
          {LANGUAGES.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
