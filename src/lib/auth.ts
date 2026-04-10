import { supabase } from "./supabase";

const GOOGLE_SIGN_IN_INTENT_KEY = "pending_google_sign_in";

const APP_BASE_URL = (
  import.meta.env.VITE_APP_URL ??
  "https://jobbridge.apexsight.co.za"
).replace(/\/+$/, "");

export type RegistrationRole = "candidate" | "employer";

export interface RegistrationOutcome {
  status: "confirmation_required" | "signed_in" | "already_exists";
  role: RegistrationRole;
  userId: string | null;
}

function isTransientFetchError(error: unknown): boolean {
  const message = String(
    (error as { message?: string } | null)?.message ??
    (error as { error_description?: string } | null)?.error_description ??
    "",
  ).toLowerCase();
  const name = String((error as { name?: string } | null)?.name ?? "").toLowerCase();

  return (
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("network request failed") ||
    message.includes("cors") ||
    name.includes("retryablefetcherror") ||
    name === "typeerror"
  );
}

export async function checkEmployerInvite(email: string): Promise<boolean> {
  const normalizedEmail = String(email ?? "").trim().toLowerCase();
  if (!normalizedEmail) return false;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const accessToken = session?.access_token ?? null;
  const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? "");
  const functionsBaseUrl = `${String(import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/+$/, "")}/functions/v1`;

  const response = await fetch(`${functionsBaseUrl}/check-employer-invite`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ email: normalizedEmail }),
  });

  const payload = await response.json().catch(() => ({ invited: false }));
  if (!response.ok) {
    throw new Error(
      String((payload as { error?: string }).error ?? "Failed to check invite status."),
    );
  }

  return Boolean((payload as { invited?: boolean }).invited);
}

/**
 * Register a new user (candidate or employer)
 * Uses Supabase Auth + trigger to auto-create profiles/employer_profiles
 */
export async function registerUser(
  email: string,
  password: string,
  fullName: string,
  role: RegistrationRole,
  company?: string,
): Promise<RegistrationOutcome> {
  try {
    const normalizedEmail = String(email ?? "").trim().toLowerCase();
    let invitedEmployer = false;

    if (role === "employer") {
      try {
        invitedEmployer = await checkEmployerInvite(normalizedEmail);
      } catch (error) {
        if (!isTransientFetchError(error)) {
          throw error;
        }

        if (!company || company.trim() === "") {
          throw new Error(
            "We couldn't verify whether this email has an employer invite. Enter your company name and try again.",
          );
        }

        console.warn(
          "Employer invite lookup is temporarily unavailable. Continuing with standard employer signup.",
          error,
        );
      }
    }

    // Prepare data for raw_user_meta_data
    const userData: Record<string, string> = {
      full_name: fullName,
      role,
    };

    if (role === "employer") {
      if (!invitedEmployer && (!company || company.trim() === "")) {
        throw new Error("Company name is required for employers");
      }
      userData.company_name = company?.trim() || "Invited Team Member";
    }

    // Sign up user
    const redirectPath = role === "employer" ? "/employer/dashboard" : "/candidate/dashboard";
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: userData,
        emailRedirectTo: `${APP_BASE_URL}${redirectPath}`,
      },
    });

    if (authError) throw new Error(authError.message);

    const createdUser = authData.user ?? null;
    const identities = createdUser?.identities ?? [];
    const hasRealIdentity = identities.length > 0;
    const requiresConfirmation = !authData.session && hasRealIdentity;
    const alreadyExists = !authData.session && !hasRealIdentity;

    if (alreadyExists) {
      return {
        status: "already_exists",
        role,
        userId: createdUser?.id ?? null,
      };
    }

    return {
      status: requiresConfirmation ? "confirmation_required" : "signed_in",
      role,
      userId: createdUser?.id ?? null,
    };
  } catch (err: any) {
    console.error("Registration failed:", err);
    throw err;
  }
}

export async function signInWithGoogle() {
  const redirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}/`
      : `${APP_BASE_URL}/`;

  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(GOOGLE_SIGN_IN_INTENT_KEY, "1");
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      queryParams: {
        prompt: "select_account",
      },
    },
  });

  if (error) {
    clearPendingGoogleSignInIntent();
    throw new Error(error.message);
  }
}

export function hasPendingGoogleSignInIntent() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.sessionStorage.getItem(GOOGLE_SIGN_IN_INTENT_KEY) === "1";
}

export function clearPendingGoogleSignInIntent() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(GOOGLE_SIGN_IN_INTENT_KEY);
}

export async function deleteIncompleteGoogleUser() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const accessToken = session?.access_token ?? null;
  if (!accessToken) {
    return;
  }

  const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? "");
  const functionsBaseUrl = `${String(import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/+$/, "")}/functions/v1`;

  const response = await fetch(`${functionsBaseUrl}/delete-incomplete-google-user`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: "Failed to delete incomplete Google account." }));
    throw new Error(String((payload as { error?: string }).error ?? "Failed to delete incomplete Google account."));
  }
}

/**
 * Log in a user with email and password
 */
export async function loginUser(email: string, password: string) {
  const normalizedEmail = String(email ?? "").trim();
  const normalizedPassword = String(password ?? "");

  if (!normalizedEmail || !normalizedPassword) {
    throw new Error("Enter both your email address and password.");
  }

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new Error("You appear to be offline. Check your internet connection and try again.");
  }

  async function attemptSignIn() {
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: normalizedPassword,
      });

    if (authError) throw authError;
    return authData;
  }

  try {
    let authData;

    try {
      authData = await attemptSignIn();
    } catch (error) {
      if (!isTransientFetchError(error)) {
        throw error;
      }

      await new Promise((resolve) => window.setTimeout(resolve, 600));
      authData = await attemptSignIn();
    }

    const { error: sessionError } = await supabase.auth.getSession();
    if (sessionError) console.warn("Could not get session:", sessionError);

    const user = authData.user ?? null;
    if (!user) return { user: null, role: null as "candidate" | "employer" | null };

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.warn("Failed to fetch profile role after login:", profileError);
      return { user, role: null as "candidate" | "employer" | null };
    }

    const resolvedRole =
      profile?.role === "candidate" || profile?.role === "employer"
        ? profile.role
        : null;

    return { user, role: resolvedRole };
  } catch (err: any) {
    console.error("loginUser error:", err);

    if (isTransientFetchError(err)) {
      throw new Error(
        "We couldn't reach the sign-in service. Check your connection and try again.",
      );
    }

    throw err;
  }
}

export async function requestPasswordReset(email: string) {
  const normalizedEmail = String(email ?? "").trim();
  if (!normalizedEmail) {
    throw new Error("Enter your email address to reset your password.");
  }

  const redirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}/reset-password`
      : `${APP_BASE_URL}/reset-password`;

  const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo,
  });

  if (error) {
    throw new Error(error.message);
  }
}
