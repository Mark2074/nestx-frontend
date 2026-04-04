import { useEffect, useState } from "react";
import { api } from "../../api/nestxApi";
import type { MeProfile } from "../../api/nestxApi";
import { COUNTRIES } from "../../constants/countries";

type Props = {
  me: MeProfile;
  setMe: (v: MeProfile) => void;
  onClose: () => void;
};

const PROFILE_TYPE_OPTIONS = ["male", "female", "couple", "gay", "trans"];

const LANGUAGE_OPTIONS = [
  "it",
  "en",
  "fr",
  "de",
  "es",
  "pt",
  "ro",
  "pl",
];

const COUNTRY_OPTIONS = COUNTRIES.map((c) => String(c).trim().toLowerCase());

export default function ProfileEditorCard({ me, setMe, onClose }: Props) {
  // =========================
  // STATE
  // =========================
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [area, setArea] = useState("");
  const [profileType, setProfileType] = useState("");
  const [language, setLanguage] = useState("");
  const [languages, setLanguages] = useState(""); // comma separated
  const [isPrivate, setIsPrivate] = useState(false);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  // =========================
  // HYDRATE FROM ME
  // =========================
  useEffect(() => {
    if (!me) return;

    setDisplayName(me.displayName || "");
    setBio(me.bio || "");
    const normalizedArea = String(me.area || "").trim().toLowerCase();
    setArea(COUNTRY_OPTIONS.includes(normalizedArea) ? normalizedArea : "");
    setProfileType(me.profileType || "");
    setLanguage((me.language || "").toLowerCase());
    setLanguages(((me as any).languages || []).join(", "));
    setIsPrivate(!!me.isPrivate);
  }, [me]);

  // =========================
  // SAVE
  // =========================
  async function handleSave() {
    setErr("");
    setOk("");

    const a = area.trim();
    const lang = language.trim().toLowerCase();

    if (!a) {
      setErr("Area is required.");
      return;
    }
    if (a.length > 120) {
      setErr("Area too long (max 120).");
      return;
    }
    if (!lang || !/^[a-z]{2,3}$/.test(lang)) {
      setErr("Invalid primary language.");
      return;
    }

    const normalizedProfileType = profileType.trim().toLowerCase();

    if (!PROFILE_TYPE_OPTIONS.includes(normalizedProfileType)) {
      setErr("Invalid profile type.");
      return;
    }

    if (!COUNTRY_OPTIONS.includes(a.toLowerCase())) {
      setErr("Invalid area.");
      return;
    }

    if (!LANGUAGE_OPTIONS.includes(lang)) {
      setErr("Invalid primary language.");
      return;
    }

    let extra = languages
      .split(",")
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean);

    extra = Array.from(new Set(extra));

    if (extra.some((x) => !LANGUAGE_OPTIONS.includes(x))) {
      setErr("Invalid extra language.");
      return;
    }
    if (extra.includes(lang)) {
      setErr("Extra languages cannot include primary language.");
      return;
    }
    if (extra.length > 5) {
      setErr("Max 5 extra languages.");
      return;
    }

    const payload: any = {
      displayName: displayName.trim(),
      bio: bio.slice(0, 500),
      area: a.toLowerCase(),
      profileType: normalizedProfileType,
      language: lang,
      languages: extra,
      isPrivate,
    };

    setSaving(true);
    try {
      const res = await api.profileUpdate(payload);
      const next =
        (res as any)?.profile ??
        (res as any)?.data?.profile ??
        (res as any)?.data ??
        res;

      if (next) setMe(next as MeProfile);
      setOk("Profile saved.");
      onClose();
    } catch (e: any) {
      setErr(e?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  // =========================
  // UI
  // =========================
  return (
    <div
      style={{
        marginTop: 14,
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 16,
        background: "rgba(255,255,255,0.03)",
        padding: 12,
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: 10 }}>Edit profile</h3>

      {err ? (
        <div style={{ marginBottom: 10, color: "#ffb3b3", fontWeight: 800 }}>
          {err}
        </div>
      ) : null}

      {ok ? (
        <div style={{ marginBottom: 10, color: "#9cffc8", fontWeight: 800 }}>
          {ok}
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
        <div>
          <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 6 }}>
            Display name
          </div>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 12, boxSizing: "border-box" }}
          />
        </div>

        <div>
          <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 6 }}>
            Profile type
          </div>
          <select
            value={profileType}
            onChange={(e) => setProfileType(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 12, boxSizing: "border-box" }}
          >
            <option value="">Select profile type</option>
            {PROFILE_TYPE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 6 }}>
            Area (required)
          </div>
          <select
            value={area}
            onChange={(e) => setArea(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 12, boxSizing: "border-box" }}
          >
            <option value="">Select country</option>
            {COUNTRIES.map((c) => (
              <option key={c} value={c.toLowerCase()}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 6 }}>
            Primary language (required)
          </div>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 12, boxSizing: "border-box" }}
          >
            <option value="">Select primary language</option>
            {LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 6 }}>
          Extra languages (comma separated, supported: IT, EN, FR, DE, ES, PT, RO, PL)
        </div>
        <input
          value={languages}
          onChange={(e) => setLanguages(e.target.value)}
          placeholder="en, fr, es"
          style={{ width: "100%", padding: "10px 12px", borderRadius: 12, boxSizing: "border-box" }}
        />
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 6 }}>
          Bio (max 500)
        </div>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={500}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 12,
            minHeight: 90,
            boxSizing: "border-box",
          }}
        />
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center" }}>
        <input
          type="checkbox"
          checked={isPrivate}
          onChange={(e) => setIsPrivate(e.target.checked)}
        />
        <div style={{ fontWeight: 900 }}>Private profile</div>
      </div>

      <div style={{ marginTop: 12 }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            fontWeight: 900,
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}
