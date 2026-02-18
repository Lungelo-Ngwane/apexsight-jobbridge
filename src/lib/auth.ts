import { supabase } from "./supabase";

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
    console.log("Registering:", email, fullName, role, company);

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
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: userData },
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
  try {
    console.log("loginUser started");

    // Supabase signIn
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (authError) throw authError;

    // Optional: check session
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();
    if (sessionError) console.warn("Could not get session:", sessionError);

    const user = authData.user ?? null;
    if (!user) return { user: null, role: null as "candidate" | "employer" | null };

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

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
    throw err;
  }
}
