(ns bot-player.memory
  (:require [bot-player.geometry :as geometry]
            [bot-player.navigation :as navigation]
            [bot-player.world :as world]
            [clojure.string :as str]))

(def failed-route-ttl-ticks 60)
(def successful-route-ttl-ticks 160)
(def market-memory-ttl-ticks 120)
(def frontier-ttl-ticks 90)
(def rescue-memory-ttl-ticks 48)

(def initial-state
  {:mission {:kind nil
             :stage nil
             :targetPlanetId nil
             :cargoPlan nil
             :fallback nil
             :intent nil}
   :navigation {:plannedRoute nil
                :failedRoutes {}
                :successfulRoutes {}
                :frontierTargets []}
   :marketMemory {:prices {}
                  :stocks {}
                  :lastSeenTick {}}
   :explorationMemory {:interestingPlanets #{}
                       :deadEnds {}
                       :lastFrontier nil}
   :rescueMemory {:activeRescue nil
                  :ignoredSos {}
                  :helpedShips {}}
   :strategy {:riskTolerance 0.5
              :fuelReserveRatio 0.28
              :tradeBias :balanced}})

(def state (atom initial-state))

(defn snapshot []
  @state)

(defn route-action? [action]
  (#{"move" "travel"} (:action action)))

(defn position-route-key [position]
  (str "pos:" (.toFixed (:x position) 1) ":" (.toFixed (:z position) 1)))

(defn route-key [action]
  (case (:action action)
    "move" (position-route-key (:target action))
    "travel" (str "planet:" (:target action))
    nil))

(defn prune-tick-map [tick ttl entries]
  (into {}
        (filter (fn [[_ entry-tick]]
                  (<= (- tick entry-tick) ttl))
                (or entries {}))))

(defn prune-frontiers [tick frontiers]
  (->> (or frontiers [])
       (filter #(<= (- tick (:tick %)) frontier-ttl-ticks))
       (take-last 12)
       vec))

(defn prune-market-memory [tick market-memory]
  (let [fresh-last-seen (prune-tick-map tick market-memory-ttl-ticks (:lastSeenTick market-memory))
        fresh-planet-ids (set (keys fresh-last-seen))]
    {:prices (select-keys (:prices market-memory) fresh-planet-ids)
     :stocks (select-keys (:stocks market-memory) fresh-planet-ids)
     :lastSeenTick fresh-last-seen}))

(defn visible-planet? [player planet]
  (and player
       (or (= (:locationPlanetId player) (:id planet))
           (geometry/explored? (:exploredAreas player) (:position planet) 1.4))))

(defn remember-market [tick memory planet]
  (if-let [store (world/store-at planet)]
    (-> memory
        (assoc-in [:marketMemory :prices (:id planet)] (:prices store))
        (assoc-in [:marketMemory :stocks (:id planet)] (:inventory store))
        (assoc-in [:marketMemory :lastSeenTick (:id planet)] tick)
        (update-in [:explorationMemory :interestingPlanets] (fnil conj #{}) (:id planet)))
    memory))

(defn remember-visible-markets [snapshot player memory]
  (if-not player
    memory
    (reduce (fn [state planet]
              (if (visible-planet? player planet)
                (remember-market (:tick snapshot) state planet)
                state))
            memory
            (:planets snapshot))))

(defn mark-route-success [memory planned tick]
  (if-let [key (:key planned)]
    (-> memory
        (assoc-in [:navigation :successfulRoutes key] tick)
        (assoc-in [:navigation :plannedRoute] nil)
        (update-in [:navigation :frontierTargets]
                   (fn [frontiers]
                     (vec (remove #(= (:key %) key) (or frontiers []))))))
    (assoc-in memory [:navigation :plannedRoute] nil)))

(defn mark-route-failed [memory planned tick]
  (if-let [key (:key planned)]
    (cond-> (-> memory
                (assoc-in [:navigation :failedRoutes key] tick)
                (assoc-in [:navigation :plannedRoute] nil))
      (str/starts-with? key "pos:") (assoc-in [:explorationMemory :deadEnds key] tick))
    (assoc-in memory [:navigation :plannedRoute] nil)))

(defn update-route-memory [cfg snapshot player memory]
  (let [planned (get-in memory [:navigation :plannedRoute])]
    (cond
      (nil? player) (assoc-in memory [:navigation :plannedRoute] nil)
      (world/pending? cfg snapshot) memory
      (:destinationPosition player) (mark-route-success memory planned (:tick snapshot))
      (nil? planned) memory
      (< (:tick snapshot) (:queuedForTick planned)) memory
      (< (geometry/distance (:position player) (:fromPosition planned)) 0.05) (mark-route-failed memory planned (:tick snapshot))
      :else (mark-route-success memory planned (:tick snapshot)))))

(defn update-rescue-memory [cfg snapshot memory]
  (let [active (get-in memory [:rescueMemory :activeRescue])
        target-client-id (:targetClientId active)
        signal-visible? (some #(= (:clientId %) target-client-id) (navigation/sos-signals snapshot))]
    (if (and active
             target-client-id
             (not (world/pending? cfg snapshot))
             (<= (:queuedForTick active 0) (:tick snapshot))
             (not signal-visible?))
      (-> memory
          (assoc-in [:rescueMemory :helpedShips target-client-id] (:tick snapshot))
          (assoc-in [:rescueMemory :activeRescue] nil))
      memory)))

(defn normalize-memory [memory]
  (merge-with merge initial-state memory))

(defn refresh [cfg snapshot player memory]
  (let [tick (:tick snapshot)
        memory (normalize-memory memory)]
    (-> memory
        (update-in [:navigation :failedRoutes] #(prune-tick-map tick failed-route-ttl-ticks %))
        (update-in [:navigation :successfulRoutes] #(prune-tick-map tick successful-route-ttl-ticks %))
        (update-in [:navigation :frontierTargets] #(prune-frontiers tick %))
        (update-in [:marketMemory] #(prune-market-memory tick %))
        (update-in [:explorationMemory :deadEnds] #(prune-tick-map tick failed-route-ttl-ticks %))
        (update-in [:rescueMemory :ignoredSos] #(prune-tick-map tick rescue-memory-ttl-ticks %))
        (update-in [:rescueMemory :helpedShips] #(prune-tick-map tick rescue-memory-ttl-ticks %))
        (#(remember-visible-markets snapshot player %))
        (#(update-route-memory cfg snapshot player %))
        (#(update-rescue-memory cfg snapshot %)))))

(defn refresh! [cfg snapshot player]
  (swap! state #(refresh cfg snapshot player %)))

(defn mission-stage [action]
  (case (:action action)
    "buy" :loading
    "sell" :unloading
    "travel" :traveling
    "move" :navigating
    "share_fuel" :sharing-fuel
    :planning))

(defn mission-from-intent [action intent]
  {:kind (:kind intent)
   :stage (or (:stage intent) (mission-stage action))
   :targetPlanetId (or (:target intent) (:targetPlanetId intent))
   :cargoPlan (when-let [item (:item intent)]
                {:item item :qty (:qty action)})
   :fallback (:fallback intent)
   :intent intent})

(defn remember-mission [memory action]
  (cond
    (:clearIntent action) (assoc memory :mission (:mission initial-state))
    (:botIntent action) (assoc memory :mission (mission-from-intent action (:botIntent action)))
    :else memory))

(defn remember-frontier [memory tick action key]
  (if (= (:action action) "move")
    (let [frontier {:key key :target (:target action) :tick tick}]
      (-> memory
          (assoc-in [:explorationMemory :lastFrontier] frontier)
          (update-in [:navigation :frontierTargets]
                     (fn [frontiers]
                       (->> (conj (vec (remove #(= (:key %) key) (or frontiers []))) frontier)
                            (take-last 12)
                            vec)))))
    memory))

(defn remember-route-submission [memory snapshot player action result]
  (if (and player (route-action? action))
    (if-let [key (route-key action)]
      (-> memory
          (assoc-in [:navigation :plannedRoute] {:fromPosition (:position player)
                                                 :key key
                                                 :queuedForTick (:queuedForTick result)})
          (remember-frontier (:tick snapshot) action key))
      memory)
    memory))

(defn remember-rescue-submission [memory snapshot action result]
  (case (:action action)
    "share_fuel" (-> memory
                     (assoc-in [:rescueMemory :activeRescue] {:targetClientId (:targetClientId action)
                                                              :queuedForTick (:queuedForTick result)
                                                              :tick (:tick snapshot)})
                     (assoc-in [:rescueMemory :helpedShips (:targetClientId action)] (:tick snapshot)))
    "move" (if (= (get-in action [:botIntent :kind]) "rescue")
             (assoc-in memory [:rescueMemory :activeRescue] {:targetClientId (get-in action [:botIntent :targetClientId])
                                                             :queuedForTick (:queuedForTick result)
                                                             :tick (:tick snapshot)})
             memory)
    memory))

(defn remember-rejection [memory snapshot action result]
  (cond
    (and (route-action? action) (route-key action)) (assoc-in memory [:navigation :failedRoutes (route-key action)] (:tick snapshot))
    (= (:action action) "share_fuel") (assoc-in memory [:rescueMemory :ignoredSos (:targetClientId action)] (:tick snapshot))
    :else memory))

(defn remember-submit-result [cfg snapshot player action result memory]
  (let [memory (normalize-memory memory)]
    (if (:accepted result)
      (-> memory
          (remember-mission action)
          (remember-route-submission snapshot player action result)
          (remember-rescue-submission snapshot action result))
      (remember-rejection memory snapshot action result))))

(defn remember-submit-result! [cfg snapshot player action result]
  (swap! state #(remember-submit-result cfg snapshot player action result %))
  result)

(defn current-intent [memory]
  (get-in memory [:mission :intent]))

(defn cfg-with-memory [cfg]
  (let [memory @state]
    (assoc cfg :memory memory :intent (current-intent memory))))