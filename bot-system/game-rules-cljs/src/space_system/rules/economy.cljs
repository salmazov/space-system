(ns space-system.rules.economy)

(defn cargo-used [player]
  (reduce + 0 (vals (:cargo player))))

(defn carried [player good-id]
  (or (get-in player [:cargo good-id]) 0))

(defn price [snapshot store good-id]
  (or (get-in store [:prices good-id]) (get-in snapshot [:goods good-id :basePrice]) 0))

(defn stock [store good-id]
  (or (get-in store [:inventory good-id]) 0))