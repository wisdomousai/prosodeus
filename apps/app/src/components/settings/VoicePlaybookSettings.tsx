import type { PlaybookPlatform } from "@prosodeus/core/browser";
import { COPY_PLAYBOOK, PLAYBOOK_PLATFORMS } from "@prosodeus/core/browser";
import type { WorkspaceMeta, WorkspaceSettings } from "@prosodeus/shared/browser";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createUserStyle, listWorkspaces, updateWorkspace } from "@/lib/api";
import { trainVoiceFromExemplar } from "@/lib/voice-training";

export function VoicePlaybookSettings() {
  const [workspaces, setWorkspaces] = useState<WorkspaceMeta[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string>("");
  const [voiceDna, setVoiceDna] = useState("");
  const [defaultPlatform, setDefaultPlatform] = useState<PlaybookPlatform | "">("");
  const [exemplar, setExemplar] = useState("");
  const [training, setTraining] = useState(false);
  const [trainMessage, setTrainMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    listWorkspaces()
      .then((ws) => {
        setWorkspaces(ws);
        if (ws[0]) {
          setWorkspaceId(ws[0].id);
          const s = ws[0].settings;
          setVoiceDna(s?.voice_dna ?? "");
          setDefaultPlatform(s?.default_playbook_platform ?? "");
        }
      })
      .catch(() => {});
  }, []);

  const onWorkspaceChange = useCallback(
    (id: string) => {
      setWorkspaceId(id);
      const ws = workspaces.find((w) => w.id === id);
      const s = ws?.settings;
      setVoiceDna(s?.voice_dna ?? "");
      setDefaultPlatform(s?.default_playbook_platform ?? "");
      setSaved(false);
    },
    [workspaces],
  );

  const save = useCallback(async () => {
    if (!workspaceId) return;
    setSaving(true);
    setSaved(false);
    try {
      const ws = workspaces.find((w) => w.id === workspaceId);
      const settings: WorkspaceSettings = {
        ...(ws?.settings ?? {}),
        voice_dna: voiceDna.trim() || undefined,
        default_playbook_platform: defaultPlatform || undefined,
      };
      await updateWorkspace(workspaceId, { settings });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }, [workspaceId, workspaces, voiceDna, defaultPlatform]);

  const trainFromExemplar = useCallback(async () => {
    if (!workspaceId) return;
    const words = exemplar.trim().split(/\s+/).filter(Boolean).length;
    if (words < 100) {
      setTrainMessage("Paste at least ~100 words of exemplar copy.");
      return;
    }
    setTraining(true);
    setTrainMessage(null);
    try {
      const ws = workspaces.find((w) => w.id === workspaceId);
      const { guide, voiceDna: trainedVoice } = trainVoiceFromExemplar(exemplar, "My Voice");
      const created = await createUserStyle({
        name: guide.name,
        description: guide.description,
        policy: { targets: guide.targets, continuity_parameter: guide.continuity_parameter },
        is_default: false,
      });
      const settings: WorkspaceSettings = {
        ...(ws?.settings ?? {}),
        voice_dna: trainedVoice,
        voice_style_guide_id: created.id,
        default_playbook_platform: defaultPlatform || undefined,
      };
      await updateWorkspace(workspaceId, { settings });
      setVoiceDna(trainedVoice);
      setTrainMessage("Voice trained from exemplar and linked to this workspace.");
      setSaved(true);
    } catch {
      setTrainMessage("Training failed. Try again with shorter exemplar text.");
    } finally {
      setTraining(false);
    }
  }, [workspaceId, workspaces, exemplar, defaultPlatform]);

  if (workspaces.length === 0) return null;

  return (
    <Card className="rounded py-0">
      <CardHeader className="pb-0 pt-6">
        <CardTitle className="font-mono text-[0.7rem] uppercase tracking-widest text-gold">
          Voice & Playbook
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pb-6">
        {workspaces.length > 1 ? (
          <div className="space-y-2">
            <label className="font-mono text-[0.7rem] uppercase tracking-wider text-muted-foreground">
              Workspace
            </label>
            <Select value={workspaceId} onValueChange={onWorkspaceChange}>
              <SelectTrigger className="font-mono text-[0.8rem]">
                <SelectValue placeholder="Select workspace" />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <div className="space-y-2">
          <label className="font-mono text-[0.7rem] uppercase tracking-wider text-muted-foreground">
            Voice DNA
          </label>
          <textarea
            value={voiceDna}
            onChange={(e) => {
              setVoiceDna(e.target.value);
              setSaved(false);
            }}
            placeholder="Write like a VP sending a quick Slack to the exec team. Direct, no fluff. Use I and you."
            className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
          />
        </div>
        <div className="space-y-2">
          <label className="font-mono text-[0.7rem] uppercase tracking-wider text-muted-foreground">
            Default playbook platform
          </label>
          <Select
            value={defaultPlatform || " "}
            onValueChange={(v) => {
              setDefaultPlatform(v === " " ? "" : (v as PlaybookPlatform));
              setSaved(false);
            }}
          >
            <SelectTrigger className="font-mono text-[0.8rem]">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value=" ">None</SelectItem>
              {PLAYBOOK_PLATFORMS.map((id) => (
                <SelectItem key={id} value={id}>
                  {COPY_PLAYBOOK.platform_presets[id].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="font-mono text-[0.7rem] uppercase tracking-wider text-muted-foreground">
            Train from exemplar
          </label>
          <textarea
            value={exemplar}
            onChange={(e) => {
              setExemplar(e.target.value);
              setTrainMessage(null);
            }}
            placeholder="Paste 500–2000 words of writing that sounds like you. We'll derive a personal style guide and voice DNA."
            className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="font-mono text-xs"
            disabled={training || !workspaceId || !exemplar.trim()}
            onClick={() => void trainFromExemplar()}
          >
            {training ? "Training…" : "Train from exemplar"}
          </Button>
          {trainMessage ? (
            <p className="font-mono text-[0.65rem] text-muted-foreground">{trainMessage}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            size="sm"
            className="font-mono text-xs"
            disabled={saving || !workspaceId}
            onClick={() => void save()}
          >
            {saving ? "Saving…" : "Save voice settings"}
          </Button>
          {saved ? (
            <span className="font-mono text-[0.65rem] text-muted-foreground">Saved</span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
