(ns bot-trader.util
  (:require [space-system.rules.util :as shared]))

(def random-item shared/random-item)

(def random-between shared/random-between)

(defn sleep [ms]
  (js/Promise. (fn [resolve _reject] (js/setTimeout resolve ms))))