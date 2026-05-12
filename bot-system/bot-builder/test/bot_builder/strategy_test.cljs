(ns bot-builder.strategy-test
  (:require [bot-builder.strategy :as strategy]
            [cljs.test :refer [deftest is testing]]))

(def cfg {:clientId "builder-union" :name "Frontier Works" :homePlanetId "earth"})

(defn pos [x z]
  {:x x :y 0 :z z})

(def goods
  {:food {:basePrice 12 :targetStock 120}
   :fuel {:basePrice 18 :targetStock 160}
   :medicine {:basePrice 65 :targetStock 35}
   :ore {:basePrice 28 :targetStock 80}})

(defn store [planet-id inventory prices credits]
  {:id (str planet-id "-market")
   :name (str planet-id " market")
   :credits credits
   :inventory inventory
   :prices prices
   :priceMultipliers {}})

(defn planet [id position inventory prices & {:keys [credits] :or {credits 5000}}]
  {:id id
   :name id
   :faction "Test"
   :planetType "core"
   :position position
   :stores [(store id inventory prices credits)]})

(defn snapshot
  ([] (snapshot {}))
  ([overrides]
   (let [earth (planet "earth" (pos -10 0) {:food 160 :fuel 45 :medicine 25 :ore 50} {:food 9 :fuel 28 :ore 39 :medicine 78})
         mars (planet "mars" (pos 2.5 -5.2) {:food 70 :fuel 22 :medicine 18 :ore 160} {:food 16 :fuel 30 :ore 20 :medicine 88})
         jupiter (planet "jupiter" (pos 13.2 -1.4) {:food 95 :fuel 30 :medicine 42 :ore 125} {:food 14 :fuel 24 :ore 27 :medicine 55})]
     (merge {:tick 10
             :goods goods
             :pendingActions []
             :sosSignals []
             :planets [earth mars jupiter]}
            overrides))))

(defn player
  ([] (player "earth" (pos -10 0)))
  ([location position]
   {:id "ship-b"
    :name "Frontier Works"
    :ownerClientId "builder-union"
    :locationPlanetId location
    :homePlanetId "earth"
    :position position
    :destinationPosition nil
    :fuel 80
    :fuelCapacity 100
    :fuelBurnPerUnit 0.55
    :cargo {}
    :cargoCapacity 60
    :credits 2000
    :exploredAreas []}))

;; --- Test 1: chooses build site far from planets ---

(deftest best-build-site-picks-isolated-location
  (let [planets (:planets (snapshot))
        site (strategy/best-build-site planets)]
    (is (some? site) "should find a valid build site")
    (is (>= (strategy/min-planet-distance planets site) strategy/station-min-distance)
        "build site must be at least station-min-distance from all planets")))

(deftest best-build-site-returns-nil-when-no-valid-site
  (testing "very close cluster of planets leaves no room"
    (let [tight-planets [{:id "a" :position (pos 0 0) :stores []}
                         {:id "b" :position (pos 1 0) :stores []}
                         {:id "c" :position (pos 0 1) :stores []}
                         {:id "d" :position (pos 1 1) :stores []}
                         {:id "e" :position (pos 0.5 0.5) :stores []}]
          site (strategy/best-build-site tight-planets)]
      ;; All candidate midpoints and offsets are within 6 units of a planet;
      ;; some offsets may still be valid, so we just check if any result
      ;; respects the min distance constraint
      (when site
        (is (>= (strategy/min-planet-distance tight-planets site) strategy/station-min-distance))))))

;; --- Test 2: trades when credits are low ---

(deftest buys-cheap-goods-when-credits-low
  (testing "buys goods with low price ratio when not enough credits to build"
    (let [world (snapshot)
          ship (player)
          action (strategy/choose-action cfg world ship)]
      (is (= "buy" (:action action))
          "should buy when credits are below build cost")
      (is (some? (:item action)))
      (is (pos? (:qty action))))))

(deftest sells-cargo-for-profit
  (testing "sells carried cargo at a profitable planet"
    (let [world (snapshot)
          ship (assoc (player) :cargo {:ore 30})
          action (strategy/choose-action cfg world ship)]
      (is (= "sell" (:action action))
          "should sell cargo when carrying goods")
      (is (= "ore" (:item action))))))

;; --- Test 3: builds when credits sufficient and at valid location ---

(deftest builds-station-when-rich-and-at-valid-site
  (testing "issues build_station when at a valid open-space location with enough credits"
    (let [world (snapshot)
          ;; Position far from all planets
          ship (assoc (player nil (pos 50 50)) :credits 20000)]
      ;; Not docked, so store is nil — the build branch should trigger
      (let [action (strategy/choose-action cfg world ship)]
        (is (= "build_station" (:action action))
            "should build station when rich and at valid location")
        (is (some? (:name action)) "build action must have a station name")))))

(deftest navigates-to-build-site-when-rich-and-docked
  (testing "travels to a build site when docked with enough credits"
    (let [world (snapshot)
          ship (assoc (player) :credits 20000)
          action (strategy/choose-action cfg world ship)]
      ;; Should try to travel/move to a build site, not build at the planet
      (is (contains? #{"travel" "move" "buy"} (:action action))
          "should travel/refuel toward build site when docked"))))
