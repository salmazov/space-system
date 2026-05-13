(ns bot-builder.strategy)

(def station-build-cost 15000)
(def station-min-distance 5.0)
(def low-fuel-ratio 0.15)
(def refuel-qty-limit 60)
(def sell-batch 20)
(def buy-batch 30)

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
  (max 20 (* (:fuelCapacity player) 0.2)))

(defn route-fuel-target [player target-position]
  (min (:fuelCapacity player) (+ (fuel-needed player target-position) (fuel-reserve player))))

(defn affordable-qty [credits unit-price]
  (if (pos? unit-price) (js/Math.floor (/ credits unit-price)) 0))

(defn trade-action [kind good-id qty intent]
  (cond-> {:action kind :item (name good-id) :qty qty}
    intent (assoc :builderIntent intent)))

(defn travel-action [planet-id intent]
  (cond-> {:action "travel" :target planet-id}
    intent (assoc :builderIntent intent)))

(defn wait-action [intent]
  (cond-> {:action "wait"}
    intent (assoc :builderIntent intent)))

(defn build-action [station-name intent]
  (cond-> {:action "build_station" :name station-name}
    intent (assoc :builderIntent intent)))

(defn move-action [position intent]
  (cond-> {:action "move" :target position}
    intent (assoc :builderIntent intent)))

;; --- Build site selection ---

(defn min-planet-distance [planets position]
  (if (empty? planets)
    js/Infinity
    (apply min (map #(distance position (:position %)) planets))))

(defn candidate-positions [planets]
  ;; Generate midpoints between all planet pairs and offset positions
  (let [pairs (for [a planets
                    b planets
                    :when (not= (:id a) (:id b))]
                [a b])
        midpoints (map (fn [[a b]]
                         {:x (/ (+ (:x (:position a)) (:x (:position b))) 2)
                          :y 0
                          :z (/ (+ (:z (:position a)) (:z (:position b))) 2)})
                       pairs)
        ;; Also try offset positions from each planet
        offsets (mapcat (fn [p]
                          [{:x (+ (:x (:position p)) 6) :y 0 :z (:z (:position p))}
                           {:x (- (:x (:position p)) 6) :y 0 :z (:z (:position p))}
                           {:x (:x (:position p)) :y 0 :z (+ (:z (:position p)) 6)}
                           {:x (:x (:position p)) :y 0 :z (- (:z (:position p)) 6)}])
                        planets)]
    (concat midpoints offsets)))

(defn best-build-site [planets]
  (let [candidates (candidate-positions planets)
        valid (filter #(>= (min-planet-distance planets %) station-min-distance) candidates)]
    (when (seq valid)
      ;; Pick the site with maximum distance from nearest planet (most isolated)
      (apply max-key #(min-planet-distance planets %) valid))))

;; --- Trade strategy: buy cheap, sell expensive ---

(defn best-buy-opportunity [snapshot player store]
  ;; Find the good with the lowest price ratio at current planet (excludes fuel — fuel uses the tank, not cargo hold)
  (let [goods-ids (remove #{:fuel "fuel"} (keys (:goods snapshot)))
        capacity-left (max 0 (- (:cargoCapacity player) (cargo-used player)))
        opportunities (for [good-id goods-ids
                            :let [unit-price (price snapshot store good-id)
                                  base-price (get-in snapshot [:goods good-id :basePrice] 1)
                                  ratio (/ unit-price base-price)
                                  available (stock store good-id)
                                  can-afford (affordable-qty (:credits player) unit-price)
                                  qty (min buy-batch available can-afford capacity-left)]
                            :when (and (pos? qty) (< ratio 1.1))]
                        {:good-id good-id :qty qty :ratio ratio})]

    (when (seq opportunities)
      (first (sort-by :ratio opportunities)))))

(defn best-sell-opportunity [snapshot player store]
  ;; Find carried good with highest price ratio at current planet
  (let [goods-ids (keys (:goods snapshot))
        opportunities (for [good-id goods-ids
                            :let [qty (carried player good-id)
                                  unit-price (price snapshot store good-id)
                                  base-price (get-in snapshot [:goods good-id :basePrice] 1)
                                  ratio (/ unit-price base-price)
                                  store-can-buy (affordable-qty (:credits store) unit-price)
                                  sell-qty (min sell-batch qty store-can-buy)]
                            :when (and (pos? sell-qty) (> ratio 0.9))]
                        {:good-id good-id :qty sell-qty :ratio ratio})]
    (when (seq opportunities)
      (last (sort-by :ratio opportunities)))))

(defn best-trade-planet [snapshot player]
  ;; Find the planet with best profit potential
  (let [planets (:planets snapshot)
        carrying (cargo-used player)
        sell-targets (when (pos? carrying)
                       (for [planet planets
                             :let [store (store-at planet)
                                   profit-sum (reduce + (for [good-id (keys (:cargo player))
                                                              :let [qty (carried player good-id)
                                                                    unit-price (price snapshot store good-id)]
                                                              :when (pos? qty)]
                                                          (* qty unit-price)))]
                             :when (and store (pos? profit-sum)
                                        (not= (:id planet) (:locationPlanetId player)))]
                         {:planet planet :score profit-sum}))]
    (when (seq sell-targets)
      (:planet (last (sort-by :score sell-targets))))))

(defn buy-fuel-up-to [snapshot player store target-level intent]
  (let [space (max 0 (js/Math.floor (- (:fuelCapacity player) (:fuel player))))
        deficit (max 0 (js/Math.ceil (- target-level (:fuel player))))
        unit-price (price snapshot store :fuel)
        available (stock store :fuel)
        can-afford (affordable-qty (:credits player) unit-price)
        actual-qty (min refuel-qty-limit deficit space available can-afford)]
    (when (pos? actual-qty)
      (trade-action "buy" :fuel actual-qty intent))))

(defn travel-or-refuel [snapshot player store planet intent]
  (let [target-level (route-fuel-target player (:position planet))]
    (if (< (:fuel player) target-level)
      (or (buy-fuel-up-to snapshot player store target-level (assoc intent :stage "refuel"))
          (wait-action (assoc intent :stage "blocked-refuel")))
      (if (:id planet)
        (travel-action (:id planet) intent)
        (move-action (:position planet) intent)))))

(defn station-name-for [cfg]
  (str (:name cfg) "'s Outpost"))

;; --- Main decision ---

(defn choose-action [cfg snapshot player]
  (let [planet (current-planet snapshot player)
        store (store-at planet)
        planets (:planets snapshot)
        has-enough-credits (>= (:credits player) station-build-cost)]
    (cond
      ;; Undocked and not moving - something went wrong or we need SOS
      (nil? store)
      (if (and (not (:locationPlanetId player)) (low-fuel? player))
        {:action "sos" :builderIntent {:kind "emergency" :stage "low-fuel"}}
        ;; If we're in open space with enough credits, try to build
        (if (and has-enough-credits
                 (not (:locationPlanetId player))
                 (>= (min-planet-distance planets (:position player)) station-min-distance))
          (build-action (station-name-for cfg) {:kind "build" :stage "building"})
          (wait-action {:kind "idle" :stage "undocked"})))

      ;; Have enough credits - go find a build site
      has-enough-credits
      (let [site (best-build-site planets)]
        (if site
          (travel-or-refuel snapshot player store
                            ;; Create a temporary planet-like target for refuel calc
                            {:id nil :position site}
                            {:kind "build" :stage "traveling-to-site"})
          (wait-action {:kind "build" :stage "no-valid-site"})))

      ;; Trading phase: sell cargo for profit
      (pos? (cargo-used player))
      (let [sell (best-sell-opportunity snapshot player store)]
        (if sell
          (trade-action "sell" (:good-id sell) (:qty sell)
                        {:kind "trade" :stage "selling"})
          ;; Can't sell here, go somewhere better
          (let [target (best-trade-planet snapshot player)]
            (if target
              (travel-or-refuel snapshot player store target
                                {:kind "trade" :stage "selling-travel"})
              (wait-action {:kind "trade" :stage "no-sell-target"})))))

      ;; Trading phase: buy cheap goods
      :else
      (let [buy (best-buy-opportunity snapshot player store)]
        (if buy
          (trade-action "buy" (:good-id buy) (:qty buy)
                        {:kind "trade" :stage "buying"})
          ;; Nothing to buy here, try another planet
          (let [other-planets (filter #(and (not= (:id %) (:locationPlanetId player))
                                            (some? (store-at %)))
                                      planets)]
            (if (seq other-planets)
              (let [target (rand-nth (vec other-planets))]
                (travel-or-refuel snapshot player store target
                                  {:kind "trade" :stage "shopping-travel"}))
              (wait-action {:kind "trade" :stage "no-buy-target"}))))))))
