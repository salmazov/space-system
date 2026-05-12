(ns dashboard.render.ships
  (:require [dashboard.dom :as dom]
            [dashboard.format :as fmt]
            [dashboard.world :as model]))

(defn ship-stat [label value]
  (let [stat (dom/element "div" "ship-stat")
        label-element (dom/set-text! (dom/element "span" nil) label)
        value-element (dom/set-text! (dom/element "strong" nil) value)]
    (dom/append! stat label-element value-element)))

(defn ship-badge
  ([text] (ship-badge text ""))
  ([text class-name]
   (let [badge (dom/element "span" (dom/classes "ship-badge" class-name))]
     (dom/set-text! badge text))))

(defn decision-object [value]
  (when (map? value) value))

(defn decision-string [value]
  (when (and (string? value) (seq value)) value))

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
                        (str "risk " (fmt/format-maybe-number (:riskTolerance strategy)) " · " (or (decision-string (:tradeBias strategy)) "balanced"))
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
        "move" (str "move to " (if (map? (:target action)) (fmt/format-position (:target action)) "target"))
        "travel" (str "travel to " (if (string? (:target action)) (:target action) "planet"))
        "share_fuel" (str "share " (or (:qty action) "?") " fuel with " (fmt/short-client-id (or (:targetClientId action) "unknown")))
        "sos" "broadcast SOS"
        "spawn" (str "spawn " (or (:name action) "ship"))
        (or (:action action) "unknown action")))))

(defn render-decision-entry [entry]
  (let [row (dom/element "div" (str "ship-decision-entry " (if (:accepted entry) "accepted" "rejected")))
        meta (dom/set-text! (dom/element "span" nil) (str "t" (:tick entry) " · " (.toLocaleTimeString (js/Date. (:at entry)))))
        summary (dom/set-text! (dom/element "strong" nil) (decision-summary entry))
        outcome (if (:accepted entry)
                  (str "queued for tick " (or (:queuedForTick entry) "?"))
                  (str "rejected: " (or (:reason entry) "unknown")))
        details (dom/set-text! (dom/element "small" nil) (.join (to-array (filter seq [outcome (decision-details entry)])) " · "))]
    (set! (.-title row) (js/JSON.stringify (clj->js {:action (:action entry)
                                                      :decision (:decision entry)
                                                      :reason (:reason entry)})
                                           nil
                                           2))
    (dom/append! row meta summary details)))

(defn render-ship-decision-log [world player]
  (let [panel (dom/element "div" "ship-decision-log")
        heading (dom/set-text! (dom/element "div" "ship-decision-heading") "Decisions")
        entries (take 3 (filter #(= (:clientId %) (:ownerClientId player)) (or (:actionLog world) [])))]
    (dom/append! panel heading)
    (if (seq entries)
      (apply dom/append! panel (map render-decision-entry entries))
      (dom/append! panel (dom/set-text! (dom/element "div" "ship-decision-empty") "No decisions observed yet.")))
    panel))

(defn player-status [player location destination]
  (if (:destinationPosition player)
    (str "moving to " (or destination (fmt/format-position (:destinationPosition player))))
    (if (:locationPlanetId player)
      (str "docked at " location)
      (str "idle at " location))))

(defn render-ship-card [world player has-sos]
  (let [item (dom/element "li" (str "ship-card" (when has-sos " sos-ship")))
        header (dom/element "div" "ship-card-header")
        name (dom/set-text! (dom/element "strong" nil) (:name player))
        wallet (dom/set-text! (dom/element "span" "ship-wallet") (str (fmt/format-credits (:credits player)) " credits"))
        meta (dom/element "div" "ship-card-meta")
        stats (dom/element "div" "ship-stats")
        location (if (:locationPlanetId player) (model/planet-name world (:locationPlanetId player)) (fmt/format-position (:position player)))
        destination (when (:destinationPlanetId player) (model/planet-name world (:destinationPlanetId player)))
        status (player-status player location destination)]
    (aset (.-dataset item) "shipClientId" (:ownerClientId player))
    (aset (.-dataset item) "sos" (if has-sos "true" "false"))
    (.setProperty (.-style item) "--ship-color" (fmt/ship-color player))
    (dom/append! header name wallet)
    (apply dom/append! meta (concat (when has-sos [(ship-badge "SOS" "sos-badge")])
                                    [(ship-badge (str (:faction player) " · " (model/planet-name world (:homePlanetId player))))
                                     (ship-badge (fmt/short-client-id (:ownerClientId player)))
                                     (ship-badge (:shipClassLabel player))]))
    (apply dom/append! stats [(ship-stat "Status" status)
                              (ship-stat "Cargo" (str (model/used-cargo player) "/" (:cargoCapacity player)))
                              (ship-stat "Fuel" (str (fmt/format-credits (:fuel player)) "/" (fmt/format-credits (:fuelCapacity player))))
                              (ship-stat "Explored" (str (count (:exploredAreas player))))
                              (ship-stat "Speed" (str (:speed player) " u/s"))
                              (ship-stat "Value" (str "EUR " (fmt/format-credits (:priceEuro player))))])
    (dom/append! item header meta stats (render-ship-decision-log world player))))

(defn render-ship-summary [players total-players]
  (let [item (dom/element "li" "ship-summary")
        cargo-used (reduce + (map model/used-cargo players))
        cargo-capacity (reduce + (map :cargoCapacity players))
        credits (reduce + (map :credits players))
        fuel (reduce + (map :fuel players))
        fuel-capacity (reduce + (map :fuelCapacity players))
        factions (.join (to-array (map (fn [[faction count]] (str faction " " count)) (fmt/group-counts (map :faction players)))) " · ")]
    (apply dom/append! item [(ship-stat "Active" (str (count players) "/" total-players))
                             (ship-stat "Wallets" (str (fmt/format-credits credits) " credits"))
                             (ship-stat "Cargo" (str cargo-used "/" cargo-capacity))
                             (ship-stat "Fuel" (str (fmt/format-credits fuel) "/" (fmt/format-credits fuel-capacity)))
                             (ship-stat "Factions" factions)])))

(defn render-ship-roster [world include-ship? labels]
  (let [total-ships (count (filter include-ship? (:players world)))]
    (cond
      (zero? total-ships) [(dom/list-item (:empty labels))]
      :else (let [players (sort model/compare-ships (filter include-ship? (model/observer-ships world)))]
              (if-not (seq players)
                [(dom/list-item (str total-ships " inactive " (:hidden-label labels) " ship" (when (not= total-ships 1) "s") " hidden from observer."))]
                (let [sos-client-ids (model/sos-client-id-set world)]
                  (cons (render-ship-summary players total-ships)
                        (map #(render-ship-card world % (contains? sos-client-ids (:ownerClientId %))) players))))))))

(defn render-player-ships [world]
  (render-ship-roster world (complement model/is-government-ship?) {:empty "No player or trader ships spawned."
                                                                    :hidden-label "player/trader"}))

(defn render-government-ships [world]
  (render-ship-roster world model/is-government-ship? {:empty "No government ships spawned."
                                                       :hidden-label "government"}))
