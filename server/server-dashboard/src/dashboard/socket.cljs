(ns dashboard.socket
  (:require [dashboard.dom :as dom]
            [dashboard.render :as render]))

(defn websocket-url [path]
  (let [location (.-location js/globalThis)
        protocol (if (= (.-protocol location) "https:") "wss:" "ws:")]
    (str protocol "//" (.-host location) path)))

(defn update-status! [elements connected?]
  (dom/set-text! (:status elements) (if connected? "Connected" "Reconnecting"))
  (set! (.-className (:status elements)) (if connected? "status connected" "status disconnected")))

(declare connect-dashboard-socket!)

(defn reconnect! [elements]
  (update-status! elements false)
  (js/setTimeout #(connect-dashboard-socket! elements) 1000))

(defn connect-dashboard-socket! [elements]
  (let [socket (js/WebSocket. (websocket-url "/ws?client=dashboard"))]
    (.addEventListener socket "open" #(update-status! elements true))
    (.addEventListener socket "message" (fn [event]
                                           (let [message (dom/js-value->clj (js/JSON.parse (.-data event)))]
                                             (when (= (:type message) "world")
                                               (render/render-world (:payload message) elements)))))
    (.addEventListener socket "close" #(reconnect! elements))
    (.addEventListener socket "error" (fn [_]
                                        (update-status! elements false)
                                        (.close socket)))))
