(ns bot-player.world)

(defn planet-by-id [snapshot planet-id]
  (some #(when (= (:id %) planet-id) %) (:planets snapshot)))

(defn current-planet [snapshot player]
  (planet-by-id snapshot (:locationPlanetId player)))

(defn store-at [planet]
  (first (:stores planet)))

(defn pending? [cfg world]
  (some #(= (get-in % [:action :clientId]) (:clientId cfg)) (:pendingActions world)))

(defn player-for [cfg world]
  (some #(when (= (:ownerClientId %) (:clientId cfg)) %) (:players world)))