(ns dashboard.render.map
  (:require [dashboard.dom :as dom]
            [dashboard.format :as fmt]
            [dashboard.world :as model]))

(defn render-planet-marker [planet project]
  (let [point (project (:position planet))
        marker (dom/element "div" (str "map-marker planet-marker planet-" (:id planet)))
        label (dom/set-text! (dom/element "span" nil) (:name planet))]
    (.toggle (.-classList marker) "label-left" (> (:x point) 68))
    (.toggle (.-classList marker) "label-up" (> (:y point) 74))
    (set! (.-left (.-style marker)) (str (:x point) "%"))
    (set! (.-top (.-style marker)) (str (:y point) "%"))
    (set! (.-title marker) (str (:name planet) " " (fmt/format-position (:position planet))))
    (dom/append! marker label)))

(defn scroll-ship-into-view [client-id]
  (let [selector (str "[data-ship-client-id=\"" (dom/escape-selector-value client-id) "\"]")
        card (.querySelector js/document selector)]
    (when card
      (.scrollIntoView card #js {:block "center" :behavior "smooth"})
      (.add (.-classList card) "ship-card-highlight")
      (js/setTimeout #(.remove (.-classList card) "ship-card-highlight") 1400))))

(defn render-ship-marker [player project connected? has-sos]
  (let [point (project (:position player))
        marker (dom/element "div" (str "map-marker ship-marker " (if connected? "connected-ship" "stale-ship") (when has-sos " sos-ship")))
        label (dom/set-text! (dom/element "span" nil) (str (when has-sos "SOS ") (:name player) " " (fmt/format-position (:position player))))]
    (aset (.-dataset marker) "clientId" (:ownerClientId player))
    (set! (.-role marker) "button")
    (set! (.-tabIndex marker) 0)
    (.toggle (.-classList marker) "label-left" (> (:x point) 68))
    (.toggle (.-classList marker) "label-up" (> (:y point) 74))
    (.setProperty (.-style marker) "--ship-color" (fmt/ship-color player))
    (set! (.-left (.-style marker)) (str (:x point) "%"))
    (set! (.-top (.-style marker)) (str (:y point) "%"))
    (set! (.-title marker) (str (when has-sos "SOS ") (:name player) " " (fmt/format-position (:position player))))
    (dom/append! marker label)
    (.addEventListener marker "click" #(scroll-ship-into-view (:ownerClientId player)))
    (.addEventListener marker "keydown" (fn [event]
                                           (when (contains? #{"Enter" " "} (.-key event))
                                             (.preventDefault event)
                                             (scroll-ship-into-view (:ownerClientId player)))))
    marker))

(defn render-ship-route-line [world player project]
  (when-let [destination (:destinationPosition player)]
    (let [line (dom/element "div" "ship-route-line")
          from (project (:position player))
          to (project destination)
          delta-x (- (:x to) (:x from))
          delta-y (- (:y to) (:y from))]
      (.setProperty (.-style line) "--ship-color" (fmt/ship-color player))
      (set! (.-left (.-style line)) (str (:x from) "%"))
      (set! (.-top (.-style line)) (str (:y from) "%"))
      (set! (.-width (.-style line)) (str (js/Math.hypot delta-x delta-y) "%"))
      (set! (.-transform (.-style line)) (str "rotate(" (js/Math.atan2 delta-y delta-x) "rad)"))
      (set! (.-title line) (str (:name player) " route to " (if (:destinationPlanetId player)
                                                              (model/planet-name world (:destinationPlanetId player))
                                                              (fmt/format-position destination))))
      line)))

(defn render-sos-radius [signal projector]
  (let [point ((:project projector) (:position signal))
        marker (dom/element "div" "sos-radius")]
    (set! (.-left (.-style marker)) (str (:x point) "%"))
    (set! (.-top (.-style marker)) (str (:y point) "%"))
    (set! (.-width (.-style marker)) (str (* ((:radius-x projector) (:radius signal)) 2) "%"))
    (set! (.-height (.-style marker)) (str (* ((:radius-y projector) (:radius signal)) 2) "%"))
    (set! (.-title marker) (str "SOS " (:shipName signal) " needs " (:fuelNeeded signal) " fuel"))
    marker))

(defn map-bounds [world players]
  (let [bounds (atom {:min-x ##Inf :max-x ##-Inf :min-z ##Inf :max-z ##-Inf})
        include-point! (fn [position radius]
                         (swap! bounds (fn [current]
                                         {:min-x (min (:min-x current) (- (:x position) radius))
                                          :max-x (max (:max-x current) (+ (:x position) radius))
                                          :min-z (min (:min-z current) (- (:z position) radius))
                                          :max-z (max (:max-z current) (+ (:z position) radius))})))]
    (doseq [planet (:planets world)]
      (include-point! (:position planet) 3))
    (doseq [player players]
      (include-point! (:position player) (:explorationRadius player))
      (when (:destinationPosition player)
        (include-point! (:destinationPosition player) 2)))
    (doseq [signal (or (:sosSignals world) [])]
      (include-point! (:position signal) (:radius signal)))
    (let [{:keys [min-x max-x min-z max-z]} @bounds
          base (if (js/Number.isFinite min-x)
                 {:min-x min-x :max-x max-x :min-z min-z :max-z max-z}
                 {:min-x -10 :max-x 10 :min-z -8 :max-z 8})
          expanded-x (if (< (- (:max-x base) (:min-x base)) 1)
                       (-> base (update :min-x - 0.5) (update :max-x + 0.5))
                       base)
          expanded-z (if (< (- (:max-z expanded-x) (:min-z expanded-x)) 1)
                       (-> expanded-x (update :min-z - 0.5) (update :max-z + 0.5))
                       expanded-x)]
      expanded-z)))

(defn create-projector [bounds]
  (let [width (- (:max-x bounds) (:min-x bounds))
        height (- (:max-z bounds) (:min-z bounds))]
    {:project (fn [position]
                {:x (+ 8 (* (/ (- (:x position) (:min-x bounds)) width) 84))
                 :y (+ 8 (* (/ (- (:z position) (:min-z bounds)) height) 84))})
     :radius-x (fn [radius] (* (/ radius width) 84))
     :radius-y (fn [radius] (* (/ radius height) 84))}))

(defn render-observer-map [world container summary]
  (let [visible-ships (vec (model/observer-ships world))
        active-client-ids (model/active-client-id-set world)
        sos-client-ids (model/sos-client-id-set world)
        bounds (map-bounds world visible-ships)
        projector (create-projector bounds)
        project (:project projector)
        hidden-ships (- (count (:players world)) (count visible-ships))
        hidden-text (if (pos? hidden-ships) (str " · " hidden-ships " hidden") "")]
    (dom/set-text! summary (str (count (:planets world)) " planets · " (count visible-ships) "/" (count (:players world)) " active ships · " (count (or (:sosSignals world) [])) " SOS" hidden-text))
    (dom/replace-children! container
                           (concat (map #(render-sos-radius % projector) (or (:sosSignals world) []))
                                   (keep #(render-ship-route-line world % project) visible-ships)
                                   (map #(render-planet-marker % project) (:planets world))
                                   (map #(render-ship-marker % project (contains? active-client-ids (:ownerClientId %)) (contains? sos-client-ids (:ownerClientId %))) visible-ships)))))
