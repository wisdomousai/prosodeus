import { BookOpen, Briefcase, FileText, Mail, Newspaper } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { TemplateMeta } from "@/lib/api";
import { listTemplates } from "@/lib/api";

// Built-in templates (shipped with the product, no DB entry needed)
const BUILT_IN_TEMPLATES: Array<{
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  content: string;
  default_tags?: string[];
}> = [
  {
    id: "__blank__",
    title: "Blank Document",
    description: "Start from scratch",
    icon: <FileText className="size-5" />,
    content: "",
  },
  {
    id: "__essay__",
    title: "Five-Paragraph Essay",
    description: "Introduction, three body paragraphs, conclusion",
    icon: <BookOpen className="size-5" />,
    content: `[Introduction — State your thesis clearly. Hook the reader, then narrow to your central argument.]

[Body Paragraph 1 — Present your strongest supporting point. Open with a topic sentence, provide evidence, then explain how it supports your thesis.]

[Body Paragraph 2 — Present your second supporting point. Use a different type of evidence or approach than paragraph 1.]

[Body Paragraph 3 — Present your final supporting point, or address a counterargument and explain why your thesis still holds.]

[Conclusion — Restate your thesis in light of the evidence presented. End with a broader implication or call to action.]`,
    default_tags: ["essay"],
  },
  {
    id: "__blog__",
    title: "Blog Post",
    description: "Hook, body sections, call to action",
    icon: <Newspaper className="size-5" />,
    content: `[Headline — Clear, specific, and compelling. Promise a benefit or spark curiosity.]

[Opening Hook — Start with a story, surprising stat, or provocative question. Get the reader invested in 2-3 sentences.]

[Context — Brief background. Why does this matter now? Who is this for?]

[Main Point 1 — Your strongest insight. Support with examples, data, or a short anecdote.]

[Main Point 2 — Build on the first point or offer a complementary angle.]

[Main Point 3 — Address the "but what about..." objection your reader is thinking.]

[Conclusion & CTA — Summarize the takeaway in one sentence. Tell the reader what to do next.]`,
    default_tags: ["blog"],
  },
  {
    id: "__memo__",
    title: "Memo / Meeting Notes",
    description: "Date, attendees, agenda, decisions, action items",
    icon: <Mail className="size-5" />,
    content: `Date: [Date]
To: [Recipients]
From: [Author]
Subject: [Topic]

Purpose: [One sentence on why this memo exists.]

Background: [2-3 sentences of context the reader needs.]

Key Points:
- [Point 1]
- [Point 2]
- [Point 3]

Decision / Recommendation: [What you're proposing or what was decided.]

Action Items:
- [ ] [Task] — Owner: [Name] — Due: [Date]
- [ ] [Task] — Owner: [Name] — Due: [Date]

Next Steps: [When is the follow-up? What happens if no action is taken?]`,
    default_tags: ["memo"],
  },
  {
    id: "__brief__",
    title: "Creative Brief",
    description: "Overview, audience, requirements, success criteria",
    icon: <Briefcase className="size-5" />,
    content: `Project: [Project name]
Client: [Client / Stakeholder]
Date: [Date]

Objective: [What is this project trying to achieve? One sentence.]

Target Audience: [Who are we writing for? Demographics, psychographics, what they care about.]

Key Message: [The single most important thing the audience should take away.]

Tone & Voice: [How should this sound? Formal, conversational, authoritative, playful?]

Deliverables:
- [Deliverable 1: format, length, channel]
- [Deliverable 2: format, length, channel]

Requirements & Constraints:
- [Must include / must avoid]
- [Brand guidelines, legal requirements]
- [Word count, format restrictions]

Success Criteria: [How will we know this worked? Metrics, feedback, approvals needed.]

Timeline:
- First draft: [Date]
- Review: [Date]
- Final: [Date]`,
    default_tags: ["brief"],
  },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (content: string, tags?: string[]) => void;
  workspaceId?: string;
}

export function TemplatePicker({ open, onOpenChange, onSelect, workspaceId }: Props) {
  const [userTemplates, setUserTemplates] = useState<TemplateMeta[]>([]);

  useEffect(() => {
    if (open) {
      listTemplates(workspaceId)
        .then(setUserTemplates)
        .catch(() => setUserTemplates([]));
    }
  }, [open, workspaceId]);

  const handleSelect = (content: string, tags?: string[]) => {
    onSelect(content, tags ?? undefined);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">New from Template</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            Choose a starting structure for your document.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-1 pr-4">
            <p className="font-mono text-[0.6rem] uppercase tracking-widest text-muted-foreground px-2 pt-2">
              Starters
            </p>
            {BUILT_IN_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => handleSelect(tpl.content, tpl.default_tags)}
                className="w-full flex items-start gap-3 rounded-md px-3 py-2.5 text-left hover:bg-secondary transition-colors cursor-pointer"
              >
                <span className="text-muted-foreground mt-0.5">{tpl.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-serif text-sm font-medium">{tpl.title}</p>
                  <p className="font-mono text-[0.65rem] text-muted-foreground">
                    {tpl.description}
                  </p>
                </div>
              </button>
            ))}

            {userTemplates.length > 0 && (
              <>
                <p className="font-mono text-[0.6rem] uppercase tracking-widest text-muted-foreground px-2 pt-4">
                  Your Templates
                </p>
                {userTemplates.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => handleSelect(tpl.content, tpl.default_tags ?? undefined)}
                    className="w-full flex items-start gap-3 rounded-md px-3 py-2.5 text-left hover:bg-secondary transition-colors cursor-pointer"
                  >
                    <span className="text-muted-foreground mt-0.5">
                      <FileText className="size-5" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-serif text-sm font-medium">{tpl.title}</p>
                      {tpl.description && (
                        <p className="font-mono text-[0.65rem] text-muted-foreground">
                          {tpl.description}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
