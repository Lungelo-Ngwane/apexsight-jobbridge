import { supabase } from "./supabase";
import { v4 as uuidv4 } from "uuid";

export async function registerUser(
  email: string,
  password: string,
  fullName: string,
  role: "candidate" | "employer",
  company?: string,
) {
  try {
    // 1️⃣ Create user in Supabase Auth
    console.log("Registering:", email, fullName, role, company, password);
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });
    if (authError) throw new Error(authError.message);

    console.log(authData);

    const userId = authData.user?.id;
    if (!userId) throw new Error("Failed to get user ID");

    // Now insert into profiles only
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ full_name: fullName, role })
      .eq("id", userId); // update default profile created by trigger
    if (profileError) throw new Error(profileError.message);

    // Insert employer profile if applicable
    if (role === "employer" && company) {
      const { error: empError } = await supabase
        .from("employer_profiles")
        .insert({ user_id: userId, company_name: company });
      if (empError) throw new Error(empError.message);
    }

    return userId;
  } catch (err: any) {
    console.error("Registration failed:", err);
    throw err;
  }
}

export async function loginUser(email: string, password: string) {
  try {
    console.log("loginUser started");

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Login timed out after 10s")), 10000)
    );

    const authPromise = supabase.auth.signInWithPassword({ email, password });

    const { data: authData, error: authError } = await Promise.race([
      authPromise,
      timeoutPromise,
    ]) as any;

    if (authError) throw authError;

    console.log("signInWithPassword resolved!", authData);

    // Check if session actually exists despite hang
    const { data: sessionData } = await supabase.auth.getSession();
    console.log("Current session after login attempt:", sessionData);

    // rest of code...
  } catch (err: any) {
    console.error("loginUser error:", err);
    throw err;
  }
}
