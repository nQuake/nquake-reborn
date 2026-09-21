// A minimal ZIP writer, which is all a `.pk3` is.
//
// This exists because a browser on Windows cannot create a `.cfg` file at all
// (see `paths.ts`), but it can create a `.pk3` — and ezQuake reads configs out
// of a pk3 exactly as it reads them off disk: `Cmd_Exec_f` goes through
// `FS_LoadHeapFile` and the VFS, which searches every pack in the search path.
// So the configs a browser is forbidden to write loose get packed into one
// archive instead, and the install needs no repair step.
//
// Entries are **stored**, never deflated. ezQuake links minizip, whose
// `unzOpenCurrentFile` accepts `compression_method` 0 as readily as
// `Z_DEFLATED`, and configs are a rounding error next to the map pack — a
// compressor would be a lot of code to save a few hundred kilobytes.
//
// The output is deterministic: entries keep the order given and every
// timestamp is the same fixed DOS date, so re-running an install produces
// byte-identical bytes and the size check in `canReuse` can skip it.

export interface ArchiveEntry {
  /** Path inside the archive, forward slashes, relative to the game dir. */
  path: string;
  bytes: Uint8Array;
}

/** 1980-01-01 00:00, the zero of DOS time — keeps the output reproducible. */
const DOS_TIME = 0;
const DOS_DATE = 0x0021;

const LOCAL_HEADER = 0x04034b50;
const CENTRAL_HEADER = 0x02014b50;
const END_OF_CENTRAL_DIR = 0x06054b50;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/** Pack `entries` into a ZIP archive — what ezQuake will read as a `.pk3`. */
export function buildPk3(entries: ArchiveEntry[]): Uint8Array {
  const enc = new TextEncoder();
  const named = entries.map((e) => ({
    ...e,
    name: enc.encode(e.path),
    crc: crc32(e.bytes),
  }));

  const localSize = named.reduce(
    (n, e) => n + 30 + e.name.length + e.bytes.length,
    0,
  );
  const centralSize = named.reduce((n, e) => n + 46 + e.name.length, 0);
  const out = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(out.buffer);
  let at = 0;

  const u16 = (v: number) => {
    view.setUint16(at, v, true);
    at += 2;
  };
  const u32 = (v: number) => {
    view.setUint32(at, v, true);
    at += 4;
  };
  const raw = (b: Uint8Array) => {
    out.set(b, at);
    at += b.length;
  };

  const offsets: number[] = [];
  for (const e of named) {
    offsets.push(at);
    u32(LOCAL_HEADER);
    u16(20); // version needed
    u16(0); // flags
    u16(0); // method: stored
    u16(DOS_TIME);
    u16(DOS_DATE);
    u32(e.crc);
    u32(e.bytes.length); // compressed size == uncompressed, stored
    u32(e.bytes.length);
    u16(e.name.length);
    u16(0); // extra length
    raw(e.name);
    raw(e.bytes);
  }

  const centralStart = at;
  named.forEach((e, i) => {
    u32(CENTRAL_HEADER);
    u16(20); // version made by
    u16(20); // version needed
    u16(0); // flags
    u16(0); // method: stored
    u16(DOS_TIME);
    u16(DOS_DATE);
    u32(e.crc);
    u32(e.bytes.length);
    u32(e.bytes.length);
    u16(e.name.length);
    u16(0); // extra
    u16(0); // comment
    u16(0); // disk number
    u16(0); // internal attributes
    u32(0); // external attributes
    u32(offsets[i]!);
    raw(e.name);
  });

  // Capture the end before writing the record: `at` is read when the
  // expression runs, by which point the header below has already moved it.
  const centralEnd = at;
  u32(END_OF_CENTRAL_DIR);
  u16(0); // this disk
  u16(0); // disk with the central directory
  u16(named.length);
  u16(named.length);
  u32(centralEnd - centralStart);
  u32(centralStart);
  u16(0); // comment length

  return out;
}
