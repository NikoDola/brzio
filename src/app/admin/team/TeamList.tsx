"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import DeleteTeamMemberBtn from "./DeleteTeamMemberBtn";

interface TeamRow {
  id: string;
  name: string;
  slug: string;
  role: string;
  image: string;
  order: number;
  views: number;
}

type SortKey = "order" | "views" | "name";

function applySearchAndSort(rows: TeamRow[], search: string, sort: SortKey): TeamRow[] {
  const needle = search.trim().toLowerCase();
  const filtered = needle
    ? rows.filter(
        (r) => r.name.toLowerCase().includes(needle) || r.role.toLowerCase().includes(needle),
      )
    : rows;
  const copy = [...filtered];
  copy.sort((a, b) => {
    if (sort === "views") return b.views - a.views;
    if (sort === "name") return a.name.localeCompare(b.name);
    return a.order - b.order;
  });
  return copy;
}

export default function TeamList({ members }: { members: TeamRow[] }) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("order");

  const visible = useMemo(() => applySearchAndSort(members, search, sort), [members, search, sort]);

  return (
    <>
      <div className="admin-list-toolbar">
        <input
          type="search"
          placeholder="Search by name or role…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="admin-list-search"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="admin-list-sort"
        >
          <option value="order">Sort: Default order</option>
          <option value="views">Sort: Most views</option>
          <option value="name">Sort: Name (A–Z)</option>
        </select>
      </div>

      {visible.length === 0 ? (
        <div className="admin-empty">
          <div className="admin-empty-text">No team members match &ldquo;{search}&rdquo;.</div>
        </div>
      ) : (
        <div className="admin-team-grid">
          {visible.map((m) => (
            <div key={m.id} className="admin-team-card">
              <Link href={`/about-us/${m.slug}`} target="_blank" className="admin-team-card-img">
                {m.image && (
                  <Image src={m.image} alt={m.name} fill style={{ objectFit: "cover" }} unoptimized />
                )}
              </Link>
              <div className="admin-team-card-body">
                <div className="admin-team-card-name">{m.name}</div>
                <div className="admin-team-card-role">{m.role}</div>
                <div className="admin-team-card-meta">
                  <span className="admin-views-inline">{m.views.toLocaleString()} views</span>
                </div>
                <div className="admin-team-card-actions admin-row-actions--split">
                  <Link href={`/about-us/${m.slug}`} target="_blank" className="admin-btn admin-btn-outline admin-btn-sm">View</Link>
                  <div className="admin-row-actions">
                    <Link href={`/admin/team/${m.id}`} className="admin-btn admin-btn-outline admin-btn-sm">Edit</Link>
                    <DeleteTeamMemberBtn id={m.id} name={m.name} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
