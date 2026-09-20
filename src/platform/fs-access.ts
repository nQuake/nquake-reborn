// The browser's File System Access API as a `Destination`. Chromium desktop
// only; `capabilities.ts` decides whether this is even offered.

import {
  splitPath,
  type Destination,
  type DestinationEntry,
} from "./destination.ts";

export async function pickFsAccessDestination(): Promise<FsAccessDestination | null> {
  try {
    const handle = await window.showDirectoryPicker({
      mode: "readwrite",
      id: "nquake-install",
      startIn: "documents",
    });
    return new FsAccessDestination(handle);
  } catch (e) {
    // The user dismissed the picker.
    if (e instanceof DOMException && e.name === "AbortError") return null;
    throw e;
  }
}

export class FsAccessDestination implements Destination {
  readonly kind = "fs-access";
  readonly canSetExecutable = false;

  constructor(private root: FileSystemDirectoryHandle) {}

  get name(): string {
    return this.root.name;
  }

  /** Create (or reuse) a subfolder and return it as its own destination. */
  async subfolder(name: string): Promise<FsAccessDestination> {
    const handle = await this.root.getDirectoryHandle(name, { create: true });
    return new FsAccessDestination(handle);
  }

  private async dir(
    dirs: string[],
    create: boolean,
  ): Promise<FileSystemDirectoryHandle | null> {
    let cur = this.root;
    for (const d of dirs) {
      try {
        cur = await cur.getDirectoryHandle(d, { create });
      } catch {
        return null;
      }
    }
    return cur;
  }

  private async fileHandle(
    path: string,
    create: boolean,
  ): Promise<FileSystemFileHandle | null> {
    const { dirs, name } = splitPath(path);
    const dir = await this.dir(dirs, create);
    if (!dir) return null;
    try {
      return await dir.getFileHandle(name, { create });
    } catch {
      return null;
    }
  }

  async stat(path: string): Promise<{ size: number } | null> {
    const h = await this.fileHandle(path, false);
    if (!h) return null;
    const f = await h.getFile();
    return { size: f.size };
  }

  async readText(path: string): Promise<string | null> {
    const h = await this.fileHandle(path, false);
    if (!h) return null;
    return (await h.getFile()).text();
  }

  async list(path = ""): Promise<DestinationEntry[]> {
    const dir = path
      ? await this.dir(path.split("/").filter(Boolean), false)
      : this.root;
    if (!dir) return [];
    const out: DestinationEntry[] = [];
    for await (const [name, handle] of dir.entries()) {
      out.push({ name, kind: handle.kind });
    }
    return out;
  }

  async openWrite(path: string): Promise<WritableStream<Uint8Array>> {
    const h = await this.fileHandle(path, true);
    if (!h) throw new Error(`Cannot create ${path}`);
    return h.createWritable({ keepExistingData: false });
  }

  async writeText(path: string, text: string): Promise<void> {
    const w = await this.openWrite(path);
    const writer = w.getWriter();
    await writer.write(new TextEncoder().encode(text));
    await writer.close();
  }

  async rename(path: string, newName: string): Promise<void> {
    const h = await this.fileHandle(path, false);
    if (!h) return;
    // `move` is Chromium-only and not in the typings yet; fall back to copy.
    const movable = h as FileSystemFileHandle & {
      move?: (name: string) => Promise<void>;
    };
    if (typeof movable.move === "function") {
      await movable.move(newName);
      return;
    }
    const { dirs } = splitPath(path);
    const data = await (await h.getFile()).arrayBuffer();
    const w = await this.openWrite([...dirs, newName].join("/"));
    const writer = w.getWriter();
    await writer.write(new Uint8Array(data));
    await writer.close();
    const dir = await this.dir(dirs, false);
    await dir?.removeEntry(splitPath(path).name);
  }

  async setExecutable(): Promise<void> {
    // Browsers cannot set file modes; the start script / readme cover it.
  }
}
