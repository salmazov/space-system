(ns dashboard.world)

(defn used-cargo [player]
  (reduce + 0 (vals (or (:cargo player) {}))))

(defn active-client-id-set [world]
  (set (concat (or (:activeClientIds world) [])
               (keep :clientId (or (:connectedUsers world) [])))))

(defn sos-client-id-set [world]
  (set (map :clientId (or (:sosSignals world) []))))

(defn player-for-client [world client-id]
  (some #(when (= (:ownerClientId %) client-id) %) (:players world)))

(defn observer-ships [world]
  (let [active-client-ids (active-client-id-set world)]
    (filter #(contains? active-client-ids (:ownerClientId %)) (:players world))))

(defn planet-name [world planet-id]
  (or (:name (some #(when (= (:id %) planet-id) %) (:planets world))) planet-id))

(defn is-government-ship? [player]
  (= (:shipClassId player) "government_freighter"))

(defn compare-ships [left right]
  (let [home-compare (.localeCompare (:homePlanetId left) (:homePlanetId right))]
    (if (zero? home-compare)
      (.localeCompare (:name left) (:name right))
      home-compare)))
