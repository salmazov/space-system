(ns bot-player.main
  (:require [bot-player.api :as api]
            [bot-player.brain :as brain]
            [bot-player.config :as config]
            [bot-player.util :refer [sleep]]
            [bot-player.world :as world]))

(def running? (atom true))
(def memory (atom {:intent nil}))

(defn remember-action! [action]
  (cond
    (:clearIntent action) (swap! memory assoc :intent nil)
    (:botIntent action) (swap! memory assoc :intent (:botIntent action))))

(defn step! [cfg]
  (-> (api/fetch-world cfg)
      (.then (fn [world]
               (let [player (world/player-for cfg world)]
                 (cond
                   (world/pending? cfg world) nil
                   (nil? player) (api/submit! cfg world {:action "spawn" :name (:name cfg) :shipClassId "small_trade_ship" :target (:homePlanetId cfg)})
                   (:destinationPosition player) nil
                   :else (let [action (brain/choose-action (assoc cfg :intent (:intent @memory)) world player)]
                           (remember-action! action)
                           (api/submit! cfg world action))))))))

(defn run-loop! [cfg]
  (when @running?
    (-> (step! cfg)
        (.catch #(js/console.error (or (.-message %) %)))
        (.then #(sleep (:intervalMs cfg)))
        (.then #(run-loop! cfg)))))

(defn -main [& _args]
  (let [cfg (config/config)]
    (js/console.log (str (:name cfg) " starting under " (config/planet-label (:homePlanetId cfg)) " flag at " (.toString (:serverUrl cfg)) " with urgency " (:urgency cfg)))
    (.once js/process "SIGINT" #(do (reset! running? false)
                                     (js/console.log "Stopping bot after current cycle.")))
    (run-loop! cfg)))