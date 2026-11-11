import { supabase } from "./supabase/client";
import { getUserId } from "./data";
import { shrinkImage } from "./image";

export type PostStats = { title: string; minutes: number; volume: number; sets: number; exercises: number; prs: string[] };

export type Post = {
  id: string;
  user_id: string;
  author: string;
  is_mine: boolean;
  caption: string | null;
  photo_path: string | null;
  stats: PostStats | null;
  hidden: boolean;
  created_at: string;
  likes: number;
  comments: number;
  liked: boolean;
  photo_url?: string | null;
};

export type Comment = { id: string; user_id: string; author: string; is_mine: boolean; body: string; created_at: string };

export const REPORT_REASONS = [
  { value: "nudez", label: "Nudez ou conteúdo sexual" },
  { value: "ofensa", label: "Ofensa, ódio ou assédio" },
  { value: "spam", label: "Spam ou propaganda" },
  { value: "outro", label: "Outro motivo" },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]["value"];

export async function signPhotos<T extends { photo_path: string | null; photo_url?: string | null }>(rows: T[]): Promise<T[]> {
  const paths = rows.map((r) => r.photo_path).filter((p): p is string => !!p);
  if (!paths.length) return rows;
  const { data } = await supabase().storage.from("feed").createSignedUrls(paths, 3600);
  const map = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  return rows.map((r) => ({ ...r, photo_url: r.photo_path ? map.get(r.photo_path) ?? null : null }));
}

export async function loadFeed(before?: string | null, user?: string | null): Promise<Post[]> {
  const { data, error } = await supabase().rpc("feed", { p_before: before ?? null, p_limit: 12, p_user: user ?? null });
  if (error) throw error;
  return signPhotos((data ?? []) as Post[]);
}

export async function setLike(postId: string, like: boolean) {
  const sb = supabase();
  if (like) await sb.from("post_likes").upsert({ post_id: postId }, { onConflict: "post_id,user_id", ignoreDuplicates: true });
  else await sb.from("post_likes").delete().eq("post_id", postId).eq("user_id", (await getUserId())!);
}

export async function loadComments(postId: string): Promise<Comment[]> {
  const { data } = await supabase().rpc("post_comment_list", { p_post: postId });
  return (data ?? []) as Comment[];
}

export async function addComment(postId: string, body: string) {
  const { error } = await supabase().from("post_comments").insert({ post_id: postId, body: body.trim() });
  if (error) throw error;
}

export async function deleteComment(id: string) {
  await supabase().from("post_comments").delete().eq("id", id);
}

export async function reportPost(postId: string, reason: ReportReason) {
  const { error } = await supabase().from("post_reports").insert({ post_id: postId, reason });
  if (error && !error.message.includes("duplicate")) throw error;
}

export async function reportComment(commentId: string, reason: ReportReason) {
  const { error } = await supabase().from("post_reports").insert({ comment_id: commentId, reason });
  if (error && !error.message.includes("duplicate")) throw error;
}

export async function blockUser(userId: string) {
  const { error } = await supabase().rpc("block_user", { p_user: userId });
  if (error) throw error;
}

export async function deletePost(p: Pick<Post, "id" | "photo_path">) {
  const sb = supabase();
  await sb.from("posts").delete().eq("id", p.id);
  if (p.photo_path) await sb.storage.from("feed").remove([p.photo_path]);
}

export async function uploadPostPhoto(file: Blob): Promise<string> {
  const uid = await getUserId();
  if (!uid) throw new Error("sem login");
  const { blob } = await shrinkImage(file, 1350, 0.84);
  const path = `${uid}/${crypto.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2)}.jpg`;
  const { error } = await supabase().storage.from("feed").upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw error;
  return path;
}

export async function createPost(input: { sessionId: string | null; caption: string; photoPath: string | null; prs: string[] }) {
  const { data, error } = await supabase().rpc("create_post", { p_session: input.sessionId, p_caption: input.caption, p_photo: input.photoPath, p_prs: input.prs });
  if (error) throw error;
  return data as string;
}

export function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "agora";
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  const d = Math.floor(s / 86400);
  if (d === 1) return "ontem";
  if (d < 7) return `há ${d} dias`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** Cor estável por pessoa (pro círculo do avatar) */
export function hueOf(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}
