export function normalizeProfileUsername(value: string) {
  return value.trim().toLowerCase().replace(/^@+/, "");
}

export function validateProfileUsername(value: string) {
  const username = normalizeProfileUsername(value);

  if (!username) {
    return { ok: true as const, username };
  }

  if (!/^[a-z0-9_]{3,30}$/.test(username)) {
    return {
      ok: false as const,
      username,
      message: "Username can contain only letters, numbers and underscore.",
    };
  }

  return { ok: true as const, username };
}

export function getProfileUsernameSaveError(error: unknown) {
  const err = error as {
    message?: string;
    code?: string;
    data?: { code?: string; message?: string };
  };
  const code = String(err?.code || err?.data?.code || "").toUpperCase();
  const message = String(err?.message || err?.data?.message || "");

  if (
    code === "USERNAME_TAKEN" ||
    /username.*(taken|already|exists|duplicate|in use)/i.test(message)
  ) {
    return "Username already in use.";
  }

  if (
    code === "USERNAME_INVALID" ||
    /username.*(invalid|characters|letters|numbers|underscore)/i.test(message)
  ) {
    return "Username can contain only letters, numbers and underscore.";
  }

  if (code === "USERNAME_RESERVED" || /username.*reserved/i.test(message)) {
    return "Username is reserved.";
  }

  return message || "Unable to update username. Please try again.";
}
