"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BarChart3, ChevronLeft, ChevronRight } from "lucide-react";
import {
  deleteAdminPost,
  fetchAdminActivityTable,
  type AdminActivityTable,
} from "@/lib/snapzo-api";
import { ipfsGatewayUrl } from "@/lib/snapzo-profile-local";
import Image from "next/image";

const TABLES: Array<{ key: AdminActivityTable; label: string }> = [
  { key: "activity", label: "Latest Activity" },
  { key: "likes", label: "Likes" },
  { key: "replies", label: "Replies" },
  { key: "unlocks", label: "Unlocks" },
  { key: "posts", label: "Posts" },
  { key: "users", label: "Users" },
];

function asString(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  return "-";
}

function formatDate(value: unknown): string {
  if (typeof value !== "string" && !(value instanceof Date)) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

export function SnapZoAnalyticsAdminView() {
  const [table, setTable] = useState<AdminActivityTable>("activity");
  const [page, setPage] = useState(1);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const pageSize = 20;

  const query = useQuery({
    queryKey: ["snapzoAdminActivity", table, page, pageSize],
    queryFn: ({ signal }) => fetchAdminActivityTable(table, { page, pageSize }, signal),
    staleTime: 10_000,
  });

  const items = query.data?.items ?? [];
  const totalPages = query.data?.totalPages ?? 1;
  const summary = query.data?.summary;

  async function handleDeletePost(postObjectId: string, postId: string) {
    const ok = window.confirm(
      `Delete post ${postId}?\n\nThis removes post row plus related tips/replies/unlocks from DB.`
    );
    if (!ok) return;
    setDeletingPostId(postObjectId);
    try {
      await deleteAdminPost(postObjectId);
      await query.refetch();
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert(e instanceof Error ? e.message : "Failed to delete post");
    } finally {
      setDeletingPostId(null);
    }
  }

  const tableRows = useMemo(() => {
    if (table === "likes")
      return items.map((raw) => (
        <tr key={asString(raw.id)} className="border-b border-white/[0.06]">
          <td className="px-3 py-2 text-zinc-200">{formatDate(raw.createdAt)}</td>
          <td className="px-3 py-2 text-zinc-100">{asString(raw.label)}</td>
          <td className="px-3 py-2 font-mono text-zinc-300">{asString(raw.postId)}</td>
          <td className="px-3 py-2 text-zinc-300">{asString(raw.amount)}</td>
          <td className="px-3 py-2 font-mono text-zinc-400">{asString(raw.txHash).slice(0, 12)}…</td>
        </tr>
      ));

    if (table === "replies")
      return items.map((raw) => (
        <tr key={asString(raw.id)} className="border-b border-white/[0.06]">
          <td className="px-3 py-2 text-zinc-200">{formatDate(raw.createdAt)}</td>
          <td className="px-3 py-2 text-zinc-100">{asString(raw.requesterLabel)}</td>
          <td className="px-3 py-2 text-zinc-300">{asString(raw.creatorLabel)}</td>
          <td className="px-3 py-2 text-zinc-300">{asString(raw.status)}</td>
          <td className="max-w-[360px] truncate px-3 py-2 text-zinc-400">{asString(raw.requesterComment)}</td>
        </tr>
      ));

    if (table === "unlocks")
      return items.map((raw) => (
        <tr key={asString(raw.id)} className="border-b border-white/[0.06]">
          <td className="px-3 py-2 text-zinc-200">{formatDate(raw.createdAt)}</td>
          <td className="px-3 py-2 text-zinc-100">{asString(raw.label)}</td>
          <td className="px-3 py-2 font-mono text-zinc-300">{asString(raw.postId)}</td>
          <td className="px-3 py-2 text-zinc-300">{asString(raw.source)}</td>
          <td className="px-3 py-2 font-mono text-zinc-400">{asString(raw.txHash).slice(0, 12)}…</td>
        </tr>
      ));

    if (table === "posts")
      return items.map((raw) => (
        <tr key={asString(raw.id)} className="border-b border-white/[0.06]">
          <td className="px-3 py-2 text-zinc-200">{formatDate(raw.createdAt)}</td>
          <td className="px-3 py-2 font-mono text-zinc-300">{asString(raw.postId)}</td>
          <td className="px-3 py-2 text-zinc-100">{asString(raw.creatorLabel)}</td>
          <td className="px-3 py-2 text-zinc-300">{asString(raw.likes)}</td>
          <td className="px-3 py-2 text-zinc-300">{asString(raw.replies)}</td>
          <td className="px-3 py-2 text-zinc-300">{asString(raw.unlocks)}</td>
          <td className="px-3 py-2 text-zinc-300">{asString(raw.isLocked) === "true" ? "Locked" : "Public"}</td>
          <td className="px-3 py-2">
            <button
              type="button"
              onClick={() => void handleDeletePost(asString(raw.id), asString(raw.postId))}
              disabled={deletingPostId === asString(raw.id)}
              className="rounded-lg border border-red-500/35 bg-red-500/15 px-2 py-1 text-[11px] font-semibold text-red-200 transition hover:bg-red-500/25 disabled:opacity-40"
            >
              {deletingPostId === asString(raw.id) ? "Deleting…" : "Delete"}
            </button>
          </td>
        </tr>
      ));

    if (table === "users")
      return items.map((raw) => (
        <tr key={asString(raw.id)} className="border-b border-white/[0.06]">
          <td className="px-3 py-2">
            <div className="flex items-center gap-2">
              {typeof raw.profileImage === "string" && raw.profileImage ? (
                <Image
                  src={ipfsGatewayUrl(raw.profileImage)}
                  alt=""
                  width={22}
                  height={22}
                  className="h-[22px] w-[22px] rounded-full object-cover"
                />
              ) : (
                <div className="h-[22px] w-[22px] rounded-full bg-zinc-700" />
              )}
              <span className="text-zinc-100">{asString(raw.displayName) !== "-" ? asString(raw.displayName) : asString(raw.username)}</span>
            </div>
          </td>
          <td className="px-3 py-2 font-mono text-zinc-300">{asString(raw.wallet).slice(0, 10)}…</td>
          <td className="px-3 py-2 text-zinc-300">{asString(raw.posts)}</td>
          <td className="px-3 py-2 text-zinc-300">{asString(raw.likes)}</td>
          <td className="px-3 py-2 text-zinc-300">{asString(raw.replies)}</td>
          <td className="px-3 py-2 text-zinc-300">{asString(raw.unlocks)}</td>
        </tr>
      ));

    return items.map((raw) => (
      <tr key={asString(raw.id)} className="border-b border-white/[0.06]">
        <td className="px-3 py-2 text-zinc-200">{formatDate(raw.createdAt)}</td>
        <td className="px-3 py-2 text-zinc-100">{asString(raw.type)}</td>
        <td className="px-3 py-2 text-zinc-300">{asString(raw.label)}</td>
        <td className="px-3 py-2 font-mono text-zinc-300">{asString(raw.postId)}</td>
        <td className="max-w-[360px] truncate px-3 py-2 text-zinc-400">{asString(raw.summary)}</td>
      </tr>
    ));
  }, [deletingPostId, items, table]);

  const headers = useMemo(() => {
    if (table === "likes") return ["At", "Liker", "Post", "Amount", "Tx"];
    if (table === "replies") return ["At", "Requester", "Creator", "Status", "Comment"];
    if (table === "unlocks") return ["At", "User", "Post", "Source", "Tx"];
    if (table === "posts") return ["At", "Post", "Creator", "Likes", "Replies", "Unlocks", "Visibility", "Actions"];
    if (table === "users") return ["User", "Wallet", "Posts", "Likes", "Replies", "Unlocks"];
    return ["At", "Type", "User", "Post", "Summary"];
  }, [table]);

  return (
    <main className="mx-auto w-full max-w-[1480px] px-4 pb-24 pt-5 xl:px-6">
      <div className="mb-5 flex items-start gap-3">
        <Link
          href="/admin/snapzo"
          className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/[0.14] bg-white/[0.06] text-white transition hover:border-fuchsia-300/35 hover:bg-fuchsia-500/10"
          aria-label="Back to SnapZo admin"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-cyan-300" />
            <h1 className="text-xl font-semibold text-white">SnapZo admin analytics</h1>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Latest social activity from backend DB with pagination for audit and moderation.
          </p>
        </div>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border border-fuchsia-300/16 bg-fuchsia-500/[0.08] px-3 py-2 text-xs">
          <p className="text-zinc-500">Likes</p>
          <p className="text-lg font-semibold text-zinc-100">{summary?.likes ?? "…"}</p>
        </div>
        <div className="rounded-xl border border-violet-300/16 bg-violet-500/[0.08] px-3 py-2 text-xs">
          <p className="text-zinc-500">Replies</p>
          <p className="text-lg font-semibold text-zinc-100">{summary?.replies ?? "…"}</p>
        </div>
        <div className="rounded-xl border border-cyan-300/16 bg-cyan-500/[0.08] px-3 py-2 text-xs">
          <p className="text-zinc-500">Unlocks</p>
          <p className="text-lg font-semibold text-zinc-100">{summary?.unlocks ?? "…"}</p>
        </div>
        <div className="rounded-xl border border-emerald-300/16 bg-emerald-500/[0.08] px-3 py-2 text-xs">
          <p className="text-zinc-500">Users</p>
          <p className="text-lg font-semibold text-zinc-100">{summary?.users ?? "…"}</p>
        </div>
        <div className="rounded-xl border border-amber-300/16 bg-amber-500/[0.08] px-3 py-2 text-xs">
          <p className="text-zinc-500">Posts</p>
          <p className="text-lg font-semibold text-zinc-100">{summary?.posts ?? "…"}</p>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {TABLES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTable(t.key);
              setPage(1);
            }}
            className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
              table === t.key
                ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-100"
                : "border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <section className="overflow-hidden rounded-2xl border border-white/[0.1] bg-[#101831]/88 shadow-[0_14px_36px_rgba(0,0,0,0.3)]">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="border-b border-white/[0.08] bg-black/25 text-zinc-400">
              <tr>
                {headers.map((header) => (
                  <th key={header} className="px-3 py-2.5 font-medium">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {query.isLoading ? (
                <tr>
                  <td className="px-3 py-8 text-center text-zinc-500" colSpan={headers.length}>
                    Loading…
                  </td>
                </tr>
              ) : query.isError ? (
                <tr>
                  <td className="px-3 py-8 text-center text-red-300/90" colSpan={headers.length}>
                    {(query.error as Error)?.message ?? "Failed to load admin analytics."}
                  </td>
                </tr>
              ) : tableRows.length ? (
                tableRows
              ) : (
                <tr>
                  <td className="px-3 py-8 text-center text-zinc-500" colSpan={headers.length}>
                    No rows yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-white/[0.08] px-3 py-2.5 text-xs text-zinc-400">
          <span>
            Page {page} / {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 text-zinc-200 disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Prev
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 text-zinc-200 disabled:opacity-40"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
