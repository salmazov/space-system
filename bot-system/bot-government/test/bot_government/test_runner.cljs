(ns bot-government.test-runner
  (:require [bot-government.strategy-test]
            [cljs.test :refer [run-tests]]))

(defn -main []
  (let [summary (run-tests 'bot-government.strategy-test)]
    (when (pos? (+ (:fail summary) (:error summary)))
      (.exit js/process 1))))
