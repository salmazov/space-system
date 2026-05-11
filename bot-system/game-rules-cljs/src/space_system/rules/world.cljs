(ns space-system.rules.world)

(defn cargo-used [player]
  (reduce + 0 (vals (:cargo player))))

(defn carried [player good-id]
  (or (get-in player [:cargo good-id]) 0))

(defn planet-by-id [snapshot planet-id]
  (some #(when (= (:id %) planet-id) %) (:planets snapshot)))

(defn current-planet [snapshot player]
  (planet-by-id snapshot (:locationPlanetId player)))

(defn store-at [planet]
  (first (:stores planet)))

(defn price [snapshot store good-id]
  (or (get-in store [:prices good-id]) (get-in snapshot [:goods good-id :basePrice]) 0))

(defn stock [store good-id]
  (or (get-in store [:inventory good-id]) 0))

(defn distance [from to]
  (js/Math.hypot (- (:x from) (:x to)) (- (:z from) (:z to))))

(defn fuel-needed [player target-position]
  (* (distance (:position player) target-position) (:fuelBurnPerUnit player)))

(defn enough-fuel? [player target-position]
  (>= (:fuel player) (* 1.08 (fuel-needed player target-position))))

(defn sos-signals [snapshot]
  (or (:sosSignals snapshot) []))

(defn reachable-sos [cfg snapshot player]
  (->> (sos-signals snapshot)
       (remove #(= (:clientId %) (:clientId cfg)))
       (filter #(enough-fuel? player (:position %)))
       (sort-by #(distance (:position player) (:position %)))))

(defn explored? [areas position extra-radius]
  (boolean
    (some (fn [area]
            (<= (js/Math.hypot (- (get-in area [:center :x]) (:x position))
                                (- (get-in area [:center :z]) (:z position)))
                (+ (:radius area) extra-radius)))
          areas)))

(defn world-bounds [planets]
  (reduce (fn [bounds planet]
            (let [{:keys [x z]} (:position planet)]
              (-> bounds
                  (update :min-x min x)
                  (update :max-x max x)
                  (update :min-z min z)
                  (update :max-z max z))))
          {:min-x -10 :max-x 10 :min-z -8 :max-z 8}
          planets))
