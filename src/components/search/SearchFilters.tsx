import { useState } from "react";
import { COUNTRIES } from "../../constants/countries";

export type SearchTab = "posts" | "users" | "events";
type Continent =
  | "Europe"
  | "North America"
  | "South America"
  | "Asia"
  | "Africa"
  | "Oceania";

const PROFILE_TYPES = ["male", "female", "couple", "gay", "trans"] as const;

const LANGUAGES: string[] = ["it", "en", "es", "fr", "de", "pt", "ru", "tr", "ar", "zh", "ja", "ko"];
const CONTINENTS: Continent[] = [
  "Europe",
  "North America",
  "South America",
  "Asia",
  "Africa",
  "Oceania",
];
const CONTINENT_COUNTRIES: Record<Continent, string[]> = {
  Europe: [
    "Aland",
    "Albania",
    "Andorra",
    "Austria",
    "Belarus",
    "Belgium",
    "Bosnia and Herzegovina",
    "Bulgaria",
    "Croatia",
    "Cyprus",
    "Czech Republic",
    "Denmark",
    "Estonia",
    "Faroe Islands",
    "Finland",
    "France",
    "Germany",
    "Gibraltar",
    "Greece",
    "Guernsey",
    "Hungary",
    "Iceland",
    "Ireland",
    "Isle of Man",
    "Italy",
    "Jersey",
    "Kosovo",
    "Latvia",
    "Liechtenstein",
    "Lithuania",
    "Luxembourg",
    "Malta",
    "Moldova",
    "Monaco",
    "Montenegro",
    "Netherlands",
    "North Macedonia",
    "Norway",
    "Poland",
    "Portugal",
    "Romania",
    "San Marino",
    "Serbia",
    "Slovakia",
    "Slovenia",
    "Spain",
    "Svalbard and Jan Mayen",
    "Sweden",
    "Switzerland",
    "Ukraine",
    "United Kingdom",
    "Vatican City",
  ],
  "North America": [
    "Anguilla",
    "Antigua and Barbuda",
    "Aruba",
    "Bahamas",
    "Barbados",
    "Belize",
    "Bermuda",
    "Bonaire",
    "British Virgin Islands",
    "Canada",
    "Cayman Islands",
    "Costa Rica",
    "Cuba",
    "Curacao",
    "Dominica",
    "Dominican Republic",
    "El Salvador",
    "Greenland",
    "Grenada",
    "Guadeloupe",
    "Guatemala",
    "Haiti",
    "Honduras",
    "Jamaica",
    "Martinique",
    "Mexico",
    "Montserrat",
    "Nicaragua",
    "Panama",
    "Puerto Rico",
    "Saint Barthelemy",
    "Saint Kitts and Nevis",
    "Saint Lucia",
    "Saint Martin",
    "Saint Pierre and Miquelon",
    "Saint Vincent and the Grenadines",
    "Sint Maarten",
    "Trinidad and Tobago",
    "Turks and Caicos Islands",
    "U.S. Virgin Islands",
    "United States",
  ],
  "South America": [
    "Argentina",
    "Bolivia",
    "Brazil",
    "Chile",
    "Colombia",
    "Ecuador",
    "Falkland Islands",
    "French Guiana",
    "Guyana",
    "Paraguay",
    "Peru",
    "Suriname",
    "Uruguay",
    "Venezuela",
  ],
  Asia: [
    "Afghanistan",
    "Armenia",
    "Azerbaijan",
    "Bahrain",
    "Bangladesh",
    "Bhutan",
    "British Indian Ocean Territory",
    "Brunei",
    "Cambodia",
    "China",
    "Christmas Island",
    "Cocos (Keeling) Islands",
    "Georgia",
    "Hong Kong",
    "India",
    "Indonesia",
    "Iran",
    "Iraq",
    "Israel",
    "Japan",
    "Jordan",
    "Kazakhstan",
    "Kuwait",
    "Kyrgyzstan",
    "Laos",
    "Lebanon",
    "Macao",
    "Malaysia",
    "Maldives",
    "Mongolia",
    "Myanmar (Burma)",
    "Nepal",
    "North Korea",
    "Oman",
    "Pakistan",
    "Palestine",
    "Philippines",
    "Qatar",
    "Russia",
    "Saudi Arabia",
    "Singapore",
    "South Korea",
    "Sri Lanka",
    "Syria",
    "Taiwan",
    "Tajikistan",
    "Thailand",
    "Turkey",
    "Turkmenistan",
    "United Arab Emirates",
    "Uzbekistan",
    "Vietnam",
    "Yemen",
  ],
  Africa: [
    "Algeria",
    "Angola",
    "Benin",
    "Botswana",
    "Burkina Faso",
    "Burundi",
    "Cameroon",
    "Cape Verde",
    "Central African Republic",
    "Chad",
    "Comoros",
    "Democratic Republic of the Congo",
    "Djibouti",
    "Egypt",
    "Equatorial Guinea",
    "Eritrea",
    "Eswatini",
    "Ethiopia",
    "Gabon",
    "Gambia",
    "Ghana",
    "Guinea",
    "Guinea-Bissau",
    "Ivory Coast",
    "Kenya",
    "Lesotho",
    "Liberia",
    "Libya",
    "Madagascar",
    "Malawi",
    "Mali",
    "Mauritania",
    "Mauritius",
    "Mayotte",
    "Morocco",
    "Mozambique",
    "Namibia",
    "Niger",
    "Nigeria",
    "Republic of the Congo",
    "Reunion",
    "Rwanda",
    "Saint Helena",
    "Sao Tome and Principe",
    "Senegal",
    "Seychelles",
    "Sierra Leone",
    "Somalia",
    "South Africa",
    "South Sudan",
    "Sudan",
    "Tanzania",
    "Togo",
    "Tunisia",
    "Uganda",
    "Western Sahara",
    "Zambia",
    "Zimbabwe",
  ],
  Oceania: [
    "American Samoa",
    "Australia",
    "Cook Islands",
    "East Timor",
    "Fiji",
    "French Polynesia",
    "Guam",
    "Kiribati",
    "Marshall Islands",
    "Micronesia",
    "Nauru",
    "New Caledonia",
    "New Zealand",
    "Niue",
    "Norfolk Island",
    "Northern Mariana Islands",
    "Palau",
    "Papua New Guinea",
    "Pitcairn Islands",
    "Samoa",
    "Solomon Islands",
    "Tokelau",
    "Tonga",
    "Tuvalu",
    "U.S. Minor Outlying Islands",
    "Vanuatu",
    "Wallis and Futuna",
  ],
};

const selectStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.04)",
  color: "inherit",
};

function getCountriesForContinent(continent: Continent) {
  const values = CONTINENT_COUNTRIES[continent].map((item) => item.toLowerCase());
  return COUNTRIES.filter((country) => values.includes(country.toLowerCase()));
}

function CountryMenuButton({
  label,
  active = false,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        padding: "10px 12px",
        border: 0,
        borderRadius: 8,
        background: active ? "rgba(255,255,255,0.16)" : "transparent",
        color: "inherit",
        cursor: "pointer",
        fontWeight: active ? 800 : 600,
        textAlign: "left",
      }}
    >
      {label}
    </button>
  );
}

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

  const [countryOpen, setCountryOpen] = useState(false);
  const [countryContinent, setCountryContinent] = useState<Continent | null>(null);
  const canUseVipFilters = isVip || isAdmin;
  const countryFilterEnabled = canUseFilter(tab, "country", canUseVipFilters);

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
            ...selectStyle,
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
      <div style={{ position: "relative" }}>
        <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>Country</div>
        <button
          type="button"
          disabled={!countryFilterEnabled}
          title={!countryFilterEnabled ? vipOnlyLabel(canUseVipFilters) : ""}
          onClick={() => {
            if (!countryFilterEnabled) return;
            setCountryOpen((value) => {
              const next = !value;
              if (!next) setCountryContinent(null);
              return next;
            });
          }}
          style={{
            ...selectStyle,
            color: "inherit",
            cursor: countryFilterEnabled ? "pointer" : "default",
            opacity: !countryFilterEnabled ? 0.55 : 1,
            textAlign: "left",
          }}
        >
          {country || "Any"}
        </button>

        {countryOpen ? (
          <div
            style={{
              position: "absolute",
              zIndex: 20,
              top: "100%",
              left: 0,
              right: 0,
              marginTop: 6,
              maxHeight: 280,
              overflowY: "auto",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "#111",
              boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
              padding: 6,
            }}
          >
            {countryContinent ? (
              <>
                <CountryMenuButton
                  label="← Back"
                  onClick={() => setCountryContinent(null)}
                />
                {getCountriesForContinent(countryContinent).map((item) => (
                  <CountryMenuButton
                    key={item}
                    label={item}
                    active={country.toLowerCase() === item.toLowerCase()}
                    onClick={() => {
                      setCountry(item);
                      setCountryOpen(false);
                      setCountryContinent(null);
                    }}
                  />
                ))}
              </>
            ) : (
              <>
                <CountryMenuButton
                  label="All countries"
                  active={!country}
                  onClick={() => {
                    setCountry("");
                    setCountryOpen(false);
                  }}
                />
                {CONTINENTS.map((continent) => (
                  <CountryMenuButton
                    key={continent}
                    label={continent}
                    onClick={() => setCountryContinent(continent)}
                  />
                ))}
              </>
            )}
          </div>
        ) : null}
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
            ...selectStyle,
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
