/// <reference path="../pb_data/types.d.ts" />

/**
 * sync_blobs was created without created/updated autodate fields --
 * PocketBase only adds those automatically to its own built-in
 * collections (e.g. users), not to custom ones defined via migration.
 * Needed so pullJournal can sort by -updated to find the most recently
 * pushed blob once an account has more than one.
 */
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("sync_blobs");
    collection.fields.add(
      new Field({
        type: "autodate",
        name: "created",
        onCreate: true,
        onUpdate: false,
      }),
    );
    collection.fields.add(
      new Field({
        type: "autodate",
        name: "updated",
        onCreate: true,
        onUpdate: true,
      }),
    );
    return app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId("sync_blobs");
    collection.fields.removeByName("created");
    collection.fields.removeByName("updated");
    return app.save(collection);
  },
);
