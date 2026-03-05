import { getSupabase } from "./supabase";

export interface AccountRecord {
  id: string;
  google_id: string;
  email: string;
  display_name: string;
}

export async function findOrCreateAccount(
  googleId: string,
  email: string,
  displayName: string
): Promise<AccountRecord> {
  const supabase = getSupabase();

  // Try to find existing account
  const { data: existing } = await supabase
    .from("accounts")
    .select("id, google_id, email, display_name")
    .eq("google_id", googleId)
    .single();

  if (existing) {
    // Update email/name in case they changed on Google's side
    await supabase
      .from("accounts")
      .update({ email, display_name: displayName, updated_at: new Date().toISOString() })
      .eq("id", existing.id);

    return { ...existing, email, display_name: displayName };
  }

  // Create new account
  const { data: created, error } = await supabase
    .from("accounts")
    .insert({ google_id: googleId, email, display_name: displayName })
    .select("id, google_id, email, display_name")
    .single();

  if (error || !created) {
    throw new Error(`Failed to create account: ${error?.message}`);
  }

  return created;
}
