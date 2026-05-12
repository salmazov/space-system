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

(defn is-pirate-ship? [player]
  (boolean (:isPirate player)))

(defn is-police-ship? [player]
  (= (:shipClassId player) "police_ship"))

(defn is-builder-ship? [player]
  (= (:shipClassId player) "builder_ship"))

(defn is-regular-player-ship? [player]
  (and (not (is-government-ship? player))
       (not (is-police-ship? player))
       (not (is-builder-ship? player))))

(defn compare-ships [left right]
  (let [home-compare (.localeCompare (:homePlanetId left) (:homePlanetId right))]
    (if (zero? home-compare)
      (.localeCompare (:name left) (:name right))
      home-compare)))
