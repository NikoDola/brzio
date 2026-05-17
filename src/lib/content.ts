import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

export type ContentBlock =
  | { type: "section"; heading?: string; body: string }
  | { type: "banner"; src: string; alt?: string }
  | { type: "split"; layout: "left" | "right"; src: string; alt?: string; heading?: string; body: string }
  | { type: "card-grid"; variant?: "image" | "icon"; cards: { src?: string; heading: string; body: string }[] }
  | { type: "highlight"; variant?: "green" | "rose"; heading: string; body: string }
  | { type: "quote"; text: string };

export type PostType = "blog" | "game";

export interface Post {
  id: string;
  type: PostType;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  blocks?: ContentBlock[];
  thumbnail: string;
  gallery: string[];
  tags: string[];
  published: boolean;
  // Game-only — folder name inside /public/games/. Defaults to slug if absent.
  gameSlug?: string;
  createdAt: string;
  updatedAt: string;
}

const POSTS_PATH = path.join(process.cwd(), "src", "content", "posts.json");
const SEO_PATH = path.join(process.cwd(), "src", "content", "seo.json");
const GAMES_DIR = path.join(process.cwd(), "public", "games");

export async function listGameFolders(): Promise<string[]> {
  try {
    const entries = await fs.readdir(GAMES_DIR, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

function assertDev() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Content writes are disabled in production. Edit JSON locally and commit.");
  }
}

async function readJson<T>(file: string): Promise<T[]> {
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

async function writeJson<T>(file: string, data: T[]): Promise<void> {
  assertDev();
  await fs.writeFile(file, JSON.stringify(data, null, 2) + "\n", "utf8");
}

async function readJsonObject<T extends Record<string, unknown>>(file: string): Promise<T> {
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return {} as T;
  }
}

async function writeJsonObject<T extends Record<string, unknown>>(file: string, data: T): Promise<void> {
  assertDev();
  await fs.writeFile(file, JSON.stringify(data, null, 2) + "\n", "utf8");
}

interface PostQuery {
  type?: PostType;
  publishedOnly?: boolean;
}

export async function getPosts(q: PostQuery = {}): Promise<Post[]> {
  let posts = await readJson<Post>(POSTS_PATH);
  if (q.type) posts = posts.filter((p) => p.type === q.type);
  if (q.publishedOnly) posts = posts.filter((p) => p.published);
  return posts.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

export async function getPost(idOrSlug: string, type?: PostType): Promise<Post | null> {
  const posts = await readJson<Post>(POSTS_PATH);
  return posts.find((p) => {
    const match = p.id === idOrSlug || p.slug === idOrSlug;
    return type ? match && p.type === type : match;
  }) ?? null;
}

export async function createPost(input: Omit<Post, "id" | "createdAt" | "updatedAt">): Promise<Post> {
  const posts = await readJson<Post>(POSTS_PATH);
  const now = new Date().toISOString();
  const post: Post = { id: randomUUID(), createdAt: now, updatedAt: now, ...input };
  posts.push(post);
  await writeJson(POSTS_PATH, posts);
  return post;
}

export async function updatePost(id: string, patch: Partial<Post>): Promise<Post | null> {
  const posts = await readJson<Post>(POSTS_PATH);
  const i = posts.findIndex((p) => p.id === id);
  if (i === -1) return null;
  posts[i] = { ...posts[i], ...patch, id: posts[i].id, updatedAt: new Date().toISOString() };
  await writeJson(POSTS_PATH, posts);
  return posts[i];
}

export async function deletePost(id: string): Promise<boolean> {
  const posts = await readJson<Post>(POSTS_PATH);
  const next = posts.filter((p) => p.id !== id);
  if (next.length === posts.length) return false;
  await writeJson(POSTS_PATH, next);
  return true;
}

export interface SeoEntry {
  title: string;
  description: string;
  ogImage: string;
}

export type SeoMap = Record<string, SeoEntry>;

export const SEO_ROUTES = [
  { path: "/",     label: "Home" },
  { path: "/blog", label: "Blog" },
] as const;

const EMPTY_SEO: SeoEntry = { title: "", description: "", ogImage: "" };

export async function getSeoMap(): Promise<SeoMap> {
  return readJsonObject<SeoMap>(SEO_PATH);
}

export async function getSeo(routePath: string): Promise<SeoEntry> {
  const map = await getSeoMap();
  return { ...EMPTY_SEO, ...(map[routePath] ?? {}) };
}

export async function setSeo(routePath: string, entry: SeoEntry): Promise<void> {
  const map = await getSeoMap();
  map[routePath] = entry;
  await writeJsonObject(SEO_PATH, map);
}
