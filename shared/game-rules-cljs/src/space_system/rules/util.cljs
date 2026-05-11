(ns space-system.rules.util)

(defn random-item [xs]
  (when (seq xs)
    (nth xs (rand-int (count xs)))))

(defn random-between [min max]
  (+ min (* (rand) (- max min))))
