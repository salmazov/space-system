(ns dashboard.app)

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

(defn format-credits [value]
  (.toLocaleString (or value 0) js/undefined #js {:maximumFractionDigits 2
                                                  :minimumFractionDigits 0}))

(defn format-position [position]
  (str "x " (.toFixed (:x position) 1) ", z " (.toFixed (:z position) 1)))

(defn short-client-id [client-id]
  (let [start (max 0 (- (count client-id) 8))]
    (subs client-id start)))

(defn used-cargo [player]
  (reduce + 0 (vals (or (:cargo player) {}))))

(defn group-counts [values]
  (reduce (fn [counts value]
            (update counts value (fnil inc 0)))
          {}
          values))

(defn active-client-id-set [world]
  (set (concat (or (:activeClientIds world) [])
               (keep :clientId (or (:connectedUsers world) [])))))

(defn sos-client-id-set [world]
  (set (map :clientId (or (:sosSignals world) []))))

(defn player-for-client [world client-id]
  (some #(when (= (:ownerClientId %) client-id) %) (:players world)))

(defn observer-ships [world]
  (let [active-client-ids (active-client-id-set world)]
    (filter #(contains? active-client-ids (:ownerClientId %)) (:players world))))

(defn planet-name [world planet-id]
  (or (:name (some #(when (= (:id %) planet-id) %) (:planets world))) planet-id))

(defn ship-color [player]
  (case (:homePlanetId player)
    "earth" "#2f9cf0"
    "luna" "#2f9cf0"
    "mars" "#e0563c"
    "jupiter" "#d48642"
    "saturn" "#dfbd64"
    "#55d7ff"))

(defn ship-stat [label value]
  (let [stat (element "div" "ship-stat")
        label-element (set-text! (element "span" nil) label)
        value-element (set-text! (element "strong" nil) value)]
    (append! stat label-element value-element)))

(defn ship-badge
  ([text] (ship-badge text ""))
  ([text class-name]
   (let [badge (element "span" (classes "ship-badge" class-name))]
     (set-text! badge text))))

(defn is-government-ship? [player]
  (= (:shipClassId player) "government_freighter"))

(defn compare-ships [left right]
  (let [home-compare (.localeCompare (:homePlanetId left) (:homePlanetId right))]
    (if (zero? home-compare)
      (.localeCompare (:name left) (:name right))
      home-compare)))

(defn decision-object [value]
  (when (map? value) value))

(defn decision-string [value]
  (when (and (string? value) (seq value)) value))

(defn format-maybe-number [value]
  (if (number? value) (.toFixed value 2) "?"))

(defn format-intent [intent]
  (if-not intent
    ""
    (let [kind (decision-string (:kind intent))
          stage (decision-string (:stage intent))
          item (decision-string (:item intent))
          target (or (decision-string (:target intent))
                     (decision-string (:targetPlanetId intent))
                     (decision-string (:targetClientId intent)))]
      (.join (to-array (filter seq [(when kind (str "intent " kind)) stage item (when target (str "to " target))])) " "))))

(defn format-mission [mission]
  (if-not mission
    ""
    (let [kind (decision-string (:kind mission))
          stage (decision-string (:stage mission))
          target (decision-string (:targetPlanetId mission))]
      (if-not (some seq [kind stage target])
        ""
        (.join (to-array (filter seq ["mission" kind stage (when target (str "to " target))])) " ")))))

(defn format-risk-change [change]
  (if-not change
    ""
    (let [reason (decision-string (:reason change))
          delta (:delta change)]
      (cond
        (not reason) ""
        (not (number? delta)) (str "last risk " reason)
        :else (str "last risk " reason " " (if (pos? delta) "+" "") (.toFixed delta 2))))))

(defn decision-details [entry]
  (let [decision (:decision entry)
        intent (or (decision-object (:intent decision))
                   (decision-object (:activeIntent decision)))
        mission (decision-object (get-in decision [:memory :mission]))
        strategy (decision-object (get-in decision [:memory :strategy]))
        last-risk-change (decision-object (:lastRiskChange strategy))
        intent-text (format-intent intent)
        mission-text (format-mission mission)
        strategy-text (if strategy
                        (str "risk " (format-maybe-number (:riskTolerance strategy)) " · " (or (decision-string (:tradeBias strategy)) "balanced"))
                        "")
        risk-change-text (format-risk-change last-risk-change)]
    (.join (to-array (filter seq [intent-text mission-text strategy-text risk-change-text])) " · ")))

(defn decision-summary [entry]
  (if-let [summary (decision-string (get-in entry [:decision :summary]))]
    summary
    (let [action (:action entry)]
      (case (:action action)
        "buy" (str "buy " (or (:qty action) "?") " " (or (:item action) "item"))
        "sell" (str "sell " (or (:qty action) "?") " " (or (:item action) "item"))
        "move" (str "move to " (if (map? (:target action)) (format-position (:target action)) "target"))
        "travel" (str "travel to " (if (string? (:target action)) (:target action) "planet"))
        "share_fuel" (str "share " (or (:qty action) "?") " fuel with " (short-client-id (or (:targetClientId action) "unknown")))
        "sos" "broadcast SOS"
        "spawn" (str "spawn " (or (:name action) "ship"))
        (or (:action action) "unknown action")))))

(defn render-decision-entry [entry]
  (let [row (element "div" (str "ship-decision-entry " (if (:accepted entry) "accepted" "rejected")))
        meta (set-text! (element "span" nil) (str "t" (:tick entry) " · " (.toLocaleTimeString (js/Date. (:at entry)))))
        summary (set-text! (element "strong" nil) (decision-summary entry))
        outcome (if (:accepted entry)
                  (str "queued for tick " (or (:queuedForTick entry) "?"))
                  (str "rejected: " (or (:reason entry) "unknown")))
        details (set-text! (element "small" nil) (.join (to-array (filter seq [outcome (decision-details entry)])) " · "))]
    (set! (.-title row) (js/JSON.stringify (clj->js {:action (:action entry)
                                                      :decision (:decision entry)
                                                      :reason (:reason entry)})
                                           nil
                                           2))
    (append! row meta summary details)))

(defn render-ship-decision-log [world player]
  (let [panel (element "div" "ship-decision-log")
        heading (set-text! (element "div" "ship-decision-heading") "Decisions")
        entries (take 3 (filter #(= (:clientId %) (:ownerClientId player)) (or (:actionLog world) [])))]
    (append! panel heading)
    (if (seq entries)
      (apply append! panel (map render-decision-entry entries))
      (append! panel (set-text! (element "div" "ship-decision-empty") "No decisions observed yet.")))
    panel))

(defn player-status [player location destination]
  (if (:destinationPosition player)
    (str "moving to " (or destination (format-position (:destinationPosition player))))
    (if (:locationPlanetId player)
      (str "docked at " location)
      (str "idle at " location))))

(defn render-ship-card [world player has-sos]
  (let [item (element "li" (str "ship-card" (when has-sos " sos-ship")))
        header (element "div" "ship-card-header")
        name (set-text! (element "strong" nil) (:name player))
        wallet (set-text! (element "span" "ship-wallet") (str (format-credits (:credits player)) " credits"))
        meta (element "div" "ship-card-meta")
        stats (element "div" "ship-stats")
        location (if (:locationPlanetId player) (planet-name world (:locationPlanetId player)) (format-position (:position player)))
        destination (when (:destinationPlanetId player) (planet-name world (:destinationPlanetId player)))
        status (player-status player location destination)]
    (aset (.-dataset item) "shipClientId" (:ownerClientId player))
    (aset (.-dataset item) "sos" (if has-sos "true" "false"))
    (.setProperty (.-style item) "--ship-color" (ship-color player))
    (append! header name wallet)
    (apply append! meta (concat (when has-sos [(ship-badge "SOS" "sos-badge")])
                                [(ship-badge (str (:faction player) " · " (planet-name world (:homePlanetId player))))
                                 (ship-badge (short-client-id (:ownerClientId player)))
                                 (ship-badge (:shipClassLabel player))]))
    (apply append! stats [(ship-stat "Status" status)
                          (ship-stat "Cargo" (str (used-cargo player) "/" (:cargoCapacity player)))
                          (ship-stat "Fuel" (str (format-credits (:fuel player)) "/" (format-credits (:fuelCapacity player))))
                          (ship-stat "Explored" (str (count (:exploredAreas player))))
                          (ship-stat "Speed" (str (:speed player) " u/s"))
                          (ship-stat "Value" (str "EUR " (format-credits (:priceEuro player))))])
    (append! item header meta stats (render-ship-decision-log world player))))

(defn render-ship-summary [players total-players]
  (let [item (element "li" "ship-summary")
        cargo-used (reduce + (map used-cargo players))
        cargo-capacity (reduce + (map :cargoCapacity players))
        credits (reduce + (map :credits players))
        fuel (reduce + (map :fuel players))
        fuel-capacity (reduce + (map :fuelCapacity players))
        factions (.join (to-array (map (fn [[faction count]] (str faction " " count)) (group-counts (map :faction players)))) " · ")]
    (apply append! item [(ship-stat "Active" (str (count players) "/" total-players))
                         (ship-stat "Wallets" (str (format-credits credits) " credits"))
                         (ship-stat "Cargo" (str cargo-used "/" cargo-capacity))
                         (ship-stat "Fuel" (str (format-credits fuel) "/" (format-credits fuel-capacity)))
                         (ship-stat "Factions" factions)])))

(defn render-ship-roster [world include-ship? labels]
  (let [total-ships (count (filter include-ship? (:players world)))]
    (cond
      (zero? total-ships) [(list-item (:empty labels))]
      :else (let [players (sort compare-ships (filter include-ship? (observer-ships world)))]
              (if-not (seq players)
                [(list-item (str total-ships " inactive " (:hidden-label labels) " ship" (when (not= total-ships 1) "s") " hidden from observer."))]
                (let [sos-client-ids (sos-client-id-set world)]
                  (cons (render-ship-summary players total-ships)
                        (map #(render-ship-card world % (contains? sos-client-ids (:ownerClientId %))) players))))))))

(defn render-player-ships [world]
  (render-ship-roster world (complement is-government-ship?) {:empty "No player or trader ships spawned."
                                                              :hidden-label "player/trader"}))

(defn render-government-ships [world]
  (render-ship-roster world is-government-ship? {:empty "No government ships spawned."
                                                 :hidden-label "government"}))

(defn render-connected-user [user ship]
  (let [item (element "li" "connected-user-row active")
        name (set-text! (element "strong" nil) (:name user))
        meta (set-text! (element "span" nil) (.join (to-array (filter seq [(when (:clientId user) (short-client-id (:clientId user)))
                                                                             (.toLocaleTimeString (js/Date. (:connectedAt user)))])) " · "))
        status (set-text! (element "small" nil) (format-position (:position ship)))]
    (append! item name meta status)))

(defn render-waiting-users [users]
  (let [item (element "li" "connected-user-row waiting")
        title (set-text! (element "strong" nil) (str (count users) " awaiting ship" (when (not= (count users) 1) "s")))
        sample (.join (to-array (map (fn [user]
                                       (str (:name user) (when (:clientId user) (str " " (short-client-id (:clientId user))))))
                                     (take 4 users)))
                      " · ")
        overflow (when (> (count users) 4) (str " · +" (- (count users) 4) " more"))
        details (set-text! (element "span" nil) (str sample overflow))]
    (append! item title details)))

(defn render-connected-users [world]
  (let [connected-users (or (:connectedUsers world) [])]
    (if-not (seq connected-users)
      [(list-item "No playable clients connected.")]
      (let [{active true waiting false} (group-by #(boolean (when (:clientId %) (player-for-client world (:clientId %)))) connected-users)
            active-items (map #(render-connected-user % (player-for-client world (:clientId %))) active)]
        (if (seq waiting)
          (concat active-items [(render-waiting-users waiting)])
          active-items)))))

(defn render-events [events]
  (map #(list-item (:message %)) (if (seq events) events [{:message "No major events this tick."}])))

(defn render-planet-header [planet]
  (let [header (element "header" nil)
        left (element "div" nil)
        title (set-text! (element "h2" nil) (:name planet))
        faction (set-text! (element "div" "faction") (:faction planet))
        status (set-text! (element "div" "faction") (if (:blockade planet) "Blockaded" "Open"))]
    (append! left title faction)
    (append! header left status)))

(defn render-store-summary [store]
  (set-text! (element "div" "store-name") (str (:name store) " · treasury " (format-credits (:credits store)) " credits")))

(defn render-goods [store goods]
  (let [goods-list (element "div" "goods")]
    (doseq [[good-id good] goods]
      (let [row (element "div" "good")
            left (element "div" nil)
            label (set-text! (element "strong" nil) (:label good))
            stock (set-text! (element "span" nil) (str "Stock: " (get-in store [:inventory good-id] 0)))
            price (element "div" "price")
            amount (set-text! (element "strong" nil) (get-in store [:prices good-id] 0))
            units (set-text! (element "span" nil) "credits")]
        (append! left label stock)
        (append! price amount units)
        (append! row left price)
        (append! goods-list row)))
    goods-list))

(defn render-planet [planet goods]
  (let [article (element "article" "planet")
        store (first (:stores planet))]
    (append! article (render-planet-header planet))
    (when store
      (append! article (render-store-summary store) (render-goods store goods)))
    article))

(defn render-planet-marker [planet project]
  (let [point (project (:position planet))
        marker (element "div" (str "map-marker planet-marker planet-" (:id planet)))
        label (set-text! (element "span" nil) (:name planet))]
    (.toggle (.-classList marker) "label-left" (> (:x point) 68))
    (.toggle (.-classList marker) "label-up" (> (:y point) 74))
    (set! (.-left (.-style marker)) (str (:x point) "%"))
    (set! (.-top (.-style marker)) (str (:y point) "%"))
    (set! (.-title marker) (str (:name planet) " " (format-position (:position planet))))
    (append! marker label)))

(defn escape-selector-value [value]
  (if (and (exists? js/CSS) (.-escape js/CSS))
    (.escape js/CSS value)
    value))

(defn scroll-ship-into-view [client-id]
  (let [selector (str "[data-ship-client-id=\"" (escape-selector-value client-id) "\"]")
        card (.querySelector js/document selector)]
    (when card
      (.scrollIntoView card #js {:block "center" :behavior "smooth"})
      (.add (.-classList card) "ship-card-highlight")
      (js/setTimeout #(.remove (.-classList card) "ship-card-highlight") 1400))))

(defn render-ship-marker [player project connected? has-sos]
  (let [point (project (:position player))
        marker (element "div" (str "map-marker ship-marker " (if connected? "connected-ship" "stale-ship") (when has-sos " sos-ship")))
        label (set-text! (element "span" nil) (str (when has-sos "SOS ") (:name player) " " (format-position (:position player))))]
    (aset (.-dataset marker) "clientId" (:ownerClientId player))
    (set! (.-role marker) "button")
    (set! (.-tabIndex marker) 0)
    (.toggle (.-classList marker) "label-left" (> (:x point) 68))
    (.toggle (.-classList marker) "label-up" (> (:y point) 74))
    (.setProperty (.-style marker) "--ship-color" (ship-color player))
    (set! (.-left (.-style marker)) (str (:x point) "%"))
    (set! (.-top (.-style marker)) (str (:y point) "%"))
    (set! (.-title marker) (str (when has-sos "SOS ") (:name player) " " (format-position (:position player))))
    (append! marker label)
    (.addEventListener marker "click" #(scroll-ship-into-view (:ownerClientId player)))
    (.addEventListener marker "keydown" (fn [event]
                                           (when (contains? #{"Enter" " "} (.-key event))
                                             (.preventDefault event)
                                             (scroll-ship-into-view (:ownerClientId player)))))
    marker))

(defn render-ship-route-line [world player project]
  (when-let [destination (:destinationPosition player)]
    (let [line (element "div" "ship-route-line")
          from (project (:position player))
          to (project destination)
          delta-x (- (:x to) (:x from))
          delta-y (- (:y to) (:y from))]
      (.setProperty (.-style line) "--ship-color" (ship-color player))
      (set! (.-left (.-style line)) (str (:x from) "%"))
      (set! (.-top (.-style line)) (str (:y from) "%"))
      (set! (.-width (.-style line)) (str (js/Math.hypot delta-x delta-y) "%"))
      (set! (.-transform (.-style line)) (str "rotate(" (js/Math.atan2 delta-y delta-x) "rad)"))
      (set! (.-title line) (str (:name player) " route to " (if (:destinationPlanetId player)
                                                              (planet-name world (:destinationPlanetId player))
                                                              (format-position destination))))
      line)))

(defn render-sos-radius [signal projector]
  (let [point ((:project projector) (:position signal))
        marker (element "div" "sos-radius")]
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
  (let [visible-ships (vec (observer-ships world))
        active-client-ids (active-client-id-set world)
        sos-client-ids (sos-client-id-set world)
        bounds (map-bounds world visible-ships)
        projector (create-projector bounds)
        project (:project projector)
        hidden-ships (- (count (:players world)) (count visible-ships))
        hidden-text (if (pos? hidden-ships) (str " · " hidden-ships " hidden") "")]
    (set-text! summary (str (count (:planets world)) " planets · " (count visible-ships) "/" (count (:players world)) " active ships · " (count (or (:sosSignals world) [])) " SOS" hidden-text))
    (replace-children! container
                       (concat (map #(render-sos-radius % projector) (or (:sosSignals world) []))
                               (keep #(render-ship-route-line world % project) visible-ships)
                               (map #(render-planet-marker % project) (:planets world))
                               (map #(render-ship-marker % project (contains? active-client-ids (:ownerClientId %)) (contains? sos-client-ids (:ownerClientId %))) visible-ships)))))

(defn render-world [world elements]
  (set-text! (:tick elements) (:tick world))
  (set-text! (:tick-rate elements) (str (/ (:tickMs world) 1000) "s"))
  (set-text! (:connected-user-count elements) (or (get-in world [:connectionCounts :users]) 0))
  (replace-children! (:planets elements) (map #(render-planet % (:goods world)) (:planets world)))
  (replace-children! (:connected-users elements) (render-connected-users world))
  (replace-children! (:government-ships elements) (render-government-ships world))
  (replace-children! (:player-ship elements) (render-player-ships world))
  (replace-children! (:events elements) (render-events (:recentEvents world)))
  (render-observer-map world (:observer-map elements) (:map-summary elements)))

(defonce elements (dashboard-elements))

(defn websocket-url [path]
  (let [location (.-location js/globalThis)
        protocol (if (= (.-protocol location) "https:") "wss:" "ws:")]
    (str protocol "//" (.-host location) path)))

(defn update-status! [connected?]
  (set-text! (:status elements) (if connected? "Connected" "Reconnecting"))
  (set! (.-className (:status elements)) (if connected? "status connected" "status disconnected")))

(declare connect-dashboard-socket!)

(defn reconnect! []
  (update-status! false)
  (js/setTimeout connect-dashboard-socket! 1000))

(defn connect-dashboard-socket! []
  (let [socket (js/WebSocket. (websocket-url "/ws?client=dashboard"))]
    (.addEventListener socket "open" #(update-status! true))
    (.addEventListener socket "message" (fn [event]
                                           (let [message (js-value->clj (js/JSON.parse (.-data event)))]
                                             (when (= (:type message) "world")
                                               (render-world (:payload message) elements)))))
    (.addEventListener socket "close" reconnect!)
    (.addEventListener socket "error" (fn [_]
                                        (update-status! false)
                                        (.close socket)))))

(connect-dashboard-socket!)
