(ns bot-government.main
  (:require [bot-government.api :as api]
            [bot-government.config :as config]
            [bot-government.strategy :as strategy]))

(def running? (atom true))

(defn sleep [ms]
  (js/Promise. (fn [resolve _reject] (js/setTimeout resolve ms))))

(defn pending? [cfg snapshot]
  (some #(= (:clientId cfg) (get-in % [:action :clientId])) (:pendingActions snapshot)))

(defn player-for [cfg snapshot]
  (some #(when (= (:ownerClientId %) (:clientId cfg)) %) (:players snapshot)))

(defn submit! [cfg snapshot action]
  (api/submit! cfg snapshot action))

(defn step! [cfg]
  (-> (api/fetch-world cfg)
      (.then (fn [snapshot]
               (let [player (player-for cfg snapshot)]
                 (cond
                   (pending? cfg snapshot) nil
                   (nil? player) (submit! cfg snapshot {:action "spawn"
                                                        :name (:name cfg)
                                                        :shipClassId "government_freighter"
                                                        :target (:homePlanetId cfg)})
                   (:destinationPosition player) nil
                   :else (submit! cfg snapshot (strategy/choose-action cfg snapshot player))))))))

(defn run-loop! [cfg]
  (when @running?
    (-> (step! cfg)
        (.catch #(js/console.error (or (.-message %) %)))
        (.then #(sleep (:intervalMs cfg)))
        (.then #(run-loop! cfg)))))

(defn initial-delay-ms [cfg]
  (js/Math.floor (* (rand) (:initialDelayMaxMs cfg))))

(defn -main [& _args]
  (let [cfg (config/config)]
    (js/console.log (str (:name cfg) " starting as " (config/planet-label (:homePlanetId cfg)) " government logistics at " (.toString (:serverUrl cfg))))
    (.once js/process "SIGINT" #(do (reset! running? false)
                                     (js/console.log "Stopping government bot after current cycle.")))
    (let [delay-ms (initial-delay-ms cfg)]
      (js/console.log (str (:name cfg) " first action delay " delay-ms "ms"))
      (js/setTimeout #(run-loop! cfg) delay-ms))))
