"use client";
// Slide-over panel showing a cited verse inside its whole chapter.
// On phones it covers the screen; on wider screens it slides in from the right.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ContextNote } from "@/components/ContextNote";

type PassageVerse = { id: number; verse: number; text: string; highlighted: boolean };
type PassageData = { reference: string; title: string; readerHref: string; verses: PassageVerse[] };

// TypeScript note: `PassageData | { error: string } | null` — the state is one of three things:
// the loaded passage, an error, or nothing yet.
type LoadState = PassageData | { error: string } | null;

export function PassagePanel({ reference, onClose }: { reference: string; onClose: () => void }) {
  // Remember which reference the loaded result belongs to, so a stale result is never shown.
  const [loaded, setLoaded] = useState<{ reference: string; data: LoadState }>({
    reference: "",
    data: null,
  });
  const highlightRef = useRef<HTMLSpanElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // useEffect runs after the component appears on screen (and again when `reference` changes).
  useEffect(() => {
    let cancelled = false; // ignore the result if the user clicked another citation meanwhile
    fetch(`/api/passage?ref=${encodeURIComponent(reference)}`)
      .then((res) => res.json())
      .then((data: LoadState) => {
        if (!cancelled) setLoaded({ reference, data });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ reference, data: { error: "Couldn't load this passage." } });
      });
    return () => {
      cancelled = true;
    };
  }, [reference]);

  const data = loaded.reference === reference ? loaded.data : null;

  // Close with the Escape key, and move keyboard focus into the panel when it opens.
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Once the chapter loads, scroll the cited verse into the middle of the panel.
  // (We scroll only the panel's own area; scrollIntoView would also scroll the page behind it.)
  useEffect(() => {
    const area = scrollAreaRef.current;
    const verse = highlightRef.current;
    if (area && verse) area.scrollTop = verse.offsetTop - area.clientHeight / 3;
  }, [data]);

  const firstHighlightId =
    data !== null && "verses" in data ? data.verses.find((v) => v.highlighted)?.id : undefined;

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label={reference}>
      {/* Dimmed backdrop: clicking it closes the panel. */}
      <button aria-label="Close passage" className="absolute inset-0 bg-ink/30" onClick={onClose} tabIndex={-1} />

      <aside className="relative flex h-full w-full flex-col bg-paper shadow-xl sm:max-w-md sm:border-l sm:border-line">
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <p className="text-xs tracking-widest text-muted uppercase">Passage</p>
            <h2 className="font-serif text-xl font-semibold">{reference}</h2>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-accent-soft"
          >
            Close
          </button>
        </header>

        <div ref={scrollAreaRef} className="relative flex-1 overflow-y-auto px-5 py-4">
          {data === null && <p className="text-muted">Loading…</p>}
          {data !== null && "error" in data && <p className="text-warn">{data.error}</p>}
          {data !== null && "verses" in data && (
            <>
              <h3 className="mb-3 text-sm font-semibold text-muted">{data.title}</h3>
              <div className="font-serif text-[1.05rem] leading-loose">
                {data.verses.map((v) => {
                  return (
                    <span
                      key={v.id}
                      ref={v.id === firstHighlightId ? highlightRef : undefined}
                      className={v.highlighted ? "rounded-sm bg-accent-soft shadow-[0_0_0_3px_var(--accent-soft)]" : ""}
                    >
                      <sup className="mr-1 font-sans text-xs text-muted">{v.verse}</sup>
                      {v.text}{" "}
                    </span>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <footer className="space-y-3 border-t border-line px-5 py-4">
          {data !== null && "readerHref" in data && (
            <Link href={data.readerHref} className="text-sm font-medium text-accent hover:underline">
              Open {data.title} in the Reader →
            </Link>
          )}
          <ContextNote />
        </footer>
      </aside>
    </div>
  );
}
