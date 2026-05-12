(ns bot-trader.api)

(defn endpoint [{:keys [serverUrl]} path]
  (js/URL. path serverUrl))

(defn fetch-json [url]
  (-> (js/fetch url)
      (.then (fn [response]
               (if (.-ok response)
                 (.json response)
                 (throw (js/Error. (str "State request failed: HTTP " (.-status response)))))))
      (.then #(js->clj % :keywordize-keys true))))

(defn fetch-world [cfg]
  (let [url (endpoint cfg "/bot-state")]
    (.set (.-searchParams url) "clientId" (:clientId cfg))
    (fetch-json url)))

(defn describe-action [action]
  (case (:action action)
    "buy" (str "buy " (:qty action) " " (:item action))
    "sell" (str "sell " (:qty action) " " (:item action))
    "move" (str "move to x " (.toFixed (get-in action [:target :x]) 1) ", z " (.toFixed (get-in action [:target :z]) 1))
    "travel" (str "travel to " (:target action))
    "sos" "broadcast SOS"
    "share_fuel" (str "share " (:qty action) " fuel with " (:targetClientId action))
    (:action action)))

(defn server-action [action]
  (dissoc action :botIntent :clearIntent))

(defn compact-memory [memory]
  (let [navigation (:navigation memory)
        rescue (:rescueMemory memory)]
    {:mission (:mission memory)
     :strategy (:strategy memory)
     :navigation {:plannedRoute (:plannedRoute navigation)
                  :failedRouteCount (count (:failedRoutes navigation))
                  :successfulRouteCount (count (:successfulRoutes navigation))
                  :frontierCount (count (:frontierTargets navigation))}
     :rescue {:activeRescue (:activeRescue rescue)
              :ignoredSosCount (count (:ignoredSos rescue))
              :helpedShipCount (count (:helpedShips rescue))}}))

(defn decision-metadata [cfg action]
  (cond-> {:source "bot-trader"
           :summary (describe-action action)}
    (:botIntent action) (assoc :intent (:botIntent action))
    (:clearIntent action) (assoc :clearIntent true)
    (:intent cfg) (assoc :activeIntent (:intent cfg))
    (:memory cfg) (assoc :memory (compact-memory (:memory cfg)))))

(defn submit! [cfg world action]
  (let [action-for-server (server-action action)]
    (-> (js/fetch (endpoint cfg "/actions")
                  (clj->js {:method "POST"
                            :headers {"Content-Type" "application/json"}
                            :body (js/JSON.stringify (clj->js (assoc action-for-server
                                                                 :clientId (:clientId cfg)
                                                                 :botDecision (decision-metadata cfg action))))}))
      (.then (fn [response]
               (-> (.json response)
                   (.then (fn [body] [response (js->clj body :keywordize-keys true)])))))
      (.then (fn [[response result]]
               (if (and (.-ok response) (:accepted result))
                 (js/console.log (str "[tick " (:tick world) "] queued " (describe-action action-for-server) " for tick " (:queuedForTick result)))
                 (js/console.log (str "[tick " (:tick world) "] rejected " (:action action-for-server) ": " (or (:reason result) "unknown"))))
               result)))))