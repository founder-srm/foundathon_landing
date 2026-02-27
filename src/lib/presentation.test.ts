import { describe, expect, it } from "vitest";
import { isPresentationFileSignatureAllowed } from "@/lib/presentation";

const createFile = (bytes: number[], name: string, type: string) =>
  new File([Uint8Array.from(bytes).buffer], name, { type });

describe("isPresentationFileSignatureAllowed", () => {
  it("accepts valid .ppt signatures", async () => {
    const file = createFile(
      [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00],
      "team-deck.ppt",
      "application/vnd.ms-powerpoint",
    );

    await expect(isPresentationFileSignatureAllowed(file)).resolves.toBe(true);
  });

  it("accepts valid .pptx zip signatures", async () => {
    const file = createFile(
      [0x50, 0x4b, 0x03, 0x04, 0x14, 0x00],
      "team-deck.pptx",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    );

    await expect(isPresentationFileSignatureAllowed(file)).resolves.toBe(true);
  });

  it("rejects extension/signature mismatches", async () => {
    const file = createFile(
      [0x50, 0x4b, 0x03, 0x04, 0x14, 0x00],
      "team-deck.ppt",
      "application/vnd.ms-powerpoint",
    );

    await expect(isPresentationFileSignatureAllowed(file)).resolves.toBe(false);
  });
});
