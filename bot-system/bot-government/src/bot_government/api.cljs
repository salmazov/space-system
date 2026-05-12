(ns bot-government.api)

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
    "buy" (str "bulk buy " (:qty action) " " (:item action))
    "sell" (str "bulk sell " (:qty action) " " (:item action))
    "travel" (str "travel to " (:target action))
    "sos" "broadcast SOS"
    "wait" "wait"
    (:action action)))

(defn server-action [action]
  (dissoc action :governmentIntent))

(defn decision-metadata [cfg action]
  (cond-> {:source "bot-government"
           :summary (describe-action action)
           :homePlanetId (:homePlanetId cfg)}
    (:governmentIntent action) (assoc :intent (:governmentIntent action))))

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
