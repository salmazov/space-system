(ns dashboard.app
  (:require [dashboard.dom :as dom]
            [dashboard.socket :as socket]))

(defonce elements (dom/dashboard-elements))

(socket/connect-dashboard-socket! elements)
