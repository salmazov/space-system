(ns bot-player.world-test
  (:require [bot-player.world :as world]
            [cljs.test :refer [deftest is]]))

(def cfg {:clientId "bot-a"})

(defn pos [x z]
  {:x x :y 0 :z z})

(def player
  {:ownerClientId "bot-a"
   :position (pos 0 0)
   :fuel 20
   :fuelBurnPerUnit 1})

(deftest reachable-sos-excludes-self-and-out-of-radius-signals
  (let [snapshot {:sosSignals [{:clientId "bot-a" :position (pos 1 0) :radius 7.5}
                               {:clientId "near" :position (pos 6 0) :radius 7.5}
                               {:clientId "far" :position (pos 8 0) :radius 7.5}]}
        visible-client-ids (mapv :clientId (world/reachable-sos cfg snapshot player))]
    (is (= ["near"] visible-client-ids))))

(deftest reachable-sos-requires-enough-fuel-to-answer
  (let [low-fuel-player (assoc player :fuel 4)
        snapshot {:sosSignals [{:clientId "near" :position (pos 6 0) :radius 7.5}]}
        visible-client-ids (mapv :clientId (world/reachable-sos cfg snapshot low-fuel-player))]
    (is (= [] visible-client-ids))))