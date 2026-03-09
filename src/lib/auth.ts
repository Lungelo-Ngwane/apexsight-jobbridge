import { supabase } from "./supabase";

const APP_BASE_URL = (
  import.meta.env.VITE_APP_URL ??
  "https://jobbridge.apexsight.co.za"
).replace(/\/+$/, "");

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

    // Prepare data for raw_user_meta_data
    const userData: Record<string, string> = {
      full_name: fullName,
      role,
    };

    if (role === "employer") {
      if (!company || company.trim() === "") {
        throw new Error("Company name is required for employers");
      }
      userData.company_name = company;
    }

    // Sign up user
    const redirectPath = role === "employer" ? "/employer/dashboard" : "/candidate/dashboard";
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
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

/**
 * Start OAuth sign-in with Google.
 * Supabase will redirect back to the app after authentication.
 */
export async function signInWithGoogle() {
  const redirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}/`
      : `${APP_BASE_URL}/`;

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
    throw new Error(error.message);
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
