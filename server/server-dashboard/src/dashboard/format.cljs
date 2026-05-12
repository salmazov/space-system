(ns dashboard.format)

(defn format-credits [value]
  (.toLocaleString (or value 0) js/undefined #js {:maximumFractionDigits 2
                                                  :minimumFractionDigits 0}))

(defn format-position [position]
  (str "x " (.toFixed (:x position) 1) ", z " (.toFixed (:z position) 1)))

(defn short-client-id [client-id]
  (let [start (max 0 (- (count client-id) 8))]
    (subs client-id start)))

(defn group-counts [values]
  (reduce (fn [counts value]
            (update counts value (fnil inc 0)))
          {}
          values))

(defn format-maybe-number [value]
  (if (number? value) (.toFixed value 2) "?"))

(defn ship-color [player]
  (case (:homePlanetId player)
    "earth" "#2f9cf0"
    "luna" "#2f9cf0"
    "mars" "#e0563c"
    "jupiter" "#d48642"
    "saturn" "#dfbd64"
    "#55d7ff"))
