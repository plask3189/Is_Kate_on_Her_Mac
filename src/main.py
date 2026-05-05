import json
from pynput import mouse, keyboard
from threading import Lock
from datetime import datetime
import re
import os


data = {
    "mouse_movements": 0,
}

lock = Lock()
event_count = 0

def save_data():
    print("Saving data to file...")
    entry = {
        "timestamp": datetime.now().isoformat(),
        "mouse_movements": data["mouse_movements"],
    }

    with open(filename, "a") as f:
        json.dump(entry, f)
        f.write("\n")
    # Reset counters after saving
    data["mouse_movements"] = 0
    print("Data saved successfully.")

def check_save():
    global event_count
    event_count += 1
    if event_count >= 1000:
        save_data()
        event_count = 0

def on_move(x, y):
    with lock:
        data["mouse_movements"] += 1
        check_save()

save_dir = "activity_data"
if not os.path.exists(save_dir):
    os.makedirs(save_dir)
#filename = os.path.join(save_dir, f"activity_data_{datetime.now().strftime('%Y%m%d%H%M%S')}.json")
filename = os.path.join(save_dir, f"activity_data.json")
print(filename)

mouse_listener = mouse.Listener(on_move=on_move)
mouse_listener.start()

try:
    mouse_listener.join()

except KeyboardInterrupt:
    save_data()