import { describe, expect, it } from "vitest";
import { decryptWithPassword, encryptWithPassword } from "./encryption.js";

describe("encryptWithPassword / decryptWithPassword", () => {
  it("round-trips plaintext with the correct password", async () => {
    const plaintext = JSON.stringify({ hello: "world", n: 42 });
    const payload = await encryptWithPassword(plaintext, "correct horse battery staple");
    const decrypted = await decryptWithPassword(payload, "correct horse battery staple");
    expect(decrypted).toBe(plaintext);
  });

  it("fails to decrypt with the wrong password", async () => {
    const payload = await encryptWithPassword("secret data", "right-password");
    await expect(decryptWithPassword(payload, "wrong-password")).rejects.toThrow(
      "Decryption failed -- wrong password or corrupted data.",
    );
  });

  it("fails to decrypt tampered ciphertext (AES-GCM auth tag check)", async () => {
    const payload = await encryptWithPassword("secret data", "a-password");
    const tampered = { ...payload, ciphertext: `${payload.ciphertext.slice(0, -4)}abcd` };
    await expect(decryptWithPassword(tampered, "a-password")).rejects.toThrow();
  });

  it("produces different ciphertext for the same plaintext and password each time", async () => {
    const a = await encryptWithPassword("same input", "same-password");
    const b = await encryptWithPassword("same input", "same-password");
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(a.salt).not.toBe(b.salt);
    expect(a.iv).not.toBe(b.iv);
  });

  it("handles empty string plaintext", async () => {
    const payload = await encryptWithPassword("", "a-password");
    expect(await decryptWithPassword(payload, "a-password")).toBe("");
  });

  it("handles unicode plaintext correctly", async () => {
    const plaintext = "日本語 🎉 emoji test";
    const payload = await encryptWithPassword(plaintext, "a-password");
    expect(await decryptWithPassword(payload, "a-password")).toBe(plaintext);
  });
});
