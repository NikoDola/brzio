"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import ReactCountryFlag from "react-country-flag";
import type { Partner } from "@/lib/content";
import { getCountryName } from "@/lib/countries";
import DeletePartnerBtn from "./DeletePartnerBtn";

type SortKey = "default" | "company" | "clientName" | "hasReview";

function applySearchAndSort(rows: Partner[], search: string, sort: SortKey): Partner[] {
  const needle = search.trim().toLowerCase();
  const filtered = needle
    ? rows.filter(
        (p) =>
          p.company.toLowerCase().includes(needle) ||
          (p.clientName ?? "").toLowerCase().includes(needle) ||
          (p.review ?? "").toLowerCase().includes(needle),
      )
    : rows;
  const copy = [...filtered];
  if (sort === "company") copy.sort((a, b) => a.company.localeCompare(b.company));
  else if (sort === "clientName") copy.sort((a, b) => (a.clientName ?? "").localeCompare(b.clientName ?? ""));
  else if (sort === "hasReview") copy.sort((a, b) => Number(Boolean(b.review)) - Number(Boolean(a.review)));
  return copy;
}

export default function PartnerList({ partners }: { partners: Partner[] }) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("default");

  const visible = useMemo(() => applySearchAndSort(partners, search, sort), [partners, search, sort]);

  return (
    <>
      <div className="admin-list-toolbar">
        <input
          type="search"
          placeholder="Search by client, company, or review text…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="admin-list-search"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="admin-list-sort"
        >
          <option value="default">Sort: Default</option>
          <option value="hasReview">Sort: With reviews first</option>
          <option value="company">Sort: Company (A–Z)</option>
          <option value="clientName">Sort: Client (A–Z)</option>
        </select>
      </div>

      {visible.length === 0 ? (
        <div className="admin-empty">
          <div className="admin-empty-text">No partners match &ldquo;{search}&rdquo;.</div>
        </div>
      ) : (
        <div className="admin-team-grid">
          {visible.map((p) => {
            const hasReview = Boolean(p.review && p.review.trim());
            return (
              <div key={p.id} className="admin-team-card">
                <div className="admin-team-card-img" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {p.image ? (
                    <Image src={p.image} alt={p.company} fill style={{ objectFit: "contain", padding: "24px" }} unoptimized />
                  ) : (
                    <div className="admin-partner-letter">{p.company.charAt(0).toUpperCase()}</div>
                  )}
                </div>
                <div className="admin-team-card-body">
                  <div className="admin-team-card-name">
                    {p.company}
                    {p.country && (
                      <span className="admin-team-card-flag" title={getCountryName(p.country)}>
                        <ReactCountryFlag countryCode={p.country} svg style={{ width: "20px", height: "auto" }} />
                      </span>
                    )}
                  </div>
                  <div className="admin-team-card-role">
                    {p.clientName ? p.clientName : <em style={{ opacity: 0.6 }}>No client name</em>}
                  </div>
                  <div className="admin-team-card-meta">
                    {hasReview ? (
                      <span className="admin-badge admin-badge-green admin-badge-xs">Has review</span>
                    ) : (
                      <span className="admin-badge admin-badge-gray admin-badge-xs">No review</span>
                    )}
                  </div>
                  <div className="admin-team-card-actions admin-row-actions--split">
                    {p.url ? (
                      <a href={p.url} target="_blank" rel="noopener noreferrer" className="admin-btn admin-btn-outline admin-btn-sm">Visit</a>
                    ) : <span />}
                    <div className="admin-row-actions">
                      <Link href={`/admin/partners/${p.id}`} className="admin-btn admin-btn-outline admin-btn-sm">Edit</Link>
                      <DeletePartnerBtn id={p.id} name={p.company} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
