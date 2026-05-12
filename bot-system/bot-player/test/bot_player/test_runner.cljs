(ns bot-player.test-runner
  (:require [bot-player.economy-test]
            [bot-player.geometry-test]
            [bot-player.memory-test]
            [bot-player.navigation-test]
            [cljs.test :refer [run-tests]]))

(defn -main [& _args]
  (let [summary (run-tests 'bot-player.economy-test
                           'bot-player.geometry-test
                           'bot-player.memory-test
                           'bot-player.navigation-test)
        failures (+ (:fail summary) (:error summary))]
    (when (pos? failures)
      (set! (.-exitCode js/process) 1))))