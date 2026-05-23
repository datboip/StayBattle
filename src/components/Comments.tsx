"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addComment } from "@/app/actions";
import { useVoter } from "@/lib/voter";
import type { Comment } from "@/lib/types";

type ThreadNode = { comment: Comment; replies: Comment[] };

function buildThreads(comments: Comment[], ownerId: string | null): {
  pinned: ThreadNode[];
  regular: ThreadNode[];
} {
  const tops: Comment[] = [];
  const byParent = new Map<string, Comment[]>();
  for (const c of comments) {
    if (c.parent_id) {
      const arr = byParent.get(c.parent_id) ?? [];
      arr.push(c);
      byParent.set(c.parent_id, arr);
    } else {
      tops.push(c);
    }
  }
  const pinned: ThreadNode[] = [];
  const regular: ThreadNode[] = [];
  for (const top of tops) {
    const replies = (byParent.get(top.id) ?? []).sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    const node = { comment: top, replies };
    if (ownerId && top.voter_id === ownerId) pinned.push(node);
    else regular.push(node);
  }
  return { pinned, regular };
}

export function Comments({
  listingId,
  comments,
  ownerId = null,
}: {
  listingId: string;
  comments: Comment[];
  ownerId?: string | null;
}) {
  const router = useRouter();
  const { voter } = useVoter();
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const inputId = useId();

  const { pinned, regular } = useMemo(
    () => buildThreads(comments, ownerId),
    [comments, ownerId],
  );

  const submitTop = (e: React.FormEvent) => {
    e.preventDefault();
    if (!voter || !body.trim()) return;
    const text = body;
    startTransition(async () => {
      const res = await addComment(listingId, voter.id, voter.name, text);
      if (res.ok) {
        setBody("");
        router.refresh();
      }
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {pinned.length > 0 && (
        <div className="flex flex-col gap-2">
          {pinned.map((t) => (
            <Thread
              key={t.comment.id}
              node={t}
              ownerId={ownerId}
              pinned
              voterId={voter?.id ?? null}
              voterName={voter?.name ?? ""}
              listingId={listingId}
              replyTo={replyTo}
              setReplyTo={setReplyTo}
            />
          ))}
        </div>
      )}

      {regular.length > 0 && (
        <div className="flex flex-col gap-2">
          {regular.map((t) => (
            <Thread
              key={t.comment.id}
              node={t}
              ownerId={ownerId}
              voterId={voter?.id ?? null}
              voterName={voter?.name ?? ""}
              listingId={listingId}
              replyTo={replyTo}
              setReplyTo={setReplyTo}
            />
          ))}
        </div>
      )}

      <form onSubmit={submitTop} className="flex gap-2">
        <label htmlFor={inputId} className="sr-only">
          Add a comment
        </label>
        <input
          id={inputId}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Throw a jab…"
          maxLength={2000}
          className="flex-1 rounded-sm border border-zinc-800 bg-zinc-950/60 px-2.5 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-rose-400 focus-visible:ring-2 focus-visible:ring-rose-400/30"
        />
        <button
          type="submit"
          disabled={isPending || !body.trim()}
          className="rounded-sm border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs uppercase tracking-wider text-zinc-100 hover:border-rose-500 disabled:opacity-40"
        >
          jab
        </button>
      </form>
    </div>
  );
}

function Thread({
  node,
  ownerId,
  pinned = false,
  voterId,
  voterName,
  listingId,
  replyTo,
  setReplyTo,
}: {
  node: ThreadNode;
  ownerId: string | null;
  pinned?: boolean;
  voterId: string | null;
  voterName: string;
  listingId: string;
  replyTo: string | null;
  setReplyTo: (id: string | null) => void;
}) {
  const { comment, replies } = node;
  const wrapper = pinned
    ? "rounded-sm border-l-2 border-amber-400/70 bg-amber-500/5 px-2.5 py-1.5 text-xs"
    : "rounded-sm bg-zinc-950/70 px-2.5 py-1.5 text-xs";

  return (
    <div className="flex flex-col gap-1.5">
      <div className={wrapper}>
        <div className="flex items-baseline justify-between gap-2">
          <span className="flex items-center gap-1.5 font-mono uppercase tracking-wider">
            {pinned && (
              <span
                aria-label="Pinned by listing owner"
                className="rounded-sm bg-amber-400/20 px-1 text-[9px] text-amber-200"
              >
                📌 pinned
              </span>
            )}
            <span
              className={pinned ? "text-amber-200" : "text-rose-300"}
            >
              {comment.voter_name}
            </span>
          </span>
          <span className="font-mono text-[10px] text-zinc-400">
            {new Date(comment.created_at).toLocaleString()}
          </span>
        </div>
        <p className={`mt-0.5 whitespace-pre-wrap ${pinned ? "text-zinc-100" : "text-zinc-200"}`}>
          {comment.body}
        </p>
        <div className="mt-1 flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider">
          <button
            type="button"
            onClick={() =>
              setReplyTo(replyTo === comment.id ? null : comment.id)
            }
            className="text-zinc-400 hover:text-rose-300"
          >
            {replyTo === comment.id ? "cancel" : "reply"}
          </button>
          {replies.length > 0 && (
            <span className="text-zinc-500">
              {replies.length} repl{replies.length === 1 ? "y" : "ies"}
            </span>
          )}
        </div>
      </div>

      {(replies.length > 0 || replyTo === comment.id) && (
        <div className="ml-3 flex flex-col gap-1 border-l border-zinc-800 pl-3">
          {replies.map((r) => (
            <div
              key={r.id}
              className="rounded-sm bg-zinc-950/70 px-2.5 py-1.5 text-xs"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono uppercase tracking-wider text-cyan-300">
                  {r.voter_name}
                </span>
                <span className="font-mono text-[10px] text-zinc-400">
                  {new Date(r.created_at).toLocaleString()}
                </span>
              </div>
              <p className="mt-0.5 whitespace-pre-wrap text-zinc-200">{r.body}</p>
            </div>
          ))}
          {replyTo === comment.id && voterId && (
            <ReplyForm
              listingId={listingId}
              parentId={comment.id}
              voterId={voterId}
              voterName={voterName}
              onDone={() => setReplyTo(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ReplyForm({
  listingId,
  parentId,
  voterId,
  voterName,
  onDone,
}: {
  listingId: string;
  parentId: string;
  voterId: string;
  voterName: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    if (!body.trim()) return;
    const text = body;
    startTransition(async () => {
      const res = await addComment(listingId, voterId, voterName, text, parentId);
      if (res.ok) {
        setBody("");
        onDone();
        router.refresh();
      }
    });
  };

  return (
    <div className="flex gap-2">
      <input
        autoFocus
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Counter-jab…"
        maxLength={2000}
        aria-label="Reply to this comment"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          } else if (e.key === "Escape") {
            onDone();
          }
        }}
        className="flex-1 rounded-sm border border-zinc-800 bg-zinc-950/60 px-2 py-1 text-xs text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-rose-400"
      />
      <button
        type="button"
        onClick={submit}
        disabled={isPending || !body.trim()}
        className="rounded-sm border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs uppercase tracking-wider text-zinc-100 hover:border-rose-500 disabled:opacity-40"
      >
        reply
      </button>
    </div>
  );
}
