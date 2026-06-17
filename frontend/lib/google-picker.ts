/**
 * Google Drive folder Picker.
 *
 * Lets a teacher choose an existing Drive folder to use as their LearningQuest
 * root. With the `drive.file` scope, picking a folder is also what *grants* our
 * app (same OAuth client) access to it — a pasted link can't do that. Returns
 * the chosen folder id, which the caller saves via POST /drive/root-folder.
 */
const SCOPE = "https://www.googleapis.com/auth/drive.file";
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_PICKER_API_KEY || "";

// `window.google` is already declared elsewhere (Google Sign-In); read both
// globals loosely to avoid clashing global augmentations.
const w = (): any => window as any;

export function pickerConfigured(): boolean {
  return !!(CLIENT_ID && API_KEY);
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

let _pickerLoaded = false;
function loadPickerModule(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (_pickerLoaded) return resolve();
    w().gapi.load("picker", {
      callback: () => {
        _pickerLoaded = true;
        resolve();
      },
      onerror: () => reject(new Error("Could not load the Google Picker.")),
    });
  });
}

function getAccessToken(loginHint?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = w().google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      ...(loginHint ? { hint: loginHint } : {}),
      callback: (resp: any) => {
        if (resp?.error) reject(new Error(resp.error));
        else resolve(resp.access_token);
      },
      error_callback: (err: any) =>
        reject(new Error(err?.message || "Authorization was cancelled.")),
    });
    client.requestAccessToken({ prompt: "" });
  });
}

/** Open the folder picker; resolves with the chosen folder id, or null if the
 * teacher cancels. */
export async function pickDriveFolder(loginHint?: string): Promise<string | null> {
  if (!pickerConfigured()) {
    throw new Error("Google Picker isn't configured (missing API key).");
  }
  await Promise.all([
    loadScript("https://accounts.google.com/gsi/client"),
    loadScript("https://apis.google.com/js/api.js"),
  ]);
  const token = await getAccessToken(loginHint);
  await loadPickerModule();

  return new Promise<string | null>((resolve) => {
    const g = w().google;
    const view = new g.picker.DocsView(g.picker.ViewId.FOLDERS)
      .setSelectFolderEnabled(true)
      .setIncludeFolders(true);
    const picker = new g.picker.PickerBuilder()
      .setOAuthToken(token)
      .setDeveloperKey(API_KEY)
      .addView(view)
      .setTitle("Choose a folder for student submissions")
      .setCallback((data: any) => {
        if (data.action === g.picker.Action.PICKED) {
          resolve(data.docs?.[0]?.id ?? null);
        } else if (data.action === g.picker.Action.CANCEL) {
          resolve(null);
        }
      })
      .build();
    picker.setVisible(true);
  });
}
