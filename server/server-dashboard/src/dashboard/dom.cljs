(ns dashboard.dom)

(defn by-id [id]
  (let [element (.querySelector js/document (str "#" id))]
    (when-not element
      (throw (js/Error. (str "Missing element #" id))))
    element))

(defn js-object? [value]
  (and (some? value)
       (= "object" (js* "typeof ~{}" value))
       (not (js/Array.isArray value))))

(defn js-value->clj [value]
  (cond
    (js/Array.isArray value) (mapv js-value->clj value)
    (js-object? value) (into {} (map (fn [key]
                                       [key (js-value->clj (aget value key))])
                                     (js/Object.keys value)))
    :else value))

(defn dashboard-elements []
  {:connected-user-count (by-id "connectedUserCount")
   :connected-users (by-id "connectedUsers")
   :events (by-id "events")
   :government-ships (by-id "governmentShips")
   :map-summary (by-id "mapSummary")
   :observer-map (by-id "observerMap")
   :planets (by-id "planets")
   :player-ship (by-id "playerShip")
   :status (by-id "connectionStatus")
   :tick (by-id "tick")
   :tick-rate (by-id "tickRate")})

(defn classes [& names]
  (.join (to-array (filter seq names)) " "))

(defn set-text! [element text]
  (set! (.-textContent element) (str text))
  element)

(defn append! [element & children]
  (.apply (.-append element) element (to-array (remove nil? children)))
  element)

(defn replace-children! [element children]
  (.apply (.-replaceChildren element) element (to-array (remove nil? children)))
  element)

(defn element [tag class-name]
  (let [node (.createElement js/document tag)]
    (when class-name
      (set! (.-className node) class-name))
    node))

(defn list-item [text]
  (set-text! (element "li" nil) text))

(defn escape-selector-value [value]
  (if (and (exists? js/CSS) (.-escape js/CSS))
    (.escape js/CSS value)
    value))
