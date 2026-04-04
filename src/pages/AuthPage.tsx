import { useState } from "react";
import { api, persistLocalIdentity } from "../api/nestxApi";
import { useNavigate } from "react-router-dom";
import { useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import { COUNTRIES } from "../constants/countries";

type Step = 1 | 2;
type Mode = "login" | "register";

const LOGO_SRC = "/legal/nestx-horizontal-dark.png";

const PROFILE_TYPES = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "couple", label: "Couple" },
  { value: "gay", label: "Gay" },
  { value: "trans", label: "Trans" },
] as const;

export default function AuthPage() {
  const nav = useNavigate();

  const [searchParams] = useSearchParams();

    const initialMode =
    searchParams.get("mode") === "register" ? "register" : "login";

    const [mode, setMode] = useState<"login" | "register">(initialMode);

    useEffect(() => {
    const m = searchParams.get("mode");
    if (m === "login" || m === "register") {
        setMode(m);
    }
    }, [searchParams]);

  // LOGIN
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginShow, setLoginShow] = useState(false);
  const [dateOfBirth, setDateOfBirth] = useState("");

  // REGISTER wizard
  const [step, setStep] = useState<Step>(1);

  const [regEmail, setRegEmail] = useState("");
  const [regPass, setRegPass] = useState("");
  const [regPass2, setRegPass2] = useState("");
  const [regShow, setRegShow] = useState(false);

  const [consAdult, setConsAdult] = useState(false);
  const [consTerms, setConsTerms] = useState(false);
  const [consMail, setConsMail] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [profileType, setProfileType] = useState<string>("male");
  const [language, setLanguage] = useState<string>(""); // opzionale
  const [area, setArea] = useState<string>(""); // OBBLIGATORIA (no preselezione)
  const [bio, setBio] = useState<string>("");

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>("");
  const [showResendVerify, setShowResendVerify] = useState(false);
  const [infoMsg, setInfoMsg] = useState<string>("");
  const [resendBusy, setResendBusy] = useState(false);

  function resetErrors() {
    setErr("");
    setInfoMsg("");
    setShowResendVerify(false);
  }

  function switchMode(next: Mode) {
    resetErrors();
    setMode(next);
    if (next === "register") setStep(1);
  }

  function clearAuthBlock() {
    try {
      localStorage.removeItem("auth_block");
      localStorage.removeItem("auth_block_until");
      localStorage.removeItem("auth_block_reason");
    } catch {}
  }

  async function onLogin() {
    resetErrors();
    setBusy(true);
    try {
      if (!loginEmail.trim()) throw new Error("Email is required");
      if (!loginPass) throw new Error("Password is required");

      const res = await api.login(loginEmail.trim(), loginPass);
      localStorage.setItem("token", res.token);
      clearAuthBlock();

      const u = (res as any)?.user || {};
      persistLocalIdentity({
        ...u,
        accountType: u?.accountType || "base",
      });

      if (localStorage.getItem("accountType") === "admin") {
        nav("/admin/dashboard", { replace: true });
      } else {
        nav("/app/profile", { replace: true });
      }
    } catch (e: any) {
      const code = String(e?.data?.code || "");

      if (code === "EMAIL_VERIFICATION_REQUIRED") {
        setErr(e?.message || "Please verify your email before logging in.");
        setShowResendVerify(true);
      } else {
        setErr(e?.message || "Login failed");
        setShowResendVerify(false);
      }
    } finally {
      setBusy(false);
    }
  }

  async function onResendVerification() {
    setErr("");
    setInfoMsg("");

    try {
      const email = loginEmail.trim();
      if (!email) throw new Error("Enter your email first");

      setResendBusy(true);
      const res = await api.verifyEmailResend(email);

      setInfoMsg(
        res?.message ||
          "If the account exists and is not yet verified, you will receive a verification email."
      );
    } catch (e: any) {
      setErr(e?.message || "Unable to resend verification email");
    } finally {
      setResendBusy(false);
    }
  }

  function validateStep1() {
    if (!regEmail.trim()) return "Email is required";
    if (!regPass) return "Password is required";
    if (regPass.length < 8) return "Password must be at least 8 characters";
    if (regPass !== regPass2) return "Passwords do not match";
    if (!consAdult) return "You must confirm you are at least 18 years old";
    if (!consTerms) return "You must accept Terms and Privacy Policy";
    return "";
  }

  async function onContinueStep1() {
    resetErrors();
    const v = validateStep1();
    if (v) return setErr(v);
    setStep(2);
  }

  function validateStep2() {
    if (!displayName.trim()) return "Display name is required";
    if (!area.trim()) return "Area / Location is required";
    if (area.trim().length > 120) return "Area / Location is too long (max 120)";
    if (bio.length > 500) return "Bio is too long (max 500)";
    if (language && !/^[a-z]{2,3}$/.test(language.trim().toLowerCase())) return "Language code is invalid (use: en, it, es...)";
    return "";
  }

  async function onCreateAccount() {
    resetErrors();
    const v = validateStep2();
    if (v) return setErr(v);

    if (!dateOfBirth) {
    setErr("Please enter your date of birth");
    return;
    }

    setBusy(true);
    try {
      // STEP 1: register (token)
      const reg = await api.register({
        email: regEmail.trim(),
        password: regPass,
        displayName: displayName.trim(),
        dateOfBirth,
        adultConsent: true,
        termsAccepted: true,
        receiveEmailUpdates: consMail,
        profileType,
        area: area.trim(),
        bio: bio || "",
        language: language ? language.trim().toLowerCase() : "",
      });

      clearAuthBlock();
      localStorage.removeItem("token");
      localStorage.removeItem("accountType");
      localStorage.removeItem("username");
      localStorage.removeItem("avatar");

      setInfoMsg(
        reg?.message || "Registration completed. Check your email to verify your account before logging in."
      );
      setMode("login");
      setLoginEmail(regEmail.trim());
      setLoginPass("");
      setShowResendVerify(false);
    } catch (e: any) {
      setErr(e?.message || "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={pageWrapStyle}>
      <div style={pageInnerStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <img src={LOGO_SRC} alt="NestX" style={logoStyle} />
          <div style={{ fontWeight: 900, fontSize: 20, textAlign: "center" }}>Share your talent with the world</div>
          <div style={{ opacity: 0.75, fontSize: 13, textAlign: "center" }}>Adults only. Adult content may be present.</div>
        </div>

        {/* Switch */}
        <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 18 }}>
          <button
            onClick={() => switchMode("login")}
            style={tabStyle(mode === "login")}
          >
            Login
          </button>
          <button
            onClick={() => switchMode("register")}
            style={tabStyle(mode === "register")}
          >
            Register
          </button>
        </div>

        {/* Body */}
        <div style={{ marginTop: 16, display: "grid", gap: 14, justifyItems: "center" }}>
          {err ? (
            <div style={errBoxStyle}>
              {err}
            </div>
          ) : null}

          {infoMsg ? (
            <div style={okBoxStyle}>
              {infoMsg}
            </div>
          ) : null}

          {mode === "login" ? (
            <div style={{ padding: 16, width: "100%", maxWidth: 520, margin: "0 auto" }}>
              <div style={{ fontWeight: 900, fontSize: 18 }}>Login</div>

              <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                <div style={{ display: "flex", gap: 10, width: "100%" }}>
                  <input
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="Email"
                    style={{ ...inputStyle, flex: 1 }}
                    autoComplete="email"
                  />
                  {/* spacer to match the Show button width */}
                  <div style={{ ...ghostBtnStyle, visibility: "hidden" }}>Show</div>
                </div>

                <div style={{ display: "flex", gap: 10, width: "100%" }}>
                  <input
                    value={loginPass}
                    onChange={(e) => setLoginPass(e.target.value)}
                    placeholder="Password"
                    type={loginShow ? "text" : "password"}
                    style={{ ...inputStyle, flex: 1 }}
                    autoComplete="current-password"
                  />
                  <button
                    onClick={() => setLoginShow((v) => !v)}
                    style={ghostBtnStyle}
                    type="button"
                  >
                    {loginShow ? "Hide" : "Show"}
                  </button>
                </div>

                <button onClick={onLogin} disabled={busy} style={primaryBtnStyle(busy)}>
                  {busy ? "Loading..." : "Login"}
                </button>

                {showResendVerify ? (
                  <button
                    type="button"
                    onClick={onResendVerification}
                    disabled={resendBusy}
                    style={secondaryBtnStyle(resendBusy)}
                  >
                    {resendBusy ? "Sending..." : "Resend verification email"}
                  </button>
                ) : null}

                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, opacity: 0.9 }}>
                  <button
                    type="button"
                    onClick={() => nav("/auth/forgot-password")}
                    style={linkBtnStyle}
                  >
                    Forgot password?
                  </button>

                  <button type="button" onClick={() => switchMode("register")} style={linkBtnStyle}>
                    Don’t have an account? Register
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: 16, width: "100%", maxWidth: step === 1 ? 520 : 980, margin: "0 auto" }}>
              {step === 1 ? (
                <>
                  <div style={{ fontWeight: 900, fontSize: 18 }}>Create your NestX account</div>

                  <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                    <input
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="Email"
                      style={{ ...inputStyle }}
                      autoComplete="email"
                    />

                    <div style={{ display: "flex", gap: 10 }}>
                      <input
                        value={regPass}
                        onChange={(e) => setRegPass(e.target.value)}
                        placeholder="Password"
                        type={regShow ? "text" : "password"}
                        style={{ ...inputStyle, flex: 1 }}
                        autoComplete="new-password"
                      />
                      <button
                        onClick={() => setRegShow((v) => !v)}
                        style={ghostBtnStyle}
                        type="button"
                      >
                        {regShow ? "Hide" : "Show"}
                      </button>
                    </div>

                    <input
                      value={regPass2}
                      onChange={(e) => setRegPass2(e.target.value)}
                      placeholder="Confirm password"
                      type={regShow ? "text" : "password"}
                      style={inputStyle}
                      autoComplete="new-password"
                    />

                    <input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Display name"
                      style={inputStyle}
                    />

                    <input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    style={inputStyle}
                    required
                    />

                    <div style={{ display: "grid", gap: 8, marginTop: 4 }}>
                      <label style={checkRowStyle}>
                        <input
                        type="checkbox"
                        checked={consAdult}
                        onChange={(e) => {
                            setConsAdult(e.target.checked);
                            setErr("");
                        }}
                        />
                        <span>I am at least 18 years old</span>
                      </label>
                      <label style={checkRowStyle}>
                        <input type="checkbox" checked={consTerms} onChange={(e) => setConsTerms(e.target.checked)} />
                        <span>
                          I accept the{" "}
                          <a href="/rules/en/terms.html" target="_blank" rel="noreferrer" style={linkStyle}>Terms of Service</a>{" "}
                          and{" "}
                          <a href="/rules/en/privacy.html" target="_blank" rel="noreferrer" style={linkStyle}>Privacy Policy</a>
                        </span>
                      </label>
                      <label style={checkRowStyle}>
                        <input type="checkbox" checked={consMail} onChange={(e) => setConsMail(e.target.checked)} />
                        <span>Receive email updates</span>
                      </label>
                    </div>

                    <button onClick={onContinueStep1} disabled={busy} style={primaryBtnStyle(busy)}>
                      Continue
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontWeight: 900, fontSize: 18 }}>Complete your profile</div>
                  <div style={{ opacity: 0.8, fontSize: 13, marginTop: 4 }}>(You can edit this later)</div>

                  <div style={step2GridStyle}>
                    {/* form */}
                    <div style={{ display: "grid", gap: 10 }}>
                      <input
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Display name *"
                        style={inputStyle}
                      />

                      <select value={profileType} onChange={(e) => setProfileType(e.target.value)} style={inputStyle as any}>
                        {PROFILE_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>

                      <input
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        placeholder="Language (e.g. en)"
                        style={inputStyle}
                      />

                      <label style={labelStyle}>Country</label>

                        <select
                        value={area}
                        onChange={(e) => setArea(e.target.value)}
                        style={inputStyle}
                        >
                        <option value="" disabled>
                            Select your country
                        </option>

                        {COUNTRIES.map((name) => (
                            <option key={name} value={name}>
                            {name}
                            </option>
                        ))}
                        </select>

                      <textarea
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Bio (optional)"
                        style={{ ...inputStyle, minHeight: 110, resize: "vertical" }}
                      />

                      <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                        <button
                          type="button"
                          onClick={() => setStep(1)}
                          disabled={busy}
                          style={secondaryBtnStyle(busy)}
                        >
                          Back
                        </button>
                        <button onClick={onCreateAccount} disabled={busy} style={primaryBtnStyle(busy)}>
                          {busy ? "Creating..." : "Create account"}
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div style={{ marginTop: 14, fontSize: 13, opacity: 0.9 }}>
                Already have an account?{" "}
                <button type="button" onClick={() => switchMode("login")} style={linkBtnStyle}>
                  Login
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ marginTop: 18, display: "flex", justifyContent: "center", gap: 18, flexWrap: "wrap", fontSize: 13, opacity: 0.85 }}>
          <a href="/rules/en/terms.html" target="_blank" rel="noreferrer" style={linkStyle}>Terms</a>
          <a href="/rules/en/privacy.html" target="_blank" rel="noreferrer" style={linkStyle}>Privacy</a>
        </div>
      </div>
    </div>
  );
}

function tabStyle(active: boolean) {
  return {
    padding: "10px 14px",
    borderRadius: 12,
    fontWeight: 900,
    cursor: "pointer",
    border: "1px solid rgba(255,255,255,0.14)",
    background: active ? "rgba(255,255,255,0.12)" : "transparent",
    color: "white",
  } as const;
}

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(0,0,0,0.25)",
  color: "white",
  outline: "none",
} as const;

const labelStyle = {
  fontSize: 12,
  fontWeight: 900,
  opacity: 0.85,
  marginBottom: 6,
} as const;

const checkRowStyle = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  fontSize: 13,
  opacity: 0.9,
} as const;

const linkStyle = {
  color: "white",
  textDecoration: "underline",
} as const;

const linkBtnStyle = {
  border: "none",
  background: "transparent",
  color: "white",
  textDecoration: "underline",
  cursor: "pointer",
  padding: 0,
  fontWeight: 800,
} as const;

const ghostBtnStyle = {
  padding: "10px 12px",
  borderRadius: 12,
  fontWeight: 900,
  cursor: "pointer",
  border: "1px solid rgba(255,255,255,0.14)",
  background: "transparent",
  color: "white",
  whiteSpace: "nowrap",
} as const;

function primaryBtnStyle(disabled: boolean) {
  return {
    padding: "10px 14px",
    borderRadius: 12,
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.75 : 1,
  } as const;
}

function secondaryBtnStyle(disabled: boolean) {
  return {
    padding: "10px 14px",
    borderRadius: 12,
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.75 : 0.92,
    background: "transparent",
    color: "white",
    border: "1px solid rgba(255,255,255,0.14)",
  } as const;
}

const errBoxStyle = {
  border: "1px solid rgba(255,120,120,0.35)",
  background: "rgba(255,120,120,0.12)",
  borderRadius: 14,
  padding: 12,
  fontWeight: 800,
} as const;

const okBoxStyle = {
  border: "1px solid rgba(120,255,170,0.35)",
  background: "rgba(120,255,170,0.12)",
  borderRadius: 14,
  padding: 12,
  fontWeight: 800,
} as const;

const pageWrapStyle = {
  minHeight: "100vh",
  display: "flex",
  justifyContent: "center",   // centro orizzontale
  alignItems: "center",       // ✅ centro verticale
  padding: 22,
} as const;

const pageInnerStyle = {
  width: "100%",
  maxWidth: 980,
  margin: "0 auto", // 👈 QUESTA è la chiave
} as const;

const headerStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 12,
  paddingTop: 10,
} as const;

const logoStyle = {
  height: 128,
  width: "auto",
  maxWidth: 420, // px, NON percentuale
} as const;

const step2GridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  gap: 32,
  alignItems: "start",
  marginTop: 12,
};

