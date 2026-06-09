import { create } from "zustand";
import { supabase, isConfigured } from "../lib/supabase";

export const useAuth = create((set, get) => ({
  ready: false, // initial session check finished
  session: null,
  user: null,
  profile: null,
  error: null,

  init: () => {
    if (!isConfigured) {
      set({ ready: true });
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      set({ session: data.session, user: data.session?.user ?? null, ready: true });
      if (data.session?.user) get().loadProfile();
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null });
      if (session?.user) get().loadProfile();
      else set({ profile: null });
    });
  },

  loadProfile: async () => {
    const user = get().user;
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("id, email, full_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle();
    set({ profile: data ?? { id: user.id, email: user.email, full_name: null } });
  },

  signUp: async (email, password, fullName) => {
    set({ error: null });
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName || email.split("@")[0] } },
    });
    if (error) set({ error: error.message });
    return { error };
  },

  signIn: async (email, password) => {
    set({ error: null });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) set({ error: error.message });
    return { error };
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, profile: null });
  },

  clearError: () => set({ error: null }),
}));
