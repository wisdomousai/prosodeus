import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Key, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { desktopApi, isDesktop } from "@/lib/desktop-bridge";

const PROVIDERS = [
  { id: "mistral", name: "Mistral", placeholder: "sk-..." },
  { id: "groq", name: "Groq", placeholder: "gsk_..." },
  { id: "google", name: "Google Gemini", placeholder: "AIza..." },
  { id: "openai", name: "OpenAI", placeholder: "sk-..." },
  { id: "moonshot", name: "Moonshot (Kimi)", placeholder: "sk-... or sk-kimi-... (Code plan)" },
] as const;

type UsageSnapshot = {
  provider: string;
  count: number;
  limit: number | null;
  pct: number | null;
  nearLimit: boolean;
};

export const Route = createFileRoute("/app/account/byok")({
  component: ByokKeys,
});

function ByokKeys() {
  const [configured, setConfigured] = useState<string[]>([]);
  const [cfConfigured, setCfConfigured] = useState(false);
  const [devVars, setDevVars] = useState<{
    active: boolean;
    path: string | null;
    providers: string[];
    cfConfigured: boolean;
  } | null>(null);
  const [usage, setUsage] = useState<UsageSnapshot[]>([]);
  const [provider, setProvider] = useState<(typeof PROVIDERS)[number]["id"]>("mistral");
  const [key, setKey] = useState("");
  const [cfAccountId, setCfAccountId] = useState("");
  const [cfToken, setCfToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [cfSaving, setCfSaving] = useState(false);

  const load = async () => {
    if (!isDesktop()) return;
    try {
      const api = desktopApi();
      const [list, hasCf, usageList, devStatus] = await Promise.all([
        api.byok.list(),
        api.cf.hasCredentials(),
        api.usage.list(),
        api.byok.devVarsStatus(),
      ]);
      setConfigured(list);
      setCfConfigured(hasCf);
      setUsage(usageList);
      setDevVars(devStatus);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!isDesktop() || !key.trim()) return;
    setSaving(true);
    try {
      await desktopApi().byok.set(provider, key.trim());
      setKey("");
      await load();
    } finally {
      setSaving(false);
    }
  };

  const saveCf = async () => {
    if (!isDesktop() || !cfAccountId.trim() || !cfToken.trim()) return;
    setCfSaving(true);
    try {
      await desktopApi().cf.set({ accountId: cfAccountId.trim(), apiToken: cfToken.trim() });
      setCfAccountId("");
      setCfToken("");
      await load();
    } finally {
      setCfSaving(false);
    }
  };

  const remove = async (p: string) => {
    if (!isDesktop()) return;
    await desktopApi().byok.remove(p);
    await load();
  };

  const removeCf = async () => {
    if (!isDesktop()) return;
    await desktopApi().cf.remove();
    await load();
  };

  if (!isDesktop()) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          BYOK keys are only available in the desktop app.
        </CardContent>
      </Card>
    );
  }

  const selected = PROVIDERS.find((p) => p.id === provider)!;
  const nearLimitProviders = usage.filter((u) => u.nearLimit);

  return (
    <div className="space-y-8">
      <div>
        <h3 className="font-display text-xl text-card-foreground mb-1">External API Keys</h3>
        <p className="font-mono text-[0.7rem] text-muted-foreground">
          Store your own keys for classification and rewrite. They are encrypted in the OS keychain.
        </p>
      </div>

      {devVars?.active ? (
        <Alert>
          <Key className="size-4" />
          <AlertDescription className="font-mono text-xs">
            Dev mode: using API keys from{" "}
            <span className="text-foreground">{devVars.path ?? "apps/worker/.dev.vars"}</span>
            {devVars.providers.length > 0 ? ` (${devVars.providers.join(", ")})` : null}
            {devVars.cfConfigured ? " + Cloudflare Workers AI" : null}. Stored keys take precedence
            when set.
          </AlertDescription>
        </Alert>
      ) : null}

      {nearLimitProviders.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription className="font-mono text-xs">
            {nearLimitProviders.map((u) => (
              <span key={u.provider} className="block">
                {u.provider}: {u.count}/{u.limit} requests today ({u.pct}%)
              </span>
            ))}
          </AlertDescription>
        </Alert>
      )}

      {/* Cloudflare Workers AI */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div>
            <div className="font-mono text-sm font-medium mb-1">Cloudflare Workers AI</div>
            <p className="text-[0.7rem] text-muted-foreground font-mono">
              Preferred for classification when configured. Uses your free CF neurons —{" "}
              <a
                href="https://developers.cloudflare.com/workers-ai/get-started/rest-api/"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                create an API token
              </a>
              .
            </p>
          </div>
          {cfConfigured ? (
            <div className="flex items-center justify-between rounded border border-border px-4 py-3">
              <span className="font-mono text-sm">Workers AI configured</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-blood-bright"
                onClick={removeCf}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1">
                  Account ID
                </label>
                <Input
                  value={cfAccountId}
                  onChange={(e) => setCfAccountId(e.target.value)}
                  placeholder="32-char hex"
                  className="font-mono text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1">
                  API Token
                </label>
                <Input
                  type="password"
                  value={cfToken}
                  onChange={(e) => setCfToken(e.target.value)}
                  placeholder="Workers AI token"
                  className="font-mono text-sm"
                />
              </div>
            </div>
          )}
          {!cfConfigured && (
            <div className="flex justify-end">
              <Button
                onClick={saveCf}
                disabled={!cfAccountId.trim() || !cfToken.trim() || cfSaving}
                className="gap-2"
              >
                <Key className="size-4" /> Save Cloudflare
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add key form */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1">
                Provider
              </label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as typeof provider)}
                className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm font-mono"
              >
                {PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground block mb-1">
                API Key
              </label>
              <Input
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder={selected.placeholder}
                className="font-mono text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={save} disabled={!key.trim() || saving} className="gap-2">
              <Key className="size-4" /> Save key
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Configured keys */}
      <div>
        <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3">
          Stored keys
        </div>
        {configured.length === 0 && !cfConfigured ? (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No external keys stored yet. Add Cloudflare or another provider above.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {cfConfigured && (
              <Card className="rounded">
                <CardContent className="py-3 px-4 flex items-center justify-between">
                  <div className="font-mono text-sm">Cloudflare Workers AI</div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-blood-bright"
                    onClick={removeCf}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </CardContent>
              </Card>
            )}
            {configured.map((p) => {
              const meta = PROVIDERS.find((x) => x.id === p);
              const usageRow = usage.find((u) => u.provider === p);
              return (
                <Card key={p} className="rounded">
                  <CardContent className="py-3 px-4 flex items-center justify-between">
                    <div>
                      <div className="font-mono text-sm">{meta?.name ?? p}</div>
                      {usageRow?.limit != null && (
                        <div className="text-[10px] text-muted-foreground font-mono">
                          {usageRow.count}/{usageRow.limit} requests today
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-blood-bright"
                      onClick={() => remove(p)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground font-mono">
        Keys are encrypted with the OS keychain and never leave your machine. Classification prefers
        Cloudflare → Gemini → Groq → Claude when no model is selected.
      </p>
    </div>
  );
}
