(ns bot-trader.economy-test
  (:require [bot-trader.economy :as economy]
            [cljs.test :refer [deftest is]]))

(deftest cargo-helpers-read-current-load
  (let [player {:cargo {:food 3 :fuel 2}}]
    (is (= 5 (economy/cargo-used player)))
    (is (= 3 (economy/carried player :food)))
    (is (= 0 (economy/carried player :ore)))))

(deftest market-helpers-read-local-values-with-base-price-fallback
  (let [snapshot {:goods {:food {:basePrice 8} :fuel {:basePrice 20}}}
        store {:inventory {:food 12}
               :prices {:fuel 25}}]
    (is (= 25 (economy/price snapshot store :fuel)))
    (is (= 8 (economy/price snapshot store :food)))
    (is (= 12 (economy/stock store :food)))
    (is (= 0 (economy/stock store :ore)))))