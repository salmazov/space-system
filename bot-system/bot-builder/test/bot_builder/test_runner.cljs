(ns bot-builder.test-runner
  (:require [bot-builder.strategy-test]
            [cljs.test :refer [run-tests]]))

(defn -main []
  (let [summary (run-tests 'bot-builder.strategy-test)]
    (when (pos? (+ (:fail summary) (:error summary)))
      (.exit js/process 1))))
