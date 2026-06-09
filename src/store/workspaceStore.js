import { create } from "zustand";
import { supabase } from "../lib/supabase";

const ORG_KEY = "flux-org";
const projKey = (orgId) => `flux-project:${orgId}`;

export const useWorkspace = create((set, get) => ({
  loading: true,
  orgs: [],
  currentOrgId: null,
  members: [],
  myRole: null, // role of current user in current org
  projects: [],
  currentProjectId: null,
  error: null,

  // ---- Bootstrap ----
  loadOrgs: async () => {
    set({ loading: true, error: null });
    const { data, error } = await supabase
      .from("organizations")
      .select("id, name, created_by, created_at")
      .order("created_at", { ascending: true });
    if (error) return set({ loading: false, error: error.message });

    const orgs = data ?? [];
    let currentOrgId = localStorage.getItem(ORG_KEY);
    if (!orgs.some((o) => o.id === currentOrgId))
      currentOrgId = orgs[0]?.id ?? null;

    set({ orgs, currentOrgId, loading: false });
    if (currentOrgId) await get().selectOrg(currentOrgId);
  },

  selectOrg: async (orgId) => {
    localStorage.setItem(ORG_KEY, orgId);
    set({ currentOrgId: orgId, members: [], projects: [], currentProjectId: null });
    await Promise.all([get().loadMembers(orgId), get().loadProjects(orgId)]);
  },

  createOrg: async (name) => {
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("organizations")
      .insert({ name, created_by: u.user.id })
      .select("id, name, created_by, created_at")
      .single();
    if (error) return { error };
    set((s) => ({ orgs: [...s.orgs, data] }));
    await get().selectOrg(data.id);
    return { data };
  },

  // ---- Members ----
  loadMembers: async (orgId) => {
    const { data, error } = await supabase
      .from("organization_members")
      .select("id, role, user_id, created_at, profiles:user_id (email, full_name, avatar_url)")
      .eq("org_id", orgId)
      .order("role", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) return;

    const { data: u } = await supabase.auth.getUser();
    const mine = data.find((m) => m.user_id === u.user?.id);
    set({ members: data ?? [], myRole: mine?.role ?? null });
  },

  addMember: async (email, role = "member") => {
    const orgId = get().currentOrgId;
    const { error } = await supabase.rpc("add_org_member", {
      _org: orgId,
      _email: email,
      _role: role,
    });
    if (error) return { error };
    await get().loadMembers(orgId);
    return {};
  },

  updateMemberRole: async (memberId, role) => {
    const { error } = await supabase
      .from("organization_members")
      .update({ role })
      .eq("id", memberId);
    if (!error) await get().loadMembers(get().currentOrgId);
    return { error };
  },

  removeMember: async (memberId) => {
    const { error } = await supabase
      .from("organization_members")
      .delete()
      .eq("id", memberId);
    if (!error) await get().loadMembers(get().currentOrgId);
    return { error };
  },

  // ---- Projects (spaces) ----
  loadProjects: async (orgId) => {
    const { data, error } = await supabase
      .from("projects")
      .select("id, name, key, description, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: true });
    if (error) return;

    const projects = data ?? [];
    let currentProjectId = localStorage.getItem(projKey(orgId));
    if (!projects.some((p) => p.id === currentProjectId))
      currentProjectId = projects[0]?.id ?? null;

    set({ projects, currentProjectId });
  },

  selectProject: (projectId) => {
    const orgId = get().currentOrgId;
    if (orgId) localStorage.setItem(projKey(orgId), projectId);
    set({ currentProjectId: projectId });
  },

  createProject: async (name, key) => {
    const orgId = get().currentOrgId;
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("projects")
      .insert({
        org_id: orgId,
        name,
        key: (key || name.slice(0, 4)).toUpperCase(),
        created_by: u.user.id,
      })
      .select("id, name, key, description, created_at")
      .single();
    if (error) return { error };
    set((s) => ({ projects: [...s.projects, data] }));
    get().selectProject(data.id);
    return { data };
  },

  deleteProject: async (projectId) => {
    const { error } = await supabase.from("projects").delete().eq("id", projectId);
    if (!error) await get().loadProjects(get().currentOrgId);
    return { error };
  },

  reset: () =>
    set({
      loading: true,
      orgs: [],
      currentOrgId: null,
      members: [],
      myRole: null,
      projects: [],
      currentProjectId: null,
      error: null,
    }),
}));
