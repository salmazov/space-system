(ns bot-trader.geometry-test
  (:require [bot-trader.geometry :as geometry]
            [cljs.test :refer [deftest is]]))

(defn pos [x z]
  {:x x :y 0 :z z})

(deftest distance-uses-map-xz-plane
  (is (= 5 (geometry/distance (pos 0 0) (pos 3 4)))))

(deftest explored-uses-area-radius-plus-margin
  (let [areas [{:center (pos 0 0) :radius 2}]]
    (is (geometry/explored? areas (pos 3 0) 1.1))
    (is (not (geometry/explored? areas (pos 4 0) 1.1)))))

(deftest world-bounds-expand-around-planets
  (is (= {:min-x -10 :max-x 12 :min-z -9 :max-z 8}
         (geometry/world-bounds [{:position (pos 12 -9)}]))))