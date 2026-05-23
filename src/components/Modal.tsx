"use client";

import { useCallback, useEffect, useState } from "react";

type ConfirmOpts = {
  title: string;
  body?: string;
  confirm?: string;
  cancel?: string;
  tone?: "default" | "danger";
};

type PromptOpts = {
  title: string;
  body?: string;
  placeholder?: string;
  initial?: string;
  confirm?: string;
  cancel?: string;
  required?: boolean;
  maxLength?: number;
};

type ConfirmState = ConfirmOpts & {
  kind: "confirm";
  resolve: (ok: boolean) => void;
};

type PromptState = PromptOpts & {
  kind: "prompt";
  resolve: (value: string | null) => void;
};

type State = ConfirmState | PromptState;

let push: ((s: State) => void) | null = null;

/**
 * Drop-in replacement for `window.confirm`. Resolves to true if the user
 * accepts, false otherwise. Falls back to native confirm() if the host
 * <ModalHost /> isn't mounted (server side / before hydration).
 */
export function confirmDialog(opts: ConfirmOpts): Promise<boolean> {
  return new Promise((resolve) => {
    if (!push) {
      resolve(typeof window !== "undefined" ? window.confirm(opts.title) : false);
      return;
    }
    push({ kind: "confirm", ...opts, resolve });
  });
}

/**
 * Drop-in replacement for `window.prompt`. Resolves to the entered string,
 * or null if the user cancels. Falls back to native prompt() if the host
 * isn't mounted.
 */
export function promptDialog(opts: PromptOpts): Promise<string | null> {
  return new Promise((resolve) => {
    if (!push) {
      resolve(
        typeof window !== "undefined"
          ? window.prompt(opts.title, opts.initial ?? "")
          : null,
      );
      return;
    }
    push({ kind: "prompt", ...opts, resolve });
  });
}

/**
 * Mount this once at the page root. All confirm/prompt dialogs render here.
 */
export function ModalHost() {
  const [state, setState] = useState<State | null>(null);

  useEffect(() => {
    push = (s) => setState(s);
    return () => {
      push = null;
    };
  }, []);

  const close = useCallback(
    (result: boolean | string | null) => {
      if (!state) return;
      if (state.kind === "confirm") state.resolve(typeof result === "boolean" ? result : false);
      else state.resolve(typeof result === "string" ? result : null);
      setState(null);
    },
    [state],
  );

  useEffect(() => {
    if (!state) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close(state.kind === "confirm" ? false : null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [state, close]);

  if (!state) return null;

  if (state.kind === "confirm") {
    return (
      <Shell onBackdrop={() => close(false)}>
        <h3 className="text-lg font-bold text-zinc-100">{state.title}</h3>
        {state.body && (
          <p className="text-sm text-zinc-300 whitespace-pre-wrap">{state.body}</p>
        )}
        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => close(false)}
            className="rounded-sm border border-zinc-700 bg-zinc-900 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-zinc-200 hover:border-zinc-500"
          >
            {state.cancel ?? "Cancel"}
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => close(true)}
            className={
              state.tone === "danger"
                ? "rounded-sm border border-rose-500/60 bg-rose-500/15 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-rose-100 hover:bg-rose-500/25"
                : "rounded-sm bg-gradient-to-r from-emerald-400 via-cyan-500 to-rose-500 px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-zinc-950 hover:brightness-110"
            }
          >
            {state.confirm ?? "Confirm"}
          </button>
        </div>
      </Shell>
    );
  }

  // prompt
  return (
    <PromptForm
      state={state}
      onCancel={() => close(null)}
      onSubmit={(v) => close(v)}
    />
  );
}

function PromptForm({
  state,
  onCancel,
  onSubmit,
}: {
  state: PromptState;
  onCancel: () => void;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState(state.initial ?? "");
  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (state.required && !value.trim()) return;
    onSubmit(value);
  };
  return (
    <Shell onBackdrop={onCancel}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <h3 className="text-lg font-bold text-zinc-100">{state.title}</h3>
        {state.body && (
          <p className="text-sm text-zinc-300 whitespace-pre-wrap">{state.body}</p>
        )}
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={state.placeholder}
          maxLength={state.maxLength ?? 200}
          className="rounded-sm border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-400/20"
        />
        <div className="mt-1 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-sm border border-zinc-700 bg-zinc-900 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-zinc-200 hover:border-zinc-500"
          >
            {state.cancel ?? "Cancel"}
          </button>
          <button
            type="submit"
            disabled={state.required ? !value.trim() : false}
            className="rounded-sm bg-gradient-to-r from-emerald-400 via-cyan-500 to-rose-500 px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-zinc-950 hover:brightness-110 disabled:opacity-40"
          >
            {state.confirm ?? "OK"}
          </button>
        </div>
      </form>
    </Shell>
  );
}

function Shell({
  children,
  onBackdrop,
}: {
  children: React.ReactNode;
  onBackdrop: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onBackdrop}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl"
      >
        <div className="flex flex-col gap-3">{children}</div>
      </div>
    </div>
  );
}
