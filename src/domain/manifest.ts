// The distfiles manifest: what nQuake/distfiles' `scripts/build-manifest.mjs`
// writes to `manifest.json`. Every distribution file, grouped by the package
// directory it lives in, with its size and sha256. The installer never
// touches a zip — it reads this and fetches files one by one.

export interface ManifestFile {
  /** Path relative to the package directory, forward slashes. */
  path: string;
  size: number;
  sha256: string;
}

export interface ManifestPackage {
  bytes: number;
  files: ManifestFile[];
}

export interface Manifest {
  schema: 1;
  generated: string;
  /** Commit the files were hashed at; files are fetched at this ref. */
  commit: string | null;
  packages: Record<string, ManifestPackage>;
}

/** Validate an untrusted JSON value as a manifest, throwing on shape errors. */
export function parseManifest(value: unknown): Manifest {
  if (!value || typeof value !== "object") {
    throw new Error("manifest: not an object");
  }
  const v = value as Record<string, unknown>;
  if (v.schema !== 1)
    throw new Error(`manifest: unsupported schema ${v.schema}`);
  if (!v.packages || typeof v.packages !== "object") {
    throw new Error("manifest: missing packages");
  }
  const packages: Record<string, ManifestPackage> = {};
  for (const [name, pkg] of Object.entries(
    v.packages as Record<string, unknown>,
  )) {
    const p = pkg as { bytes?: unknown; files?: unknown };
    if (!Array.isArray(p.files)) {
      throw new Error(`manifest: package ${name} has no files`);
    }
    const files: ManifestFile[] = p.files.map((f: unknown) => {
      const file = f as Record<string, unknown>;
      if (typeof file.path !== "string" || typeof file.size !== "number") {
        throw new Error(`manifest: bad file entry in ${name}`);
      }
      return {
        path: file.path,
        size: file.size,
        sha256: typeof file.sha256 === "string" ? file.sha256 : "",
      };
    });
    packages[name] = {
      bytes:
        typeof p.bytes === "number"
          ? p.bytes
          : files.reduce((n, f) => n + f.size, 0),
      files,
    };
  }
  return {
    schema: 1,
    generated: typeof v.generated === "string" ? v.generated : "",
    commit: typeof v.commit === "string" ? v.commit : null,
    packages,
  };
}

/** Total bytes of a package, 0 when the manifest doesn't carry it. */
export function packageBytes(manifest: Manifest, name: string): number {
  return manifest.packages[name]?.bytes ?? 0;
}
