// The Tauri desktop app's folder access as a `Destination`. Everything here
// goes through Tauri's official dialog / fs plugins, configured in
// `tauri/src-tauri/capabilities/`; the one custom command is
// `set_executable`, because a webview cannot chmod and a downloaded AppImage
// or `mvdsv` is useless without the bit. The plugins are imported lazily so
// the web bundle never carries them.

import {
  splitPath,
  type Destination,
  type DestinationEntry,
} from "./destination.ts";

type FsModule = typeof import("@tauri-apps/plugin-fs");

async function fs(): Promise<FsModule> {
  return import("@tauri-apps/plugin-fs");
}

function joinPath(root: string, path: string): string {
  const sep = root.includes("\\") ? "\\" : "/";
  const rel = path.split("/").filter(Boolean).join(sep);
  return rel ? `${root.replace(/[\\/]+$/, "")}${sep}${rel}` : root;
}

/**
 * `$HOME/nquake` — where nQuake has always gone, and what the folder step
 * offers so the desktop app can be Next, Next, Next. Nothing is created
 * here: the directory appears when the install first writes into it, so
 * picking a different folder afterwards leaves no empty one behind.
 */
export async function defaultTauriPath(): Promise<string> {
  const { homeDir, join } = await import("@tauri-apps/api/path");
  return join(await homeDir(), "nquake");
}

export async function defaultTauriDestination(): Promise<TauriDestination> {
  return new TauriDestination(await defaultTauriPath());
}

async function homeDirOrNothing(): Promise<string | undefined> {
  try {
    const { homeDir } = await import("@tauri-apps/api/path");
    return await homeDir();
  } catch {
    return undefined;
  }
}

export async function pickTauriDestination(): Promise<TauriDestination | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const picked = await open({
    directory: true,
    multiple: false,
    title: "Choose where to install nQuake",
    // Open where the default lives, not wherever the OS last left the dialog.
    defaultPath: await homeDirOrNothing(),
  });
  if (!picked || Array.isArray(picked)) return null;
  return new TauriDestination(picked);
}

export async function revealInFileManager(
  dest: TauriDestination,
): Promise<void> {
  const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
  await revealItemInDir(dest.root);
}

export class TauriDestination implements Destination {
  readonly kind = "tauri";
  readonly canSetExecutable = true;
  readonly nameRules = "none" as const;

  constructor(readonly root: string) {}

  /** The desktop app knows where the folder is, so the wizard can show it. */
  get path(): string {
    return this.root;
  }

  get name(): string {
    const parts = this.root.split(/[\\/]+/).filter(Boolean);
    return parts[parts.length - 1] ?? this.root;
  }

  async subfolder(name: string): Promise<TauriDestination> {
    const { mkdir } = await fs();
    const path = joinPath(this.root, name);
    await mkdir(path, { recursive: true });
    return new TauriDestination(path);
  }

  async stat(path: string): Promise<{ size: number } | null> {
    const { stat } = await fs();
    try {
      const s = await stat(joinPath(this.root, path));
      return s.isFile ? { size: s.size } : null;
    } catch {
      return null;
    }
  }

  async readText(path: string): Promise<string | null> {
    const { readTextFile } = await fs();
    try {
      return await readTextFile(joinPath(this.root, path));
    } catch {
      return null;
    }
  }

  async list(path = ""): Promise<DestinationEntry[]> {
    const { readDir } = await fs();
    try {
      const entries = await readDir(joinPath(this.root, path));
      return entries.map((e) => ({
        name: e.name,
        kind: e.isDirectory ? "directory" : "file",
      }));
    } catch {
      return [];
    }
  }

  async openWrite(path: string): Promise<WritableStream<Uint8Array>> {
    const { mkdir, open } = await fs();
    const { dirs } = splitPath(path);
    // Always `recursive`, including for the root itself: the folder step can
    // hand us a path that does not exist yet (the `~/nquake` default), and a
    // file at the top level has no parent of its own to create.
    await mkdir(dirs.length ? joinPath(this.root, dirs.join("/")) : this.root, {
      recursive: true,
    });
    const file = await open(joinPath(this.root, path), {
      write: true,
      create: true,
      truncate: true,
    });
    return new WritableStream<Uint8Array>({
      async write(chunk) {
        // The fs plugin writes the whole chunk; loop defensively anyway.
        let off = 0;
        while (off < chunk.byteLength) {
          const n = await file.write(chunk.subarray(off));
          if (n <= 0) throw new Error(`short write to ${path}`);
          off += n;
        }
      },
      async close() {
        await file.close();
      },
      async abort() {
        await file.close();
      },
    });
  }

  async writeText(path: string, text: string): Promise<void> {
    const { mkdir, writeTextFile } = await fs();
    const { dirs } = splitPath(path);
    if (dirs.length) {
      await mkdir(joinPath(this.root, dirs.join("/")), { recursive: true });
    }
    await writeTextFile(joinPath(this.root, path), text);
  }

  async rename(path: string, newName: string): Promise<void> {
    const { rename } = await fs();
    const { dirs } = splitPath(path);
    try {
      await rename(
        joinPath(this.root, path),
        joinPath(this.root, [...dirs, newName].join("/")),
      );
    } catch {
      // Nothing to back up.
    }
  }

  async setExecutable(paths: string[]): Promise<void> {
    if (paths.length === 0) return;
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("set_executable", {
      paths: paths.map((p) => joinPath(this.root, p)),
    });
  }
}
