(ns bot-builder.config
  (:require [clojure.string :as str]
            ["node:crypto" :as crypto]))

(def home-planets ["earth" "mars" "jupiter"])
(def home-planet-set (set home-planets))
(def default-interval-ms 12000)
(def default-server-url "http://localhost:3000")

(def name-pools
  {"earth" ["Union Frontier Works" "Union Station Builder" "Union Deep Sky Forge"]
   "mars" ["Guild Outpost Engineer" "Guild Scaffold Master" "Guild Red Frontier"]
   "jupiter" ["League Station Architect" "League Orbital Builder" "League Far Reach"]})

(defn env [k]
  (aget (.-env js/process) k))

(defn planet-label [planet-id]
  (str (str/upper-case (subs planet-id 0 1)) (subs planet-id 1)))

(defn normalize-home [value]
  (let [home (some-> value str/lower-case)]
    (when (home-planet-set home) home)))

(defn normalize-interval [value]
  (let [parsed (js/Number value)]
    (if (and (js/Number.isFinite parsed) (>= parsed 1000))
      parsed
      default-interval-ms)))

(defn normalize-initial-delay [value interval-ms]
  (let [parsed (js/Number value)]
    (if (and (js/Number.isFinite parsed) (>= parsed 0))
      parsed
      interval-ms)))

(defn random-item [items]
  (when (seq items)
    (nth items (js/Math.floor (* (rand) (count items))))))

(defn default-name [home client-id]
  (or (random-item (get name-pools home))
      (str (planet-label home) " Builder " (subs client-id (- (count client-id) 4)))))

(defn config []
  (let [home (or (normalize-home (env "BOT_HOME_PLANET")) (random-item home-planets) "earth")
        client-id (or (env "BOT_CLIENT_ID") (str "builder-" home "-" (subs (.randomUUID crypto) 0 8)))
        interval-ms (normalize-interval (env "BOT_INTERVAL_MS"))]
    {:clientId client-id
     :homePlanetId home
     :initialDelayMaxMs (normalize-initial-delay (env "BOT_INITIAL_DELAY_MS") interval-ms)
     :intervalMs interval-ms
     :name (or (env "BOT_NAME") (default-name home client-id))
     :serverUrl (js/URL. (or (env "SPACE_SYSTEM_SERVER_URL") (env "SERVER_URL") default-server-url))}))
