"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import DeletePostBtn from "./DeletePostBtn";

interface PostRow {
  id: string;
  type: "blog" | "portfolio";
  title: string;
  slug: string;
  thumbnail: string;
  teamMember: string | null;
  published: boolean;
  createdAt: string;
  views: number;
}

type SortKey = "date" | "views" | "title";

function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function applySearchAndSort(rows: PostRow[], search: string, sort: SortKey): PostRow[] {
  const needle = search.trim().toLowerCase();
  const filtered = needle
    ? rows.filter((r) => r.title.toLowerCase().includes(needle))
    : rows;
  const copy = [...filtered];
  copy.sort((a, b) => {
    if (sort === "views") return b.views - a.views;
    if (sort === "title") return a.title.localeCompare(b.title);
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  return copy;
}

export default function PostsList({ posts }: { posts: PostRow[] }) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("date");

  const blog = useMemo(
    () => applySearchAndSort(posts.filter((p) => p.type === "blog"), search, sort),
    [posts, search, sort],
  );
  const portfolio = useMemo(
    () => applySearchAndSort(posts.filter((p) => p.type === "portfolio"), search, sort),
    [posts, search, sort],
  );

  return (
    <>
      <div className="admin-list-toolbar">
        <input
          type="search"
          placeholder="Search by title…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="admin-list-search"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="admin-list-sort"
        >
          <option value="date">Sort: Newest first</option>
          <option value="views">Sort: Most views</option>
          <option value="title">Sort: Title (A–Z)</option>
        </select>
      </div>

      {blog.length > 0 && (
        <>
          <h2 className="admin-table-section-label">Blog Posts ({blog.length})</h2>
          <div className="admin-posts-grid">
            {blog.map((p) => (
              <div key={p.id} className="admin-post-card">
                <Link href={`/blog/${p.slug}`} target="_blank" className="admin-post-card-img">
                  {p.thumbnail && (
                    <Image src={p.thumbnail} alt={p.title} fill style={{ objectFit: "cover" }} unoptimized />
                  )}
                </Link>
                <div className="admin-post-card-body">
                  <div className="admin-post-card-title">{p.title}</div>
                  <div className="admin-post-card-meta">
                    {formatDate(p.createdAt)}
                    {" · "}
                    <span className={`admin-badge admin-badge-xs ${p.published ? "admin-badge-green" : "admin-badge-gray"}`}>
                      {p.published ? "Published" : "Draft"}
                    </span>
                    {" · "}
                    <span className="admin-views-inline">{p.views.toLocaleString()} views</span>
                  </div>
                  <div className="admin-post-card-actions admin-row-actions--split">
                    <Link href={`/blog/${p.slug}`} target="_blank" className="admin-btn admin-btn-outline admin-btn-sm">View</Link>
                    <div className="admin-row-actions">
                      <Link href={`/admin/posts/${p.id}`} className="admin-btn admin-btn-outline admin-btn-sm">Edit</Link>
                      <DeletePostBtn id={p.id} title={p.title} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {portfolio.length > 0 && (
        <>
          <h2 className="admin-table-section-label">Portfolio Items ({portfolio.length})</h2>
          <div className="admin-posts-grid">
            {portfolio.map((p) => (
              <div key={p.id} className="admin-post-card">
                <Link href={`/portfolio/${p.slug}`} target="_blank" className="admin-post-card-img">
                  {p.thumbnail && (
                    <Image src={p.thumbnail} alt={p.title} fill style={{ objectFit: "cover" }} unoptimized />
                  )}
                </Link>
                <div className="admin-post-card-body">
                  <div className="admin-post-card-title">{p.title}</div>
                  <div className="admin-post-card-meta">
                    {p.teamMember && `Team Member: ${p.teamMember}`}
                    {" · "}
                    <span className={`admin-badge admin-badge-xs ${p.published ? "admin-badge-green" : "admin-badge-gray"}`}>
                      {p.published ? "Published" : "Draft"}
                    </span>
                    {" · "}
                    <span className="admin-views-inline">{p.views.toLocaleString()} views</span>
                  </div>
                  <div className="admin-post-card-actions admin-row-actions--split">
                    <Link href={`/portfolio/${p.slug}`} target="_blank" className="admin-btn admin-btn-outline admin-btn-sm">View</Link>
                    <div className="admin-row-actions">
                      <Link href={`/admin/posts/${p.id}`} className="admin-btn admin-btn-outline admin-btn-sm">Edit</Link>
                      <DeletePostBtn id={p.id} title={p.title} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {blog.length === 0 && portfolio.length === 0 && search && (
        <div className="admin-empty">
          <div className="admin-empty-text">No posts match &ldquo;{search}&rdquo;.</div>
        </div>
      )}
    </>
  );
}
