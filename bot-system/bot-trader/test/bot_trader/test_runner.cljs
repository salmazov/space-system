(ns bot-trader.test-runner
  (:require [bot-trader.economy-test]
            [bot-trader.geometry-test]
            [bot-trader.memory-test]
            [bot-trader.navigation-test]
            [bot-trader.strategy-test]
            [cljs.test :refer [run-tests]]))

(defn -main [& _args]
  (let [summary (run-tests 'bot-trader.economy-test
                           'bot-trader.geometry-test
                           'bot-trader.memory-test
                           'bot-trader.navigation-test
                           'bot-trader.strategy-test)
        failures (+ (:fail summary) (:error summary))]
    (when (pos? failures)
      (set! (.-exitCode js/process) 1))))