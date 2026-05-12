(ns dashboard.render
  (:require [dashboard.dom :as dom]
            [dashboard.render.map :as map-view]
            [dashboard.render.panels :as panels]
            [dashboard.render.ships :as ships]))

(defn render-world [world elements]
  (dom/set-text! (:tick elements) (:tick world))
  (dom/set-text! (:tick-rate elements) (str (/ (:tickMs world) 1000) "s"))
  (dom/set-text! (:connected-user-count elements) (or (get-in world [:connectionCounts :users]) 0))
  (dom/replace-children! (:planets elements) (map #(panels/render-planet % (:goods world)) (:planets world)))
  (dom/replace-children! (:connected-users elements) (panels/render-connected-users world))
  (dom/replace-children! (:government-ships elements) (ships/render-government-ships world))
  (dom/replace-children! (:player-ship elements) (ships/render-player-ships world))
  (dom/replace-children! (:builder-ships elements) (ships/render-builder-ships world))
  (dom/replace-children! (:police-ships elements) (ships/render-police-ships world))
  (dom/replace-children! (:drifting-cargo elements) (panels/render-drifting-cargo world))
  (dom/replace-children! (:events elements) (panels/render-events (:recentEvents world)))
  (map-view/render-observer-map world (:observer-map elements) (:map-summary elements)))
