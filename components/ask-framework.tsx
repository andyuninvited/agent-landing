"use client";

import { useState, useRef, useEffect } from "react";
import { MessageSquare, User, Sparkles, ArrowUp } from "lucide-react";
import {
  askFramework,
  suggestedQuestions,
  seedQuestion,
  type Verdict,
} from "@/lib/framework";

type Turn = { question: string; verdict: Verdict };

const toneLabel: Record<Verdict["tone"], string> = {
  landed: "Landed",
  mixed: "Landed (agent-only)",
  "at-risk": "At risk",
  info: "Verdict",
};

export function AskFramework() {
  const [turns, setTurns] = useState<Turn[]>([
    { question: seedQuestion, verdict: askFramework(seedQuestion) },
  ]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [turns]);

  function ask(q: string) {
    const question = q.trim();
    if (!question) return;
    setTurns((prev) => [...prev, { question, verdict: askFramework(question) }]);
    setInput("");
  }

  return (
    <section className="bg-surface-container rounded-3xl p-6 border border-border-subtle space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-primary" />
        <h3 className="font-display text-[22px] font-semibold text-on-surface">
          Ask the framework
        </h3>
        <span className="ml-auto text-[9px] font-bold uppercase tracking-widest text-on-surface-variant bg-surface-white border border-border-subtle rounded-full px-2 py-0.5">
          reasons over synthetic data
        </span>
      </div>

      <div className="bg-surface-white rounded-2xl p-5 border border-border-subtle flex flex-col min-h-[380px] shadow-sm">
        <div
          ref={scrollRef}
          className="flex-1 space-y-6 overflow-y-auto max-h-[360px] no-scrollbar pr-1"
        >
          {turns.map((t, i) => (
            <div key={i} className="space-y-6">
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-surface-container flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-on-surface-variant" />
                </div>
                <div className="bg-surface-container-low px-4 py-2.5 rounded-2xl rounded-tl-none max-w-md border border-border-subtle">
                  <p className="text-[13px] text-on-surface">{t.question}</p>
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <div className="bg-primary px-4 py-3 rounded-2xl rounded-tr-none max-w-lg text-on-primary">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Sparkles className="w-4 h-4" />
                    <span className="text-[9px] font-bold tracking-widest uppercase opacity-80">
                      {toneLabel[t.verdict.tone]}
                    </span>
                  </div>
                  <p className="text-[13px] leading-relaxed">{t.verdict.answer}</p>
                  <p className="text-[10px] font-mono mt-2 text-on-primary/50">
                    {t.verdict.source}
                  </p>
                </div>
                <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-on-primary" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-4 border-t border-border-subtle mt-4 space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-[11px] text-on-surface-variant font-bold uppercase tracking-tight mr-1">
              Suggested:
            </span>
            {suggestedQuestions.map((q) => (
              <button
                key={q}
                onClick={() => ask(q)}
                className="px-3 py-1.5 bg-surface-container hover:bg-surface-container-high transition-colors rounded-full text-[11px] font-medium text-on-surface border border-outline-variant"
              >
                {q}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
            className="flex items-center gap-2 bg-surface-container-low border border-border-subtle rounded-xl px-3 py-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Did sdk-v4 land? What's the retry rate?"
              className="flex-1 bg-transparent text-[13px] text-on-surface placeholder:text-outline focus:outline-none"
            />
            <button
              type="submit"
              aria-label="Ask"
              className="w-7 h-7 rounded-lg bg-primary text-on-primary flex items-center justify-center hover:opacity-90 transition-opacity"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
