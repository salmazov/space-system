(ns bot-fleet.main
  (:require [clojure.string :as str]
            ["node:child_process" :as child-process]
            ["node:fs" :as fs]
            ["node:path" :as path]))

(def default-factions ["earth" "mars" "jupiter"])
(def default-per-faction 10)
(def default-interval-ms 9000)
(def default-server-url "http://localhost:3000")
(def default-stagger-ms 80)
(def default-balancer-ratio 0.3)
(def npm-command (if (= (.-platform js/process) "win32") "npm.cmd" "npm"))
(def children (atom []))

(def name-pools
  {"earth" ["Ragnar WiFi-Bane"
             "Bjorn Tax-Splitter"
             "Astrid Cloud-Hammer"
             "Leif Inbox-Burner"
             "Freydis Scrum-Breaker"
             "Olaf VPN-Seer"
             "Sigrid Budget-Axe"
             "Harald Meeting-Slayer"
             "Ingrid Deploy-Shield"
             "Erik Password-Finder"]
   "mars" ["Aristotle Feta Luxe"
            "Athena Truffle-Gyro"
            "Odysseus Olive Supreme"
            "Hera Baklava Prime"
            "Apollo Saganaki Gold"
            "Persephone Pita Royale"
            "Zeus Tzatziki Velvet"
            "Dionysios Honey-Feta"
            "Plato Pantry Deluxe"
            "Calliope Citrus Mezze"]
   "jupiter" ["Baron Redspot"
               "Professor Thunderpants"
               "Countess Orbit-Nacho"
               "Lord Nimbus Fizz"
               "DJ Moon Buffet"
               "Comet Permit Officer"
               "Admiral Soup Horizon"
               "Sir Vortex Pancake"
               "Quantum Snack Duke"
               "Great Spot Accountant"]})

(defn env [k]
  (aget (.-env js/process) k))

(defn parse-number [value fallback]
  (let [parsed (js/Number value)]
    (if (and (js/Number.isFinite parsed) (pos? parsed))
      parsed
      fallback)))

(defn parse-int [value fallback]
  (max 1 (js/Math.floor (parse-number value fallback))))

(defn parse-non-negative-int [value fallback]
  (let [parsed (js/Number value)]
    (if (and (js/Number.isFinite parsed) (>= parsed 0))
      (js/Math.floor parsed)
      fallback)))

(defn parse-ratio [value fallback]
  (let [parsed (parse-number value fallback)]
    (max 0 (min 1 parsed))))

(defn parse-list [value fallback]
  (let [items (some->> value
                       (#(str/split % #","))
                       (map str/trim)
                       (remove str/blank?)
                       (map str/lower-case)
                       distinct
                       vec)]
    (if (seq items) items fallback)))

(defn planet-label [planet-id]
  (str (str/upper-case (subs planet-id 0 1)) (subs planet-id 1)))

(defn themed-name [faction index]
  (let [names (get name-pools faction [(str (planet-label faction) " Oddjob")])
        base (nth names (mod index (count names)))
        repeat-number (quot index (count names))]
    (if (zero? repeat-number)
      base
      (str base " " (inc repeat-number)))))

(defn package-json [dir]
  (let [file-path (.join path dir "package.json")]
    (when (.existsSync fs file-path)
      (js->clj (js/JSON.parse (.readFileSync fs file-path "utf8")) :keywordize-keys true))))

(defn repo-root []
  (loop [dir (.cwd js/process)]
    (let [parent (.dirname path dir)]
      (cond
        (some? (:workspaces (package-json dir))) dir
        (= dir parent) (.cwd js/process)
        :else (recur parent)))))

(defn config []
  (let [interval-ms (parse-int (or (env "FLEET_BOT_INTERVAL_MS") (env "BOT_INTERVAL_MS")) default-interval-ms)]
    {:factions (parse-list (env "FLEET_FACTIONS") default-factions)
     :interval-ms interval-ms
     :initial-delay-ms (parse-non-negative-int (or (env "FLEET_BOT_INITIAL_DELAY_MS") (env "FLEET_INITIAL_DELAY_MS") (env "BOT_INITIAL_DELAY_MS")) interval-ms)
     :balancer-ratio (parse-ratio (env "FLEET_BALANCER_RATIO") default-balancer-ratio)
     :per-faction (parse-int (env "FLEET_PER_FACTION") default-per-faction)
     :run-id (.toString (js/Date.now) 36)
     :server-url (or (env "FLEET_SERVER_URL") (env "SPACE_SYSTEM_SERVER_URL") (env "SERVER_URL") default-server-url)
     :stagger-ms (parse-int (env "FLEET_STAGGER_MS") default-stagger-ms)}))

(defn bot-env [cfg faction index bot-name]
  (let [env-object (js/Object.assign #js {} (.-env js/process))
        bot-number (inc index)
  balancer-count (js/Math.ceil (* (:per-faction cfg) (:balancer-ratio cfg)))
        bot-id (str "fleet-" faction "-" (:run-id cfg) "-" bot-number)]
    (aset env-object "BOT_CLIENT_ID" bot-id)
    (aset env-object "BOT_HOME_PLANET" faction)
    (aset env-object "BOT_INITIAL_DELAY_MS" (str (:initial-delay-ms cfg)))
    (aset env-object "BOT_INTERVAL_MS" (str (:interval-ms cfg)))
    (aset env-object "BOT_NAME" bot-name)
    (aset env-object "BOT_URGENCY" (if (< index balancer-count) "0.85" "0.2"))
    (aset env-object "SPACE_SYSTEM_SERVER_URL" (:server-url cfg))
    env-object))

(defn spawn-bot! [root cfg faction index]
  (let [bot-name (themed-name faction index)
        child (.spawn child-process
                      npm-command
                      #js ["-w" "space-system-bot-player" "run" "start"]
                      #js {:cwd root
                           :env (bot-env cfg faction index bot-name)
                           :stdio "inherit"})]
    (.on child "exit" #(js/console.log (str bot-name " exited with code " %1)))
    child))

(defn launch-fleet! [root cfg]
  (let [bots (for [faction (:factions cfg)
                   index (range (:per-faction cfg))]
               [faction index])]
    (doseq [[offset [faction index]] (map-indexed vector bots)]
      (js/setTimeout #(swap! children conj (spawn-bot! root cfg faction index)) (* offset (:stagger-ms cfg))))
    (count bots)))

(defn stop-fleet! []
  (doseq [child @children]
    (when-not (.-killed child)
      (.kill child "SIGINT"))))

(defn -main [& _args]
  (let [cfg (config)
        root (repo-root)
        total (launch-fleet! root cfg)]
    (js/console.log (str "Launching " total " bots across " (str/join ", " (:factions cfg)) " at " (:server-url cfg) " with first-action jitter up to " (:initial-delay-ms cfg) "ms"))
    (.once js/process "SIGINT" (fn []
                    (js/console.log "Stopping bot fleet.")
                    (stop-fleet!)
                                  (js/setTimeout (fn [] (.exit js/process 0)) 600)))
    nil))