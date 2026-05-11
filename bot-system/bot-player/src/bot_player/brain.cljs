(ns bot-player.brain
  (:require [space-system.rules :as rules]))

(defn choose-action [cfg snapshot player]
  (rules/choose-action cfg snapshot player))
