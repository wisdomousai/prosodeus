import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { PatternCreateRequest } from "@/lib/api";
import { suggestPatternFromSentence } from "@/lib/api";

interface Props {
  /**
   * Called with the AI-generated draft once synthesis succeeds.
   * The parent is expected to open the inline editor seeded with this draft.
   */
  onSuggested: (draft: PatternCreateRequest) => void;
}

/**
 * Compact button + popover that takes a "sentence that feels wrong" from the
 * user and asks the backend synthesizer to draft a structural-prose pattern
 * for it. The popover closes on success and hands the draft to the parent.
 */
export function PatternSuggestPopover({ onSuggested }: Props) {
  const [open, setOpen] = useState(false);
  const [sentence, setSentence] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = sentence.trim().length > 0 && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const result = await suggestPatternFromSentence(sentence.trim());
      onSuggested(result.pattern);
      setOpen(false);
      setSentence("");
    } catch (err) {
      setError((err as Error)?.message ?? "Synthesis failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 font-mono text-[11px]">
          <Sparkles className="size-3.5" />
          AI suggest
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-4">
        <div className="space-y-3">
          <div>
            <h3 className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              Suggest a rule from a sentence
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Paste a sentence that feels structurally wrong. We'll diagnose the pattern and draft a
              rule you can fine-tune before saving.
            </p>
          </div>
          <textarea
            value={sentence}
            onChange={(e) => setSentence(e.target.value)}
            placeholder="It is important to note that this is not just a sentence, but rather a deeply structured observation about prose."
            rows={4}
            maxLength={1500}
            disabled={loading}
            className="w-full resize-y rounded border border-input bg-background px-3 py-2 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          {error ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] text-muted-foreground">⌘+Enter to send</span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setOpen(false);
                  setSentence("");
                  setError(null);
                }}
                disabled={loading}
                className="h-7 font-mono text-[11px]"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="h-7 gap-1.5 font-mono text-[11px]"
              >
                {loading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5" />
                )}
                {loading ? "Drafting…" : "Identify & suggest"}
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
