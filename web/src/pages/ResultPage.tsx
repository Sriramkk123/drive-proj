import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle, ExternalLink } from "lucide-react";
import { useState } from "react";
import { useSelectionStore } from "../stores/selection";

interface ResultState {
  name: string;
  link: string;
  sourceType: "drive" | "photos";
  itemCount: number;
}

export function ResultPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const reset = useSelectionStore((s) => s.reset);
  const state = location.state as ResultState | null;

  if (!state) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">No result data. Start over.</div>;
  }

  const serviceName = state.sourceType === "drive" ? "Google Drive" : "Google Photos";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(state.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartOver = () => { reset(); navigate("/"); };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex w-[440px] flex-col items-center gap-6 rounded-2xl bg-card p-12 shadow-sm">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-900/30">
          <CheckCircle className="h-8 w-8 text-green-500" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Album Created!</h2>
        <p className="text-center text-sm text-muted-foreground">
          {state.itemCount} {state.itemCount === 1 ? "item has" : "items have"} been added to your new {serviceName} folder.
        </p>
        <div className="flex w-full items-center justify-between rounded-lg border border-border bg-background px-4 py-3">
          <span className="truncate font-mono text-xs text-muted-foreground">{state.link}</span>
          <button onClick={handleCopy} className="ml-2 shrink-0 text-sm font-semibold text-primary hover:text-primary/80">
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <Button className="w-full" onClick={() => window.open(state.link, "_blank")}>
          <ExternalLink className="mr-2 h-4 w-4" />
          Open in {serviceName}
        </Button>
        <Button variant="outline" className="w-full" onClick={handleStartOver}>
          Start Over
        </Button>
      </div>
    </div>
  );
}
