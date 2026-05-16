import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

export interface TeamMember {
  id: string;
  name: string;
  slug: string;
  role: string;
  image: string;
  heroBg: string;
  quote: string;
  bio: string;
  instagram: string;
  website: string;
  order: number;
}

export type ContentBlock =
  | { type: "section"; heading?: string; body: string }
  | { type: "banner"; src: string; alt?: string }
  | { type: "split"; layout: "left" | "right"; src: string; alt?: string; heading?: string; body: string }
  | { type: "card-grid"; cards: { src?: string; heading: string; body: string }[] }
  | { type: "highlight"; variant?: "green" | "rose"; heading: string; body: string }
  | { type: "quote"; text: string }
  | { type: "compare"; before: string; after: string; beforeLabel?: string; afterLabel?: string; beforeAlt?: string; afterAlt?: string };

export interface Post {
  id: string;
  type: "blog" | "portfolio";
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  blocks?: ContentBlock[];
  thumbnail: string;
  gallery: string[];
  teamMember: string | null;
  tags: string[];
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Partner {
  id: string;
  clientName: string;
  company: string;
  image: string;
  url: string;
  review: string;
  country: string;
}

const TEAM_PATH = path.join(process.cwd(), "src", "content", "team.json");
const POSTS_PATH = path.join(process.cwd(), "src", "content", "posts.json");
const PARTNERS_PATH = path.join(process.cwd(), "src", "content", "partners.json");
const SEO_PATH = path.join(process.cwd(), "src", "content", "seo.json");

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

export async function getTeam(): Promise<TeamMember[]> {
  const team = await readJson<TeamMember>(TEAM_PATH);
  return team.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
}

export async function getTeamMember(slugOrId: string): Promise<TeamMember | null> {
  const team = await getTeam();
  return team.find((m) => m.slug === slugOrId || m.id === slugOrId) ?? null;
}

export async function createTeamMember(input: Omit<TeamMember, "id">): Promise<TeamMember> {
  const team = await readJson<TeamMember>(TEAM_PATH);
  const member: TeamMember = { id: randomUUID(), ...input };
  team.push(member);
  await writeJson(TEAM_PATH, team);
  return member;
}

export async function updateTeamMember(id: string, patch: Partial<TeamMember>): Promise<TeamMember | null> {
  const team = await readJson<TeamMember>(TEAM_PATH);
  const i = team.findIndex((m) => m.id === id);
  if (i === -1) return null;
  team[i] = { ...team[i], ...patch, id: team[i].id };
  await writeJson(TEAM_PATH, team);
  return team[i];
}

export async function deleteTeamMember(id: string): Promise<boolean> {
  const team = await readJson<TeamMember>(TEAM_PATH);
  const next = team.filter((m) => m.id !== id);
  if (next.length === team.length) return false;
  await writeJson(TEAM_PATH, next);
  return true;
}

interface PostQuery {
  type?: "blog" | "portfolio";
  teamMember?: string;
  publishedOnly?: boolean;
}

export async function getPosts(q: PostQuery = {}): Promise<Post[]> {
  let posts = await readJson<Post>(POSTS_PATH);
  if (q.type) posts = posts.filter((p) => p.type === q.type);
  if (q.teamMember) posts = posts.filter((p) => p.teamMember === q.teamMember);
  if (q.publishedOnly) posts = posts.filter((p) => p.published);
  return posts.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

export async function getPost(idOrSlug: string, type?: "blog" | "portfolio"): Promise<Post | null> {
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

export async function getPartners(): Promise<Partner[]> {
  return readJson<Partner>(PARTNERS_PATH);
}

export async function getPartner(id: string): Promise<Partner | null> {
  const partners = await readJson<Partner>(PARTNERS_PATH);
  return partners.find((p) => p.id === id) ?? null;
}

export async function createPartner(input: Omit<Partner, "id">): Promise<Partner> {
  const partners = await readJson<Partner>(PARTNERS_PATH);
  const partner: Partner = { id: randomUUID(), ...input };
  partners.push(partner);
  await writeJson(PARTNERS_PATH, partners);
  return partner;
}

export async function updatePartner(id: string, patch: Partial<Partner>): Promise<Partner | null> {
  const partners = await readJson<Partner>(PARTNERS_PATH);
  const i = partners.findIndex((p) => p.id === id);
  if (i === -1) return null;
  partners[i] = { ...partners[i], ...patch, id: partners[i].id };
  await writeJson(PARTNERS_PATH, partners);
  return partners[i];
}

export async function deletePartner(id: string): Promise<boolean> {
  const partners = await readJson<Partner>(PARTNERS_PATH);
  const next = partners.filter((p) => p.id !== id);
  if (next.length === partners.length) return false;
  await writeJson(PARTNERS_PATH, next);
  return true;
}

export interface SeoEntry {
  title: string;
  description: string;
  ogImage: string;
}

export type SeoMap = Record<string, SeoEntry>;

export const SEO_ROUTES = [
  { path: "/",              label: "Home" },
  { path: "/services",      label: "Services" },
  { path: "/our-work",      label: "Our Work" },
  { path: "/about-us",      label: "About Us" },
  { path: "/our-team",      label: "Our Team" },
  { path: "/contact-us",    label: "Contact" },
  { path: "/blog",          label: "Blog" },
  { path: "/cookie-policy", label: "Cookie Policy" },
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
