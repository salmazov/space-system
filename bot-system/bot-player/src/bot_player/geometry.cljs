(ns bot-player.geometry)

(defn distance [from to]
  (js/Math.hypot (- (:x from) (:x to)) (- (:z from) (:z to))))

(defn explored? [areas position extra-radius]
  (boolean
    (some (fn [area]
            (<= (distance (:center area) position)
                (+ (:radius area) extra-radius)))
          areas)))

(defn world-bounds [planets]
  (reduce (fn [bounds planet]
            (let [{:keys [x z]} (:position planet)]
              (-> bounds
                  (update :min-x min x)
                  (update :max-x max x)
                  (update :min-z min z)
                  (update :max-z max z))))
          {:min-x -10 :max-x 10 :min-z -8 :max-z 8}
          planets))