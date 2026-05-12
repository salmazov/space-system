(ns space-system.rules.memory)

(defn memory [cfg]
  (or (:memory cfg) {}))

(defn mission [cfg]
  (get-in (memory cfg) [:mission]))

(defn current-intent [cfg]
  (or (:intent cfg) (get-in (memory cfg) [:mission :intent])))

(defn risk-tolerance [cfg]
  (or (get-in (memory cfg) [:strategy :riskTolerance]) 0.5))

(defn fuel-reserve-ratio [cfg fallback]
  (or (get-in (memory cfg) [:strategy :fuelReserveRatio]) fallback))

(defn failed-route? [cfg route-key]
  (contains? (get-in (memory cfg) [:navigation :failedRoutes] {}) route-key))

(defn successful-route? [cfg route-key]
  (contains? (get-in (memory cfg) [:navigation :successfulRoutes] {}) route-key))

(defn dead-end? [cfg route-key]
  (contains? (get-in (memory cfg) [:explorationMemory :deadEnds] {}) route-key))

(defn frontier-targets [cfg]
  (or (get-in (memory cfg) [:navigation :frontierTargets]) []))

(defn known-price [cfg planet-id good-id]
  (get-in (memory cfg) [:marketMemory :prices planet-id good-id]))

(defn known-stock [cfg planet-id good-id]
  (get-in (memory cfg) [:marketMemory :stocks planet-id good-id]))

(defn interesting-planet? [cfg planet-id]
  (contains? (get-in (memory cfg) [:explorationMemory :interestingPlanets] #{}) planet-id))

(defn ignored-sos? [cfg client-id]
  (contains? (get-in (memory cfg) [:rescueMemory :ignoredSos] {}) client-id))

(defn helped-ship? [cfg client-id]
  (contains? (get-in (memory cfg) [:rescueMemory :helpedShips] {}) client-id))