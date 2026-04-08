/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_74142682")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX idx_t8_id ON t8 (`id`)"
    ]
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_74142682")

  // update collection data
  unmarshal({
    "indexes": []
  }, collection)

  return app.save(collection)
})
