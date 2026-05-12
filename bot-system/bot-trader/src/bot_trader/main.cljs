(ns bot-trader.main
  (:require [bot-trader.api :as api]
            [bot-trader.brain :as brain]
            [bot-trader.config :as config]
            [bot-trader.memory :as memory]
            [bot-trader.util :refer [sleep]]
            [bot-trader.world :as world]))

(def running? (atom true))

(defn submit-and-remember! [cfg snapshot player action]
  (-> (api/submit! (memory/cfg-with-memory cfg) snapshot action)
      (.then #(memory/remember-submit-result! cfg snapshot player action %))))

(defn step! [cfg]
  (-> (api/fetch-world cfg)
      (.then (fn [snapshot]
               (let [player (world/player-for cfg snapshot)]
                 (memory/refresh! cfg snapshot player)
                 (cond
                   (world/pending? cfg snapshot) nil
                   (nil? player) (submit-and-remember! cfg snapshot player {:action "spawn" :name (:name cfg) :shipClassId "small_trade_ship" :target (:homePlanetId cfg)})
                   (:destinationPosition player) nil
                   :else (let [action (brain/choose-action (memory/cfg-with-memory cfg) snapshot player)]
                           (submit-and-remember! cfg snapshot player action))))))))

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
    (js/console.log (str (:name cfg) " starting under " (config/planet-label (:homePlanetId cfg)) " flag at " (.toString (:serverUrl cfg)) " with urgency " (:urgency cfg)))
    (.once js/process "SIGINT" #(do (reset! running? false)
                                     (js/console.log "Stopping bot after current cycle.")))
    (let [delay-ms (initial-delay-ms cfg)]
      (js/console.log (str (:name cfg) " first action delay " delay-ms "ms"))
      (js/setTimeout #(run-loop! cfg) delay-ms))))
