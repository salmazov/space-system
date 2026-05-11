(ns bot-player.util)

(defn random-item [xs]
  (when (seq xs)
    (nth xs (rand-int (count xs)))))

(defn random-between [min max]
  (+ min (* (rand) (- max min))))

(defn sleep [ms]
  (js/Promise. (fn [resolve _reject] (js/setTimeout resolve ms))))