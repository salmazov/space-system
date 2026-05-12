(ns bot-trader.memory-test
  (:require [bot-trader.memory :as memory]
            [cljs.test :refer [deftest is testing]]))

(def cfg {:clientId "bot-a"})

(defn pos [x z]
  {:x x :y 0 :z z})

(defn planet [id position prices inventory]
  {:id id
   :position position
   :stores [{:id (str id "-store")
             :inventory inventory
             :prices prices}]})

(defn player
  ([] (player (pos 0 0)))
  ([position]
   {:clientId "bot-a"
    :ownerClientId "bot-a"
    :position position
    :locationPlanetId "earth"
    :destinationPosition nil
    :fuel 30
    :fuelCapacity 60
    :fuelBurnPerUnit 1
    :exploredAreas [{:center (pos 0 0) :radius 2 :visitedAtTick 1}]}))

(defn snapshot [tick]
  {:tick tick
   :goods {:food {:basePrice 10}
           :fuel {:basePrice 20}}
   :pendingActions []
   :sosSignals []
   :planets [(planet "earth" (pos 0 0) {:food 9 :fuel 18} {:food 40 :fuel 20})
             (planet "mars" (pos 12 0) {:food 20 :fuel 32} {:food 8 :fuel 4})]})

(deftest initial-state-has-structured-domains
  (is (= #{:mission :navigation :marketMemory :explorationMemory :rescueMemory :strategy}
         (set (keys memory/initial-state))))
  (is (= {} (get-in memory/initial-state [:navigation :failedRoutes])))
  (is (= [] (get-in memory/initial-state [:navigation :frontierTargets]))))

(deftest refresh-remembers-visible-market-data
  (let [state (memory/refresh cfg (snapshot 5) (player) memory/initial-state)]
    (is (= {:food 9 :fuel 18} (get-in state [:marketMemory :prices "earth"])))
    (is (= {:food 40 :fuel 20} (get-in state [:marketMemory :stocks "earth"])))
    (is (= 5 (get-in state [:marketMemory :lastSeenTick "earth"])))
    (is (contains? (get-in state [:explorationMemory :interestingPlanets]) "earth"))
    (is (nil? (get-in state [:marketMemory :prices "mars"])))))

(deftest accepted-route-submission-stores-planned-route-and-frontier
  (let [action {:action "move" :target (pos 3 4)}
        result {:accepted true :queuedForTick 11}
        state (memory/remember-submit-result cfg (snapshot 10) (player) action result memory/initial-state)
        route-key (memory/position-route-key (:target action))]
    (is (= route-key (get-in state [:navigation :plannedRoute :key])))
    (is (= 11 (get-in state [:navigation :plannedRoute :queuedForTick])))
    (is (= route-key (get-in state [:explorationMemory :lastFrontier :key])))
    (is (= [route-key] (mapv :key (get-in state [:navigation :frontierTargets]))))))

(deftest accepted-intent-submission-updates-mission
  (let [action {:action "buy"
                :item "food"
                :qty 6
                :botIntent {:kind "deliver" :item "food" :target "uranus"}}
        state (memory/remember-submit-result cfg (snapshot 12) (player) action {:accepted true :queuedForTick 13} memory/initial-state)]
    (is (= "deliver" (get-in state [:mission :kind])))
    (is (= "uranus" (get-in state [:mission :targetPlanetId])))
    (is (= {:item "food" :qty 6} (get-in state [:mission :cargoPlan])))
    (is (= (:botIntent action) (get-in state [:mission :intent])))))

(deftest route-failure-is-detected-after-queued-tick
  (let [action {:action "move" :target (pos 4 0)}
        route-key (memory/position-route-key (:target action))
        planned-state (memory/remember-submit-result cfg (snapshot 20) (player) action {:accepted true :queuedForTick 21} memory/initial-state)
        refreshed (memory/refresh cfg (snapshot 21) (player) planned-state)]
    (is (= 21 (get-in refreshed [:navigation :failedRoutes route-key])))
    (is (= 21 (get-in refreshed [:explorationMemory :deadEnds route-key])))
  (is (nil? (get-in refreshed [:navigation :plannedRoute])))
  (is (= 0.43 (get-in refreshed [:strategy :riskTolerance])))
  (is (= :failed-route (get-in refreshed [:strategy :lastRiskChange :reason])))))

(deftest route-success-is-detected-when-ship-starts-moving
  (let [action {:action "travel" :target "mars"}
        planned-state (memory/remember-submit-result cfg (snapshot 30) (player) action {:accepted true :queuedForTick 31} memory/initial-state)
        moving-player (assoc (player) :destinationPosition (pos 12 0))
        refreshed (memory/refresh cfg (snapshot 31) moving-player planned-state)]
    (is (= 31 (get-in refreshed [:navigation :successfulRoutes "planet:mars"])))
      (is (nil? (get-in refreshed [:navigation :plannedRoute])))
      (is (= 0.54 (get-in refreshed [:strategy :riskTolerance])))
      (is (= :successful-long-route (get-in refreshed [:strategy :lastRiskChange :reason])))))

(deftest rejected-actions-are-remembered-as-cooldowns
  (testing "route rejections penalize route keys"
    (let [action {:action "travel" :target "mars"}
          state (memory/remember-submit-result cfg (snapshot 40) (player) action {:accepted false :reason "no fuel"} memory/initial-state)]
      (is (= 40 (get-in state [:navigation :failedRoutes "planet:mars"])))
      (is (= 0.45 (get-in state [:strategy :riskTolerance])))
      (is (= :rejected-action (get-in state [:strategy :lastRiskChange :reason])))))
  (testing "fuel share rejections cool down rescue target"
    (let [action {:action "share_fuel" :targetClientId "bot-b" :qty 4}
          state (memory/remember-submit-result cfg (snapshot 42) (player) action {:accepted false :reason "too far"} memory/initial-state)]
      (is (= 42 (get-in state [:rescueMemory :ignoredSos "bot-b"]))))))

(deftest sos-submission-lowers-risk
  (let [state (memory/remember-submit-result cfg (snapshot 44) (assoc (player) :locationPlanetId nil) {:action "sos"} {:accepted true :queuedForTick 45} memory/initial-state)]
    (is (= 0.42 (get-in state [:strategy :riskTolerance])))
    (is (= :sos-call (get-in state [:strategy :lastRiskChange :reason])))))

(deftest profitable-delivery-raises-risk
  (let [mars-player (assoc (player (pos 12 0)) :locationPlanetId "mars" :cargo {:food 8})
        action {:action "sell" :item "food" :qty 8 :clearIntent true}
        state (memory/remember-submit-result cfg (snapshot 46) mars-player action {:accepted true :queuedForTick 47} memory/initial-state)]
    (is (= 0.54 (get-in state [:strategy :riskTolerance])))
    (is (= :profitable-delivery (get-in state [:strategy :lastRiskChange :reason])))))

(deftest fuel-margin-adjusts-risk-over-time
  (testing "low fuel lowers risk immediately"
    (let [low-fuel-player (assoc (player) :fuel 5)
          state (memory/refresh cfg (snapshot 60) low-fuel-player memory/initial-state)]
      (is (= 0.47 (get-in state [:strategy :riskTolerance])))
      (is (= 1 (get-in state [:strategy :lowFuelStreak])))
      (is (= :low-fuel (get-in state [:strategy :lastRiskChange :reason])))))
  (testing "repeated safe fuel margins raise risk"
    (let [safe-player (assoc (player) :fuel 45)
          state (->> memory/initial-state
                     (memory/refresh cfg (snapshot 61) safe-player)
                     (memory/refresh cfg (snapshot 62) safe-player)
                     (memory/refresh cfg (snapshot 63) safe-player))]
      (is (= 0.52 (get-in state [:strategy :riskTolerance])))
      (is (= 3 (get-in state [:strategy :safeFuelStreak])))
      (is (= :safe-fuel-margin (get-in state [:strategy :lastRiskChange :reason]))))))

(deftest rescue-completion-clears-active-rescue-and-records-helped-ship
  (let [state (assoc-in memory/initial-state [:rescueMemory :activeRescue] {:targetClientId "bot-b" :queuedForTick 50 :tick 49})
        refreshed (memory/refresh cfg (snapshot 50) (player) state)]
    (is (nil? (get-in refreshed [:rescueMemory :activeRescue])))
    (is (= 50 (get-in refreshed [:rescueMemory :helpedShips "bot-b"]))))
  (let [state (assoc-in memory/initial-state [:rescueMemory :activeRescue] {:targetClientId "bot-b" :queuedForTick 50 :tick 49})
        snapshot-with-signal (assoc (snapshot 50) :sosSignals [{:clientId "bot-b" :position (pos 1 0) :radius 7.5}])
        refreshed (memory/refresh cfg snapshot-with-signal (player) state)]
    (is (= "bot-b" (get-in refreshed [:rescueMemory :activeRescue :targetClientId])))
    (is (nil? (get-in refreshed [:rescueMemory :helpedShips "bot-b"])))))

(deftest cfg-with-memory-exposes-current-intent
  (let [intent {:kind "trade" :target "mars"}]
    (reset! memory/state (assoc-in memory/initial-state [:mission :intent] intent))
    (is (= intent (:intent (memory/cfg-with-memory cfg))))
    (is (= intent (get-in (memory/cfg-with-memory cfg) [:memory :mission :intent])))
    (reset! memory/state memory/initial-state)))