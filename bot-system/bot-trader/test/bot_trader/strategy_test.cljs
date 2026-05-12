(ns bot-trader.strategy-test
  (:require [cljs.test :refer [deftest is testing]]
            [space-system.rules :as rules]))

(def cfg {:clientId "bot-a" :urgency 1.0})

(defn pos [x z]
  {:x x :y 0 :z z})

(def goods
  {:food {:basePrice 12}
   :fuel {:basePrice 18}
   :medicine {:basePrice 65}
   :ore {:basePrice 28}})

(defn store [planet-id inventory prices]
  {:id (str planet-id "-market")
   :name (str planet-id " market")
   :credits 5000
   :inventory inventory
   :prices prices})

(defn planet [id position inventory prices]
  {:id id
   :name id
   :faction "Test"
   :position position
   :stores [(store id inventory prices)]})

(defn snapshot []
  {:tick 10
   :goods goods
   :pendingActions []
   :sosSignals []
   :planets [(planet "earth" (pos -10 0) {:food 120 :fuel 80 :ore 20 :medicine 10} {:food 9 :fuel 24 :ore 36 :medicine 78})
             (planet "mars" (pos 2.5 -5.2) {:food 20 :fuel 30 :ore 90 :medicine 10} {:food 20 :fuel 30 :ore 18 :medicine 70})
             (planet "uranus" (pos 39 -6.2) {:food 20 :fuel 220 :ore 20 :medicine 4} {:food 26 :fuel 8 :ore 30 :medicine 117})]})

(defn explored-area [position]
  {:center position :radius 4 :visitedAtTick 1})

(defn player
  ([] (player (pos -10 0)))
  ([position]
   {:id "ship-a"
    :name "Bot A"
    :ownerClientId "bot-a"
    :locationPlanetId "earth"
    :homePlanetId "earth"
    :position position
    :destinationPosition nil
    :fuel 50
    :fuelCapacity 60
    :fuelBurnPerUnit 0.42
    :cargo {}
    :cargoCapacity 40
    :credits 600
    :exploredAreas [(explored-area (pos -10 0))
                    (explored-area (pos 2.5 -5.2))
                    (explored-area (pos 39 -6.2))]}))

(deftest stranded-open-space-broadcasts-sos
  (let [ship (assoc (player (pos 0 0)) :locationPlanetId nil :fuel 4)
        action (rules/choose-action cfg (snapshot) ship)]
    (is (= {:action "sos"} action))))

(deftest reachable-rescue-beats-normal-commerce
  (let [world (assoc (snapshot) :sosSignals [{:clientId "bot-b"
                                              :shipName "Bot B"
                                              :position (pos -9.2 0)
                                              :radius 7.5
                                              :fuelNeeded 6}])
        action (rules/choose-action cfg world (player))]
    (is (= "share_fuel" (:action action)))
    (is (= "bot-b" (:targetClientId action)))
    (is (= "rescue" (get-in action [:botIntent :kind])))))

(deftest urgent-earth-bot-buys-food-for-uranus
  (let [ship (assoc (player) :cargo {})
        action (rules/choose-action cfg (snapshot) ship)]
    (is (= "buy" (:action action)))
    (is (= "food" (:item action)))
    (is (= "deliver" (get-in action [:botIntent :kind])))
    (is (= "uranus" (get-in action [:botIntent :target])))))

(deftest cargo-heavy-ship-sells-before-buying-more
  (let [world (assoc-in (snapshot) [:planets 1 :stores 0 :prices :fuel] 18)
        ship (assoc (player (pos 2.5 -5.2))
                    :locationPlanetId "mars"
                    :fuel 30
                    :cargo {:food 24})
        action (rules/choose-action (assoc cfg :urgency 0) world ship)]
    (is (= "sell" (:action action)))
    (is (= "food" (:item action)))
    (is (pos? (:qty action)))))

(deftest quiet-market-falls-back-to-exploration
  (testing "when no trade, rescue, or travel branch wins, the bot still opens map space"
    (let [world (assoc (snapshot) :planets [(planet "earth" (pos -10 0) {:food 0 :fuel 0 :ore 0 :medicine 0} {:food 12 :fuel 18 :ore 28 :medicine 65})])
          ship (assoc (player) :fuel 40 :cargo {} :exploredAreas [(explored-area (pos -10 0))])
          action (rules/choose-action (assoc cfg :urgency 0) world ship)]
      (is (= "move" (:action action)))
      (is (map? (:target action))))))