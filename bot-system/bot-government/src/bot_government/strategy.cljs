(ns bot-government.strategy)

(def earth-id "earth")
(def saturn-id "saturn")
(def uranus-id "uranus")
(def food-good :food)
(def fuel-good :fuel)
(def bulk-food-qty 80)
(def bulk-fuel-qty 160)
(def refuel-qty-limit 80)
(def low-fuel-ratio 0.12)
(def saturn-stock-low-ratio 0.7)
(def home-fuel-low-ratio 0.55)
(def uranus-fuel-reserve 180)

(defn cargo-used [player]
  (reduce + (vals (:cargo player))))

(defn carried [player good-id]
  (or (get-in player [:cargo good-id]) 0))

(defn stock [store good-id]
  (or (get-in store [:inventory good-id]) 0))

(defn price [snapshot store good-id]
  (or (get-in store [:prices good-id])
      (get-in snapshot [:goods good-id :basePrice])
      0))

(defn planet-by-id [snapshot planet-id]
  (some #(when (= (:id %) planet-id) %) (:planets snapshot)))

(defn current-planet [snapshot player]
  (planet-by-id snapshot (:locationPlanetId player)))

(defn store-at [planet]
  (first (:stores planet)))

(defn market-stock [snapshot planet-id good-id]
  (or (some-> (planet-by-id snapshot planet-id) store-at (stock good-id)) 0))

(defn target-stock [snapshot good-id fallback]
  (or (get-in snapshot [:goods good-id :targetStock]) fallback))

(defn stock-below? [snapshot planet-id good-id ratio]
  (< (market-stock snapshot planet-id good-id) (* (target-stock snapshot good-id 100) ratio)))

(defn affordable-qty [credits unit-price]
  (if (pos? unit-price) (js/Math.floor (/ credits unit-price)) 0))

(defn trade-action [kind good-id qty intent]
  (cond-> {:action kind :item (name good-id) :qty qty}
    intent (assoc :governmentIntent intent)))

(defn travel-action [planet-id intent]
  (cond-> {:action "travel" :target planet-id}
    intent (assoc :governmentIntent intent)))

(defn wait-action [intent]
  (cond-> {:action "wait"}
    intent (assoc :governmentIntent intent)))

(defn distance [a b]
  (let [dx (- (:x a) (:x b))
        dz (- (:z a) (:z b))]
    (js/Math.sqrt (+ (* dx dx) (* dz dz)))))

(defn fuel-needed [player target-position]
  (* (distance (:position player) target-position) (:fuelBurnPerUnit player)))

(defn fuel-ratio [player]
  (if (pos? (:fuelCapacity player)) (/ (:fuel player) (:fuelCapacity player)) 0))

(defn low-fuel? [player]
  (< (fuel-ratio player) low-fuel-ratio))

(defn fuel-reserve [player]
  (max 40 (* (:fuelCapacity player) 0.28)))

(defn route-fuel-target [player target-position]
  (min (:fuelCapacity player) (+ (fuel-needed player target-position) (fuel-reserve player))))

(defn buy-qty [snapshot player store good-id limit capacity-left]
  (let [unit-price (price snapshot store good-id)]
    (min limit
         capacity-left
         (stock store good-id)
         (affordable-qty (:credits player) unit-price))))

(defn buy-cargo [snapshot player store good-id qty intent]
  (let [capacity-left (max 0 (- (:cargoCapacity player) (cargo-used player)))
        actual-qty (buy-qty snapshot player store good-id qty capacity-left)]
    (when (pos? actual-qty)
      (trade-action "buy" good-id actual-qty intent))))

(defn sell-cargo [snapshot player store good-id qty intent]
  (let [unit-price (price snapshot store good-id)
        store-affordable (affordable-qty (:credits store) unit-price)
        actual-qty (min qty (carried player good-id) store-affordable)]
    (when (pos? actual-qty)
      (trade-action "sell" good-id actual-qty intent))))

(defn buy-fuel-up-to [snapshot player store target-level limit intent]
  (let [space (max 0 (js/Math.floor (- (:fuelCapacity player) (:fuel player))))
        deficit (max 0 (js/Math.ceil (- target-level (:fuel player))))
        actual-qty (buy-qty snapshot player store fuel-good (min limit deficit) space)]
    (when (pos? actual-qty)
      (trade-action "buy" fuel-good actual-qty intent))))

(defn buy-uranus-fuel-up-to [snapshot player store target-level intent]
  (let [surplus (max 0 (- (stock store fuel-good) uranus-fuel-reserve))
        space (max 0 (js/Math.floor (- (:fuelCapacity player) (:fuel player))))
        deficit (max 0 (js/Math.ceil (- target-level (:fuel player))))
        unit-price (price snapshot store fuel-good)
        actual-qty (min bulk-fuel-qty surplus space deficit (affordable-qty (:credits player) unit-price))]
    (when (pos? actual-qty)
      (trade-action "buy" fuel-good actual-qty intent))))

(defn sell-fuel [snapshot player store qty intent]
  (let [unit-price (price snapshot store fuel-good)
        store-affordable (affordable-qty (:credits store) unit-price)
        sellable (max 0 (js/Math.floor (- (:fuel player) (fuel-reserve player))))
        actual-qty (min qty sellable store-affordable)]
    (when (pos? actual-qty)
      (trade-action "sell" fuel-good actual-qty intent))))

(defn travel-or-refuel [snapshot player store planet intent]
  (let [target-level (route-fuel-target player (:position planet))]
    (if (< (:fuel player) target-level)
      (or (buy-fuel-up-to snapshot player store target-level refuel-qty-limit (assoc intent :stage "refuel"))
          (wait-action (assoc intent :stage "blocked-refuel")))
      (travel-action (:id planet) intent))))

(defn food-target [snapshot]
  (cond
    (stock-below? snapshot uranus-id food-good 1.0) uranus-id
    (stock-below? snapshot saturn-id food-good saturn-stock-low-ratio) saturn-id
    :else nil))

(defn fuel-target [cfg snapshot]
  (cond
    (stock-below? snapshot saturn-id fuel-good saturn-stock-low-ratio) saturn-id
    (stock-below? snapshot (:homePlanetId cfg) fuel-good home-fuel-low-ratio) (:homePlanetId cfg)
    :else (:homePlanetId cfg)))

(defn food-deficit [snapshot planet-id]
  (max 0 (- (target-stock snapshot food-good 120) (market-stock snapshot planet-id food-good))))

(defn fuel-deficit [snapshot planet-id]
  (max 0 (- (target-stock snapshot fuel-good 160) (market-stock snapshot planet-id fuel-good))))

(defn choose-action [cfg snapshot player]
  (let [planet (current-planet snapshot player)
        store (store-at planet)
        home (planet-by-id snapshot (:homePlanetId cfg))
        uranus (planet-by-id snapshot uranus-id)
        food-target-id (food-target snapshot)
        food-target-planet (planet-by-id snapshot food-target-id)
        fuel-target-id (fuel-target cfg snapshot)
        fuel-target-planet (planet-by-id snapshot fuel-target-id)
        carrying-food (pos? (carried player food-good))
        at-food-target (= (:locationPlanetId player) food-target-id)
        at-fuel-target (= (:locationPlanetId player) fuel-target-id)
        at-home (= (:locationPlanetId player) (:homePlanetId cfg))
        at-uranus (= (:locationPlanetId player) uranus-id)
        at-saturn (= (:locationPlanetId player) saturn-id)]
    (cond
      (nil? store) (if (low-fuel? player)
                     {:action "sos" :governmentIntent {:kind "emergency" :stage "open-space-low-fuel"}}
                     (wait-action {:kind "logistics" :stage "undocked"}))

      (and carrying-food at-food-target food-target-id)
      (or (sell-cargo snapshot player store food-good (food-deficit snapshot food-target-id) {:kind "deliver-food" :target food-target-id})
          (wait-action {:kind "deliver-food" :target food-target-id :stage "target-full"}))

      (and carrying-food food-target-planet)
      (travel-or-refuel snapshot player store food-target-planet {:kind "deliver-food" :target food-target-id})

      (and at-saturn (stock-below? snapshot saturn-id fuel-good saturn-stock-low-ratio))
      (or (sell-fuel snapshot player store (fuel-deficit snapshot saturn-id) {:kind "deliver-fuel" :target saturn-id})
          (wait-action {:kind "deliver-fuel" :target saturn-id :stage "no-surplus"}))

      (and at-fuel-target (not at-uranus) (stock-below? snapshot fuel-target-id fuel-good home-fuel-low-ratio))
      (or (sell-fuel snapshot player store (fuel-deficit snapshot fuel-target-id) {:kind "deliver-fuel" :target fuel-target-id})
          (wait-action {:kind "deliver-fuel" :target fuel-target-id :stage "no-surplus"}))

      (and at-uranus fuel-target-planet (> (stock store fuel-good) uranus-fuel-reserve))
      (let [haul-level (min (:fuelCapacity player) (+ (route-fuel-target player (:position fuel-target-planet)) bulk-fuel-qty))]
        (if (< (:fuel player) haul-level)
          (or (buy-uranus-fuel-up-to snapshot player store haul-level {:kind "haul-fuel" :target fuel-target-id})
              (travel-or-refuel snapshot player store fuel-target-planet {:kind "haul-fuel" :target fuel-target-id}))
          (travel-or-refuel snapshot player store fuel-target-planet {:kind "haul-fuel" :target fuel-target-id})))

      food-target-id
      (if at-home
        (or (buy-cargo snapshot player store food-good (min bulk-food-qty (food-deficit snapshot food-target-id)) {:kind "deliver-food" :target food-target-id})
            (wait-action {:kind "deliver-food" :target food-target-id :stage "no-source-stock"}))
        (travel-or-refuel snapshot player store home {:kind "source-food" :target (:homePlanetId cfg)}))

      (and fuel-target-planet (not at-uranus))
      (travel-or-refuel snapshot player store uranus {:kind "source-fuel" :target uranus-id})

      (and home (not at-home))
      (travel-or-refuel snapshot player store home {:kind "return-home" :target (:homePlanetId cfg)})

      :else (wait-action {:kind "logistics" :stage "no-need"}))))
