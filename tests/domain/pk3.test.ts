import { describe, expect, it } from "vitest";

import { buildPk3, crc32 } from "../../src/domain/pk3.ts";

const enc = new TextEncoder();

/** Byte offset of the end-of-central-directory record. */
function eocdAt(zip: Uint8Array): number {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  for (let i = zip.length - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50) return i;
  }
  throw new Error("no end-of-central-directory record");
}

describe("buildPk3", () => {
  const entries = [
    { path: "autoexec.cfg", bytes: enc.encode("exec configs/config.cfg\n") },
    { path: "configs/preset.cfg", bytes: enc.encode('name "empezar"\n') },
  ];

  it("writes a zip a stock reader can walk", () => {
    const zip = buildPk3(entries);
    const view = new DataView(zip.buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50); // first local header

    const eocd = eocdAt(zip);
    expect(view.getUint16(eocd + 10, true)).toBe(2); // entry count
    const size = view.getUint32(eocd + 12, true);
    const start = view.getUint32(eocd + 16, true);
    // The size and offset have to agree, or a reader that uses the size to
    // detect prepended data seeks into the middle of the last entry.
    expect(start + size).toBe(eocd);
    expect(view.getUint32(start, true)).toBe(0x02014b50); // central header
  });

  it("stores entries uncompressed, which is all ezQuake's minizip needs", () => {
    const zip = buildPk3(entries);
    const view = new DataView(zip.buffer);
    expect(view.getUint16(8, true)).toBe(0); // method on the local header
    // Stored means the payload is in there verbatim.
    expect(new TextDecoder().decode(zip)).toContain('name "empezar"');
    // ...and compressed size equals uncompressed size.
    expect(view.getUint32(18, true)).toBe(view.getUint32(22, true));
  });

  it("records a correct CRC for every entry", () => {
    // The check value from the zip spec's own test vector.
    expect(crc32(enc.encode("123456789"))).toBe(0xcbf43926);
    const zip = buildPk3(entries);
    const view = new DataView(zip.buffer);
    expect(view.getUint32(14, true)).toBe(crc32(entries[0]!.bytes));
  });

  it("is reproducible, so a re-install writes identical bytes", () => {
    expect(buildPk3(entries)).toEqual(buildPk3(entries));
  });

  it("handles an empty archive without producing garbage", () => {
    const zip = buildPk3([]);
    expect(zip.length).toBe(22);
    expect(new DataView(zip.buffer).getUint32(0, true)).toBe(0x06054b50);
  });
});
