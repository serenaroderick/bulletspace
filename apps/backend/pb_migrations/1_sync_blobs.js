/// <reference path="../pb_data/types.d.ts" />

/**
 * The one collection Phase 5 sync actually needs: encrypted blobs, keyed
 * per journal per owner. PocketBase's built-in "users" auth collection
 * (id _pb_users_auth_) covers accounts -- nothing custom needed there.
 * The server only ever sees `encryptedPayload` (our client-side
 * encryptWithPassword() output: salt/iv/ciphertext, all opaque without
 * the user's password) -- this is the "stateless, can't read your data"
 * guarantee from PITCH.md, enforced by what the schema even stores.
 */
migrate(
  (app) => {
    const collection = new Collection({
      name: "sync_blobs",
      type: "base",
      fields: [
        {
          name: "journalId",
          type: "text",
          required: true,
        },
        {
          name: "owner",
          type: "relation",
          required: true,
          collectionId: "_pb_users_auth_",
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: "encryptedPayload",
          type: "json",
          required: true,
        },
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_sync_blobs_owner_journal ON sync_blobs (owner, journalId)",
      ],
      // Rules default to null (superuser-only) if unset -- these let an
      // authenticated user read/write only their own rows, nothing else.
      listRule: "owner = @request.auth.id",
      viewRule: "owner = @request.auth.id",
      createRule: "owner = @request.auth.id",
      updateRule: "owner = @request.auth.id",
      deleteRule: "owner = @request.auth.id",
    });

    return app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId("sync_blobs");
    return app.delete(collection);
  },
);
