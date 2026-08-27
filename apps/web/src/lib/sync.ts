import { type EncryptedPayload, decryptWithPassword, encryptWithPassword } from "@bulletspace/core";
import type { Entry, Journal } from "@bulletspace/core";
import { parseJournalExport, serializeJournalExport } from "./importExport";
import { pb } from "./pocketbase";

interface SyncBlobRecord {
  id: string;
  journalId: string;
  owner: string;
  encryptedPayload: EncryptedPayload;
}

function requireOwnerId(): string {
  const id = pb.authStore.record?.id;
  if (!id) throw new Error("Not signed in.");
  return id;
}

export async function pushJournal(journal: Journal, entries: Entry[], passphrase: string): Promise<void> {
  const owner = requireOwnerId();
  const plaintext = JSON.stringify(serializeJournalExport(journal, entries));
  const encryptedPayload = await encryptWithPassword(plaintext, passphrase);

  const existing = await pb
    .collection("sync_blobs")
    .getFirstListItem<SyncBlobRecord>(pb.filter("owner = {:owner} && journalId = {:journalId}", { owner, journalId: journal.id }))
    .catch(() => null);

  if (existing) {
    await pb.collection("sync_blobs").update(existing.id, { encryptedPayload });
  } else {
    await pb.collection("sync_blobs").create({ journalId: journal.id, owner, encryptedPayload });
  }
}

export interface PulledJournal {
  journal: Journal;
  entries: Entry[];
}

/**
 * Looks up any synced journal for the signed-in account, not one matching
 * a specific local journalId -- each device generates its own random
 * journal id on first run (see ensureDefaultJournal), so a fresh device
 * pulling for the first time has no local id to match yet. The caller
 * remaps the pulled entries onto its own local journal id, same as the
 * existing JSON import merge does for a manually imported export file.
 */
export async function pullJournal(passphrase: string): Promise<PulledJournal | null> {
  const owner = requireOwnerId();
  const record = await pb
    .collection("sync_blobs")
    .getFirstListItem<SyncBlobRecord>(pb.filter("owner = {:owner}", { owner }), { sort: "-updated" })
    .catch(() => null);
  if (!record) return null;

  const plaintext = await decryptWithPassword(record.encryptedPayload, passphrase);
  const parsed = parseJournalExport(plaintext);
  return { journal: parsed.journal, entries: parsed.entries };
}
