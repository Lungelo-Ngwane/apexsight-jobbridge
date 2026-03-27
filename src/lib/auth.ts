import { supabase } from "./supabase";

const APP_BASE_URL = (
  import.meta.env.VITE_APP_URL ??
  "https://jobbridge.apexsight.co.za"
).replace(/\/+$/, "");

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
  role: "candidate" | "employer",
  company?: string,
) {
  try {
    const normalizedEmail = String(email ?? "").trim().toLowerCase();
    const invitedEmployer = role === "employer" ? await checkEmployerInvite(normalizedEmail) : false;

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

    return authData.user?.id || null;
  } catch (err: any) {
    console.error("Registration failed:", err);
    throw err;
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
      name.includes("retryablefetcherror")
    );
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
