(ns bot-government.strategy-test
  (:require [bot-government.strategy :as strategy]
            [cljs.test :refer [deftest is testing]]))

(def cfg {:clientId "government-earth" :homePlanetId "earth"})

(defn pos [x z]
  {:x x :y 0 :z z})

(def goods
  {:food {:basePrice 12 :targetStock 120}
   :fuel {:basePrice 18 :targetStock 160}
   :medicine {:basePrice 65 :targetStock 35}
   :ore {:basePrice 28 :targetStock 80}})

(defn store [planet-id inventory prices]
  {:id (str planet-id "-market")
   :name (str planet-id " market")
   :credits 20000
   :inventory inventory
   :prices prices})

(defn planet [id position inventory prices]
  {:id id
   :name id
   :faction "Test"
   :position position
   :stores [(store id inventory prices)]})

(defn snapshot
  ([] (snapshot {}))
  ([overrides]
   (let [earth (planet "earth" (pos -10 0) {:food 180 :fuel 120 :ore 20 :medicine 10} {:food 9 :fuel 28 :ore 36 :medicine 78})
         saturn (planet "saturn" (pos 26 5.4) {:food 120 :fuel 120 :ore 80 :medicine 70} {:food 19 :fuel 34 :ore 32 :medicine 39})
         uranus (planet "uranus" (pos 39 -6.2) {:food 120 :fuel 240 :ore 20 :medicine 4} {:food 26 :fuel 8 :ore 30 :medicine 117})]
     (merge {:tick 10
             :goods goods
             :pendingActions []
             :sosSignals []
             :planets [earth saturn uranus]}
            overrides))))

(defn with-stock [world planet-id good-id value]
  (update world :planets
          (fn [planets]
            (mapv (fn [planet]
                    (if (= (:id planet) planet-id)
                      (assoc-in planet [:stores 0 :inventory good-id] value)
                      planet))
                  planets))))

(defn player
  ([] (player "earth" (pos -10 0)))
  ([location position]
   {:id "ship-a"
    :name "Government A"
    :ownerClientId "government-earth"
    :locationPlanetId location
    :homePlanetId "earth"
    :position position
    :destinationPosition nil
    :fuel 260
    :fuelCapacity 480
    :fuelBurnPerUnit 0.92
    :cargo {}
    :cargoCapacity 420
    :credits 12000
    :exploredAreas []}))

(deftest buys-bulk-food-for-uranus-when-uranus-food-is-below-target
  (let [world (with-stock (snapshot) "uranus" :food 30)
        action (strategy/choose-action cfg world (player))]
    (is (= "buy" (:action action)))
    (is (= "food" (:item action)))
    (is (= 80 (:qty action)))
    (is (= "deliver-food" (get-in action [:governmentIntent :kind])))
    (is (= "uranus" (get-in action [:governmentIntent :target])))))

(deftest saturn-food-delivery-only-triggers-when-saturn-food-is-low
  (testing "low Saturn Food redirects the bulk food route"
    (let [world (-> (snapshot)
                    (with-stock "uranus" :food 140)
                    (with-stock "saturn" :food 20))
          action (strategy/choose-action cfg world (player))]
      (is (= "buy" (:action action)))
      (is (= "food" (:item action)))
      (is (= "saturn" (get-in action [:governmentIntent :target])))))
  (testing "healthy Saturn stock does not create a Saturn delivery"
    (let [world (-> (snapshot)
                    (with-stock "uranus" :food 140)
                    (with-stock "saturn" :food 120))
          action (strategy/choose-action cfg world (player))]
      (is (not= "saturn" (get-in action [:governmentIntent :target]))))))

(deftest sells-food-at-selected-target
  (let [world (with-stock (snapshot) "uranus" :food 40)
        ship (assoc (player "uranus" (pos 39 -6.2)) :cargo {:food 80})
        action (strategy/choose-action cfg world ship)]
    (is (= "sell" (:action action)))
    (is (= "food" (:item action)))
    (is (= 80 (:qty action)))
    (is (= "uranus" (get-in action [:governmentIntent :target])))))

(deftest hauls-uranus-fuel-only-above-reserve
  (testing "surplus Uranus Fuel can be bought for a bulk route"
    (let [world (-> (snapshot)
                    (with-stock "uranus" :food 140)
                    (with-stock "uranus" :fuel 280))
          ship (assoc (player "uranus" (pos 39 -6.2)) :fuel 220)
          action (strategy/choose-action cfg world ship)]
      (is (= "buy" (:action action)))
      (is (= "fuel" (:item action)))
      (is (= 100 (:qty action)))
      (is (= "haul-fuel" (get-in action [:governmentIntent :kind])))))
  (testing "Uranus reserve blocks fuel buying"
    (let [world (-> (snapshot)
                    (with-stock "uranus" :food 140)
                    (with-stock "uranus" :fuel 170))
          ship (assoc (player "uranus" (pos 39 -6.2)) :fuel 220)
          action (strategy/choose-action cfg world ship)]
      (is (not= "buy" (:action action))))))

(deftest sells-fuel-to-saturn-only-when-saturn-fuel-is-low
  (testing "low Saturn Fuel receives tank fuel"
    (let [world (-> (snapshot)
                    (with-stock "uranus" :food 140)
                    (with-stock "saturn" :fuel 20))
          ship (assoc (player "saturn" (pos 26 5.4)) :fuel 320)
          action (strategy/choose-action cfg world ship)]
      (is (= "sell" (:action action)))
      (is (= "fuel" (:item action)))
      (is (= 140 (:qty action)))
      (is (= "saturn" (get-in action [:governmentIntent :target])))))
  (testing "healthy Saturn Fuel is not sold into"
    (let [world (-> (snapshot)
                    (with-stock "uranus" :food 140)
                    (with-stock "saturn" :fuel 140))
          ship (assoc (player "saturn" (pos 26 5.4)) :fuel 320)
          action (strategy/choose-action cfg world ship)]
      (is (not= "sell" (:action action))))))
