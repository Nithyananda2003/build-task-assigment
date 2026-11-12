CREATE TABLE completions (
  user_id TEXT NOT NULL,
  day TEXT NOT NULL,
  points INTEGER NOT NULL CHECK(points BETWEEN 10 AND 25),
  correct INTEGER NOT NULL CHECK(correct BETWEEN 0 AND 3),
  answers TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, day),
  CHECK(points = 10 + correct * 5)
);
