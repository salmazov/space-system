(ns dashboard.render.panels
  (:require [dashboard.dom :as dom]
            [dashboard.format :as fmt]
            [dashboard.world :as model]))

(defn render-connected-user [user ship]
  (let [item (dom/element "li" "connected-user-row active")
        name (dom/set-text! (dom/element "strong" nil) (:name user))
        meta (dom/set-text! (dom/element "span" nil) (.join (to-array (filter seq [(when (:clientId user) (fmt/short-client-id (:clientId user)))
                                                                                     (.toLocaleTimeString (js/Date. (:connectedAt user)))])) " · "))
        status (dom/set-text! (dom/element "small" nil) (fmt/format-position (:position ship)))]
    (dom/append! item name meta status)))

(defn render-waiting-users [users]
  (let [item (dom/element "li" "connected-user-row waiting")
        title (dom/set-text! (dom/element "strong" nil) (str (count users) " awaiting ship" (when (not= (count users) 1) "s")))
        sample (.join (to-array (map (fn [user]
                                       (str (:name user) (when (:clientId user) (str " " (fmt/short-client-id (:clientId user))))))
                                     (take 4 users)))
                      " · ")
        overflow (when (> (count users) 4) (str " · +" (- (count users) 4) " more"))
        details (dom/set-text! (dom/element "span" nil) (str sample overflow))]
    (dom/append! item title details)))

(defn render-connected-users [world]
  (let [connected-users (or (:connectedUsers world) [])]
    (if-not (seq connected-users)
      [(dom/list-item "No playable clients connected.")]
      (let [{active true waiting false} (group-by #(boolean (when (:clientId %) (model/player-for-client world (:clientId %)))) connected-users)
            active-items (map #(render-connected-user % (model/player-for-client world (:clientId %))) active)]
        (if (seq waiting)
          (concat active-items [(render-waiting-users waiting)])
          active-items)))))

(defn render-events [events]
  (map #(dom/list-item (:message %)) (if (seq events) events [{:message "No major events this tick."}])))

(defn render-planet-header [planet]
  (let [header (dom/element "header" nil)
        left (dom/element "div" nil)
        title (dom/set-text! (dom/element "h2" nil) (:name planet))
        faction (dom/set-text! (dom/element "div" "faction") (:faction planet))
        health (let [h (or (:health planet) 1)]
                 (when (< h 1)
                   (dom/set-text! (dom/element "div" (str "faction" (when (<= h 0) " station-destroyed")))
                                  (if (<= h 0) "DESTROYED" (str "Health: " (.toFixed (* h 100) 0) "%")))))
        owner (when-let [oid (:ownerClientId planet)]
                (dom/set-text! (dom/element "div" "faction") (str "Owner: " (fmt/short-client-id oid))))
        status (dom/set-text! (dom/element "div" "faction") (if (:blockade planet) "Blockaded" "Open"))]
    (dom/append! left title faction)
    (when health (dom/append! left health))
    (when owner (dom/append! left owner))
    (dom/append! header left status)))

(defn render-store-summary [store]
  (dom/set-text! (dom/element "div" "store-name") (str (:name store) " · treasury " (fmt/format-credits (:credits store)) " credits")))

(defn render-goods [store goods]
  (let [goods-list (dom/element "div" "goods")]
    (doseq [[good-id good] goods]
      (let [row (dom/element "div" "good")
            left (dom/element "div" nil)
            label (dom/set-text! (dom/element "strong" nil) (:label good))
            stock (dom/set-text! (dom/element "span" nil) (str "Stock: " (get-in store [:inventory good-id] 0)))
            price (dom/element "div" "price")
            amount (dom/set-text! (dom/element "strong" nil) (get-in store [:prices good-id] 0))
            units (dom/set-text! (dom/element "span" nil) "credits")]
        (dom/append! left label stock)
        (dom/append! price amount units)
        (dom/append! row left price)
        (dom/append! goods-list row)))
    goods-list))

(defn render-planet-incidents [planet]
  (let [incidents (or (:incidents planet) [])]
    (when (seq incidents)
      (let [container (dom/element "div" "planet-incidents")
            heading (dom/set-text! (dom/element "div" "incidents-heading") (str (count incidents) " pirate incident" (when (not= (count incidents) 1) "s")))]
        (dom/append! container heading)
        container))))

(defn render-planet [planet goods]
  (let [article (dom/element "article" "planet")
        store (first (:stores planet))]
    (dom/append! article (render-planet-header planet))
    (when store
      (dom/append! article (render-store-summary store) (render-goods store goods)))
    (when-let [incidents-el (render-planet-incidents planet)]
      (dom/append! article incidents-el))
    article))

(defn render-drifting-cargo [world]
  (let [cargo (or (:driftingCargo world) [])]
    (if-not (seq cargo)
      [(dom/list-item "No drifting cargo in space.")]
      (map (fn [c]
             (let [summary (.join (to-array (map (fn [[k v]] (str v " " k)) (:cargo c))) ", ")]
               (dom/list-item (str (:id c) " · " summary " at " (fmt/format-position (:position c))))))
           cargo))))
