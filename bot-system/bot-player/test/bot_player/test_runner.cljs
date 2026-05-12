(ns bot-player.test-runner
  (:require [bot-player.memory-test]
            [bot-player.world-test]
            [cljs.test :refer [run-tests]]))

(defn -main [& _args]
  (let [summary (run-tests 'bot-player.memory-test 'bot-player.world-test)
        failures (+ (:fail summary) (:error summary))]
    (when (pos? failures)
      (set! (.-exitCode js/process) 1))))