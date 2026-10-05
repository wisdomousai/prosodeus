import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { VoicePlaybookSettings } from "@/components/settings/VoicePlaybookSettings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { fetchModels, fetchStyles, type ModelInfo, type StyleInfo } from "@/lib/api";
import { styleDisplayName } from "@/lib/style-labels";

export const Route = createFileRoute("/app/account/")({
  component: Profile,
});

function Profile() {
  const { user } = useAuth();
  const [styles, setStyles] = useState<StyleInfo[]>([]);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [prefModel, setPrefModel] = useState(
    () => localStorage.getItem("prosodeus_pref_model") ?? "",
  );
  const [prefStyle, setPrefStyle] = useState(
    () => localStorage.getItem("prosodeus_pref_style") ?? "",
  );

  useEffect(() => {
    fetchStyles()
      .then(setStyles)
      .catch(() => {});
    fetchModels()
      .then(setModels)
      .catch(() => {});
  }, []);

  const handleModelChange = (value: string) => {
    const v = value === " " ? "" : value;
    setPrefModel(v);
    if (v) localStorage.setItem("prosodeus_pref_model", v);
    else localStorage.removeItem("prosodeus_pref_model");
  };

  const handleStyleChange = (value: string) => {
    const v = value === " " ? "" : value;
    setPrefStyle(v);
    if (v) localStorage.setItem("prosodeus_pref_style", v);
    else localStorage.removeItem("prosodeus_pref_style");
  };

  return (
    <div className="space-y-8">
      <Card className="rounded py-0">
        <CardHeader className="pb-0 pt-6">
          <CardTitle className="font-mono text-[0.7rem] uppercase tracking-widest text-gold">
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-6">
          <span className="font-mono text-[0.8rem] text-foreground">
            {user?.email || "Local user"}
          </span>
        </CardContent>
      </Card>

      <Card className="rounded py-0">
        <CardHeader className="pb-0 pt-6">
          <CardTitle className="font-mono text-[0.7rem] uppercase tracking-widest text-gold">
            Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-6 space-y-5">
          <div className="space-y-2">
            <label className="font-mono text-[0.7rem] text-muted-foreground uppercase tracking-wider">
              Default Model
            </label>
            <Select value={prefModel || " "} onValueChange={handleModelChange}>
              <SelectTrigger className="font-mono text-[0.8rem]">
                <SelectValue placeholder="Auto (best available)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value=" ">Auto (best available)</SelectItem>
                {models.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name} <span className="text-muted-foreground/60">({m.provider})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="font-mono text-[0.7rem] text-muted-foreground uppercase tracking-wider">
              Default Style Guide
            </label>
            <Select value={prefStyle || " "} onValueChange={handleStyleChange}>
              <SelectTrigger className="font-mono text-[0.8rem]">
                <SelectValue placeholder="No style guide" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value=" ">No style guide</SelectItem>
                {styles.map((s) => (
                  <SelectItem key={s.name} value={s.name}>
                    {styleDisplayName(s.name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <VoicePlaybookSettings />
    </div>
  );
}
