(ns space-system.rules
  (:require [space-system.rules.economy :as economy]
            [space-system.rules.geometry :as geometry]
            [space-system.rules.memory :as memory]
            [space-system.rules.navigation :as navigation]
            [space-system.rules.util :refer [random-between random-item]]
            [space-system.rules.world :as world]))

;; Bot strategy constants. These tune behavior only; the server still validates every action.
(def trade-qty-limit 8)
(def food-good :food)
(def fuel-good :fuel)
(def uranus-id "uranus")
(def earth-id "earth")
(def food-haul-target 18)
(def fuel-haul-limit 16)
(def rescue-share-limit 12)
(def sos-share-distance 1.8)
(def uranus-low-food-threshold 40)
(def uranus-fuel-buy-threshold 24)
(def low-fuel-ratio 0.12)

;; Keep enough fuel to avoid one-way routes and leave room for rescue actions.
(defn fuel-reserve
  ([player] (fuel-reserve nil player))
  ([cfg player] (max 8 (* (:fuelCapacity player) (memory/fuel-reserve-ratio cfg 0.28)))))

(defn fuel-ratio [player]
  (if (pos? (:fuelCapacity player)) (/ (:fuel player) (:fuelCapacity player)) 0))

(defn low-fuel? [player]
  (< (fuel-ratio player) low-fuel-ratio))

(defn sos-eligible? [player]
  (and (nil? (:locationPlanetId player)) (low-fuel? player)))

(defn urgent? [cfg]
  (> (:urgency cfg) (rand)))

(defn affordable-qty [credits price]
  (if (pos? price) (js/Math.floor (/ credits price)) 0))

(defn trade-action [kind good-id qty]
  {:action kind :item (name good-id) :qty qty})

(defn with-intent [action intent]
  (assoc action :botIntent intent))

(defn clearing-intent [action]
  (assoc action :clearIntent true))

(defn buy-qty [snapshot player store good-id limit capacity-left]
  (let [price (economy/price snapshot store good-id)]
    (min limit
         capacity-left
         (economy/stock store good-id)
         (affordable-qty (:credits player) price))))

(defn sell-qty [snapshot player store good-id carried limit]
  (let [price (economy/price snapshot store good-id)]
    (min limit carried (affordable-qty (:credits store) price))))

;; Buy just enough fuel for the immediate target, capped so bots do not drain markets in one tick.
(defn buy-fuel [snapshot player store target-level limit]
  (let [stock (economy/stock store fuel-good)
        space (max 0 (js/Math.floor (- (:fuelCapacity player) (:fuel player))))
        deficit (max 0 (js/Math.ceil (- target-level (:fuel player))))
        qty (buy-qty snapshot player store fuel-good (min limit deficit) space)]
    (when (and (pos? stock) (pos? qty)) (trade-action "buy" fuel-good qty))))

(defn route-fuel-target [player target-position]
  (min (:fuelCapacity player) (+ (navigation/fuel-needed player target-position) (fuel-reserve player))))

;; Treat Fuel as cargo only when the ship has more than its reserve.
(defn fuel-sell-action [snapshot player store]
  (let [price (economy/price snapshot store fuel-good)
        sellable (max 0 (js/Math.floor (- (:fuel player) (fuel-reserve player))))
        qty (sell-qty snapshot player store fuel-good sellable fuel-haul-limit)]
    (when (and (not= (:locationPlanetId player) uranus-id) (>= price 24) (pos? qty))
      (trade-action "sell" fuel-good qty))))

;; Uranus turns Food into Fuel, so urgent bots haul Food there before generic trading.
(defn food-for-uranus-action [snapshot player store]
  (let [space-left (- (:cargoCapacity player) (economy/cargo-used player))
        missing-food (max 0 (- food-haul-target (economy/carried player food-good)))
        qty (buy-qty snapshot player store food-good (min trade-qty-limit missing-food) space-left)]
    (when (pos? qty)
      (with-intent (trade-action "buy" food-good qty)
        {:kind "deliver" :item "food" :target uranus-id}))))

(defn sell-food-action [snapshot player store]
  (let [qty (sell-qty snapshot player store food-good (economy/carried player food-good) trade-qty-limit)]
    (when (pos? qty) (clearing-intent (trade-action "sell" food-good qty)))))

(defn uranus-low-food? [snapshot]
  (let [uranus (world/planet-by-id snapshot uranus-id)
        store (world/store-at uranus)]
    (< (economy/stock store food-good) uranus-low-food-threshold)))

(defn uranus-low-fuel? [store]
  (< (economy/stock store fuel-good) uranus-fuel-buy-threshold))

(defn local-fuel-available? [store]
  (pos? (economy/stock store fuel-good)))

;; Rescue is opportunistic: ships with spare fuel answer reachable SOS signals before trading.
(defn rescue-action [cfg snapshot player]
  (let [rescue-reserve (max 6 (* (:fuelCapacity player) 0.18))]
    (when (> (:fuel player) (+ rescue-reserve rescue-share-limit))
      (when-let [signal (first (remove #(or (memory/ignored-sos? cfg (:clientId %))
                                            (memory/helped-ship? cfg (:clientId %)))
                                       (navigation/reachable-sos cfg snapshot player)))]
        (let [distance (geometry/distance (:position player) (:position signal))]
          (if (<= distance sos-share-distance)
            (with-intent {:action "share_fuel" :targetClientId (:clientId signal) :qty (min rescue-share-limit (js/Math.ceil (:fuelNeeded signal)))}
              {:kind "rescue" :stage :sharing-fuel :targetClientId (:clientId signal)})
            (with-intent {:action "move" :target (:position signal)}
              {:kind "rescue" :stage :approaching :targetClientId (:clientId signal) :targetPosition (:position signal)})))))))

(defn best-sell-market [cfg snapshot player current-planet store good-id]
  (let [buy-price (economy/price snapshot store good-id)]
    (some->> (:planets snapshot)
             (filter #(and (not= (:id %) (:id current-planet))
                           (geometry/explored? (:exploredAreas player) (:position %) 1.4)
                           (navigation/enough-fuel? player (:position %))))
             (keep (fn [planet]
                     (when-let [target-store (world/store-at planet)]
                       (let [sell-price (or (memory/known-price cfg (:id planet) good-id)
                                            (economy/price snapshot target-store good-id))
                             profit (- sell-price buy-price)]
                         (when (pos? profit)
                           {:planet planet :price sell-price :profit profit})))))
             (sort-by :profit >)
             first
             :planet)))

(declare travel-or-refuel)

(defn follow-intent-action [snapshot player store intent]
  (let [item (some-> (:item intent) keyword)
        target-id (:target intent)
        target (world/planet-by-id snapshot target-id)
        carried (when item (economy/carried player item))]
    (when (and item target (pos? carried))
      (if (= (:locationPlanetId player) target-id)
        (let [qty (sell-qty snapshot player store item carried trade-qty-limit)]
          (when (pos? qty)
            (clearing-intent (trade-action "sell" item qty))))
        (travel-or-refuel snapshot player store target)))))

;; Prefer selling the highest local-price cargo the store can afford.
(defn choose-sell [snapshot player store]
  (some->> (:cargo player)
           (keep (fn [[good-id carried]]
                   (let [price (economy/price snapshot store good-id)
                         qty (min trade-qty-limit carried (if (pos? price) (js/Math.floor (/ (:credits store) price)) 0))]
                     (when (pos? qty) {:good-id good-id :price price :qty qty}))))
           (sort-by :price >)
           first
           (#(when % {:action "sell" :item (name (:good-id %)) :qty (:qty %)}))))

;; Buy non-fuel cargo only when there is a known profitable destination.
(defn choose-buy [cfg snapshot player planet store]
  (let [space-left (- (:cargoCapacity player) (economy/cargo-used player))]
    (when (pos? space-left)
      (let [choice (->> (:goods snapshot)
                        (keep (fn [[good-id _good]]
                                (let [price (economy/price snapshot store good-id)
                                      stock (economy/stock store good-id)
                                      affordable (if (pos? price) (js/Math.floor (/ (:credits player) price)) 0)
                                      qty (min trade-qty-limit space-left stock affordable)
                                      target (best-sell-market cfg snapshot player planet store good-id)]
                                  (when (and target (not= good-id fuel-good) (pos? qty))
                                    {:good-id good-id
                                     :target target
                                     :score (- (economy/price snapshot (world/store-at target) good-id) price)
                                     :qty qty}))))
                        (sort-by :score >)
                        first)]
        (when choice
          (with-intent {:action "buy" :item (name (:good-id choice)) :qty (:qty choice)}
            {:kind "trade" :item (name (:good-id choice)) :target (:id (:target choice))}))))))

(defn jitter [position amount]
  {:x (+ (:x position) (random-between (- amount) amount))
   :y 0
   :z (+ (:z position) (random-between (- amount) amount))})

(defn planet-route-key [planet]
  (str "planet:" (:id planet)))

(defn position-route-key [position]
  (str "pos:" (.toFixed (:x position) 1) ":" (.toFixed (:z position) 1)))

(defn planet-fuel-available? [cfg planet]
  (pos? (or (some-> (world/store-at planet) (economy/stock fuel-good))
            (memory/known-stock cfg (:id planet) fuel-good)
            0)))

(defn score-route [cfg player route]
  (let [target (:target route)
        route-key (:key route)
        distance (geometry/distance (:position player) target)
        fuel-needed (navigation/fuel-needed player target)
        fuel-after (- (:fuel player) fuel-needed)
        reserve (fuel-reserve cfg player)
        target-fuel (and (:planet route) (planet-fuel-available? cfg (:planet route)))
        mission-target (= route-key (some->> (memory/mission cfg) :targetPlanetId (str "planet:")))
        risk (memory/risk-tolerance cfg)
        distance-penalty (+ 0.42 (* 0.26 (- 1 risk)))]
    (when (navigation/enough-fuel? player target)
      (-> (:base-score route)
          (- (* distance distance-penalty))
          (+ (if target-fuel 18 0))
          (+ (if (memory/successful-route? cfg route-key) 8 0))
          (+ (if mission-target 16 0))
          (+ (if (>= fuel-after reserve) 12 -42))
          (- (if (memory/failed-route? cfg route-key) 55 0))
          (- (if (memory/dead-end? cfg route-key) 22 0))
          (+ (* (rand) 3))))))

(defn scored-route [cfg player route]
  (when-let [score (score-route cfg player route)]
    (assoc route :score score)))

(defn best-route [cfg player routes]
  (some->> routes
           (keep #(scored-route cfg player %))
           (sort-by :score >)
           first))

;; Explore toward Uranus first; after that, reveal unknown planets and nearby space.
(defn exploration-candidates [cfg snapshot player]
  (let [{:keys [min-x max-x min-z max-z]} (geometry/world-bounds (:planets snapshot))
        unexplored-planets (for [planet (:planets snapshot)
                                 :when (not (geometry/explored? (:exploredAreas player) (:position planet) 1.4))]
                             (let [target (jitter (:position planet) 0.45)]
                               {:base-score (if (= (:id planet) uranus-id) 86 64)
                                :goal :explore-planet
                                :key (planet-route-key planet)
                                :planet nil
                                :target target}))
        frontier-points (for [_ (range 5)
                              :let [target {:x (random-between (- min-x 5) (+ max-x 5))
                                             :y 0
                                             :z (random-between (- min-z 5) (+ max-z 5))}]]
                          {:base-score 28
                           :goal :explore-frontier
                           :key (position-route-key target)
                           :planet nil
                           :target target})
        remembered-frontiers (for [{:keys [key target]} (memory/frontier-targets cfg)
                                   :when (and target (not (memory/failed-route? cfg key)))]
                               {:base-score 36
                                :goal :remembered-frontier
                                :key key
                                :planet nil
                                :target target})]
    (concat unexplored-planets remembered-frontiers frontier-points)))

(defn exploration-target [cfg snapshot player]
  (if-let [route (best-route cfg player (exploration-candidates cfg snapshot player))]
    (:target route)
    (jitter (:position player) 1.8)))

;; Find a known non-Uranus market where Fuel can be sold well.
(defn best-fuel-market [cfg snapshot player]
  (some->> (:planets snapshot)
           (filter #(and (not= (:id %) (:locationPlanetId player))
                         (not= (:id %) uranus-id)
                         (geometry/explored? (:exploredAreas player) (:position %) 1.4)
                         (navigation/enough-fuel? player (:position %))))
           (keep (fn [planet]
                   (when-let [store (world/store-at planet)]
                     (let [price (economy/price snapshot store fuel-good)
                           route {:base-score (+ 42 price)
                                  :goal :sell-fuel
                                  :key (planet-route-key planet)
                                  :planet planet
                                  :target (:position planet)}]
                       (when-let [scored (scored-route cfg player route)]
                         (assoc scored :price price))))))
           (sort-by :score >)
           first
           :planet))

;; Travel only to explored planets that are reachable with current fuel and still leave sane options.
(defn choose-travel-target [cfg snapshot player]
  (some->> (:planets snapshot)
           (filter #(and (not= (:id %) (:locationPlanetId player))
                         (geometry/explored? (:exploredAreas player) (:position %) 1.4)))
           (map (fn [planet]
                  {:base-score (if (= (:id planet) uranus-id) 64 46)
                   :goal :travel
                   :key (planet-route-key planet)
                   :planet planet
                   :target (:position planet)}))
           (best-route cfg player)
           :planet))

;; If the target route is short on fuel, buy first; otherwise submit travel.
(defn travel-or-refuel [snapshot player store planet]
  (let [target-level (route-fuel-target player (:position planet))]
    (if (< (:fuel player) target-level)
      (buy-fuel snapshot player store target-level trade-qty-limit)
      {:action "travel" :target (:id planet)})))

(defn travel-earth-or-explore [cfg snapshot player store earth]
  (if (and earth (geometry/explored? (:exploredAreas player) (:position earth) 1.4))
    (or (travel-or-refuel snapshot player store earth)
        {:action "wait"})
    {:action "move" :target (exploration-target cfg snapshot player)}))

(defn open-space-action [cfg snapshot player]
  (if (sos-eligible? player)
    {:action "sos"}
    {:action "move" :target (exploration-target cfg snapshot player)}))

;; Main priority tree: safety and supply-chain needs beat profit, profit beats exploration.
(defn choose-action [cfg snapshot player]
  (let [planet (world/current-planet snapshot player)
        store (world/store-at planet)
        uranus (world/planet-by-id snapshot uranus-id)
        uranus-explored (and uranus (geometry/explored? (:exploredAreas player) (:position uranus) 1.8))
        urgent-food (and (urgent? cfg) (uranus-low-food? snapshot))
        earth (world/planet-by-id snapshot earth-id)
        at-earth (= (:id planet) earth-id)
        at-uranus (= (:id planet) uranus-id)
        carrying-food (pos? (economy/carried player food-good))
        rescue (rescue-action cfg snapshot player)
        sell (when store (choose-sell snapshot player store))
        intent (memory/current-intent cfg)
        intent-action (when (and store intent) (follow-intent-action snapshot player store intent))
        buy (when store (choose-buy cfg snapshot player planet store))
        sell-fuel (when store (fuel-sell-action snapshot player store))
        fuel-market (best-fuel-market cfg snapshot player)
        travel (choose-travel-target cfg snapshot player)]
    (cond
      ;; Help stranded ships before normal commerce.
      rescue rescue

      ;; A ship in open space can only call for help or keep exploring.
      (nil? store) (open-space-action cfg snapshot player)

      ;; Fuel safety is the hard stop. Without local fuel, ask for rescue.
      (and (low-fuel? player) (not (local-fuel-available? store))) {:action "wait"}
      (< (:fuel player) (fuel-reserve player)) (or (buy-fuel snapshot player store (fuel-reserve player) trade-qty-limit)
                                                   {:action "wait"})

      ;; Keep Uranus supplied with Food so it can keep producing Fuel.
      (and at-uranus carrying-food) (or (sell-food-action snapshot player store)
                                        {:action "wait"})
      intent-action intent-action
      (and urgent-food at-earth uranus (not carrying-food)) (or (food-for-uranus-action snapshot player store)
                                                                {:action "move" :target (exploration-target cfg snapshot player)})
      (and urgent-food at-earth uranus carrying-food (not uranus-explored)) (or (buy-fuel snapshot player store (route-fuel-target player (:position uranus)) trade-qty-limit)
                                                                                {:action "move" :target (exploration-target cfg snapshot player)})
      (and urgent-food carrying-food uranus uranus-explored (not at-uranus)) (or (travel-or-refuel snapshot player store uranus)
                                                                                {:action "move" :target (exploration-target cfg snapshot player)})
      (and urgent-food (not carrying-food) (not at-earth)) (travel-earth-or-explore cfg snapshot player store earth)

      ;; After supply-chain duties, trade Fuel and cargo for local profit.
      sell-fuel sell-fuel
      (and at-uranus (< (:fuel player) (- (:fuelCapacity player) 1)) (not (uranus-low-fuel? store))) (or (buy-fuel snapshot player store (:fuelCapacity player) fuel-haul-limit)
                                                                                                         (when fuel-market {:action "travel" :target (:id fuel-market)})
                                                                                                         {:action "wait"})
      (and fuel-market (> (:fuel player) (* (:fuelCapacity player) 0.65))) (or (travel-or-refuel snapshot player store fuel-market)
                                                                               {:action "move" :target (exploration-target cfg snapshot player)})
      (and sell (or (> (economy/cargo-used player) (* (:cargoCapacity player) 0.5)) (< (rand) 0.55))) sell
      (and buy (< (rand) 0.62)) buy
      (and travel (< (rand) 0.55)) {:action "travel" :target (:id travel)}

      ;; Last resort keeps the map opening even when no trade is attractive.
      :else {:action "move" :target (exploration-target cfg snapshot player)})))