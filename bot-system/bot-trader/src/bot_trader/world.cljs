(ns bot-trader.world
  (:require [space-system.rules.world :as shared]))

(def planet-by-id shared/planet-by-id)

(def current-planet shared/current-planet)

(def store-at shared/store-at)

(defn pending? [cfg world]
  (some #(= (get-in % [:action :clientId]) (:clientId cfg)) (:pendingActions world)))

(defn player-for [cfg world]
  (some #(when (= (:ownerClientId %) (:clientId cfg)) %) (:players world)))