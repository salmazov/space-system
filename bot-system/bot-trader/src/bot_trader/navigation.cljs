(ns bot-trader.navigation
  (:require [space-system.rules.navigation :as shared]))

(def fuel-needed shared/fuel-needed)

(def enough-fuel? shared/enough-fuel?)

(def sos-signals shared/sos-signals)

(def reachable-sos shared/reachable-sos)