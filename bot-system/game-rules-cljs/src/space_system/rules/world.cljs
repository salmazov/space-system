(ns space-system.rules.world)

(defn planet-by-id [snapshot planet-id]
  (some #(when (= (:id %) planet-id) %) (:planets snapshot)))

(defn current-planet [snapshot player]
  (planet-by-id snapshot (:locationPlanetId player)))

(defn store-at [planet]
  (first (:stores planet)))
