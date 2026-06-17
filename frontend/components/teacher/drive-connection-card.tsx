"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HardDrive, CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import { driveService, type DriveStatus } from "@/lib/drive-service";
import { pickDriveFolder, pickerConfigured } from "@/lib/google-picker";
import { cleanError } from "@/lib/api-client";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useNotify } from "@/components/ui/notify-dialog";

export function DriveConnectionCard() {
  const confirm = useConfirm();
  const notify = useNotify();
  const [status, setStatus] = useState<DriveStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(await driveService.status());
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Show a result popup after returning from the Google consent screen, then
  // strip the ?drive= flag from the URL so it doesn't fire again.
  useEffect(() => {
    const flag = new URLSearchParams(window.location.search).get("drive");
    if (flag === "connected") {
      notify({ variant: "success", description: "Google Drive connected." });
    } else if (flag === "error") {
      notify({ variant: "error", description: "Couldn't connect Google Drive. Please try again." });
    }
    if (flag) {
      const url = new URL(window.location.href);
      url.searchParams.delete("drive");
      window.history.replaceState({}, "", url.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = async () => {
    setBusy(true);
    try {
      await driveService.connect(); // navigates away to Google
    } catch (e) {
      await notify({ variant: "error", description: cleanError(e, "Couldn't start Google sign-in.") });
      setBusy(false);
    }
  };

  const chooseFolder = async () => {
    setBusy(true);
    try {
      const folderId = await pickDriveFolder(status?.email || undefined);
      if (!folderId) return; // cancelled
      await driveService.setRootFolder(folderId);
      await load();
      await notify({ variant: "success", description: "Submissions will now be saved to your chosen folder." });
    } catch (e) {
      await notify({ variant: "error", description: cleanError(e, "Couldn't open the folder picker.") });
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    const ok = await confirm({
      title: "Disconnect Google Drive?",
      description:
        "New submissions won't be stored until you reconnect. Files already in your Drive stay there.",
      confirmText: "Disconnect",
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await driveService.disconnect();
      await load();
      await notify({ variant: "success", description: "Google Drive disconnected." });
    } catch (e) {
      await notify({ variant: "error", description: cleanError(e, "Couldn't disconnect.") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="h-5 w-5" /> Google Drive
        </CardTitle>
        <CardDescription>
          Student file submissions are saved into your Google Drive — a folder per
          class and per student, just like Google Classroom.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Checking connection…</p>
        ) : status && !status.configured ? (
          <p className="text-sm text-muted-foreground">
            Google Drive isn&apos;t configured on the server yet. Ask your admin to
            set it up.
          </p>
        ) : status?.connected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span>
                Connected{status.email ? ` as ${status.email}` : ""}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {status.folder_link && (
                <Button variant="outline" size="sm" asChild>
                  <a href={status.folder_link} target="_blank" rel="noreferrer">
                    Open folder <ExternalLink className="ml-1 h-3.5 w-3.5" />
                  </a>
                </Button>
              )}
              {pickerConfigured() && (
                <Button variant="outline" size="sm" onClick={chooseFolder} disabled={busy}>
                  Choose existing folder
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={disconnect} disabled={busy}>
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <Button onClick={connect} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <HardDrive className="mr-2 h-4 w-4" />}
            Connect Google Drive
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
