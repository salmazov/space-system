(ns space-system.rules.navigation
  (:require [space-system.rules.geometry :as geometry]))

(defn fuel-needed [player target-position]
  (* (geometry/distance (:position player) target-position) (:fuelBurnPerUnit player)))

(defn enough-fuel? [player target-position]
  (>= (:fuel player) (* 1.08 (fuel-needed player target-position))))

(defn sos-signals [snapshot]
  (or (:sosSignals snapshot) []))

(defn reachable-sos [cfg snapshot player]
  (->> (sos-signals snapshot)
       (remove #(= (:clientId %) (:clientId cfg)))
       (filter #(enough-fuel? player (:position %)))
       (sort-by #(geometry/distance (:position player) (:position %)))))