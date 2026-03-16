import json
from pynput import mouse, keyboard
from threading import Lock
from datetime import datetime
import re
import os


data = {
    "left_clicks": 0,
    "keypresses": 0,
    "mouse_movements": 0,
}
lock = Lock()
event_count = 0

def save_data():
    print("Saving data to file...")
    entry = {
        "timestamp": datetime.now().isoformat(),
        "left_clicks": data["left_clicks"],
        "keypresses": data["keypresses"],
        "mouse_movements": data["mouse_movements"],
    }

    with open(filename, "a") as f:
        json.dump(entry, f)
        f.write("\n")
    # Reset counters after saving
    data["left_clicks"] = 0
    data["keypresses"] = 0
    data["mouse_movements"] = 0
    print("Data saved successfully.")

def check_save():
    global event_count
    event_count += 1
    if event_count >= 500:
        save_data()
        event_count = 0

def on_click(x, y, button, pressed):
    if not pressed:
        return
    with lock:
        if button == mouse.Button.left:
            data["left_clicks"] += 1
        check_save()

def on_move(x, y):
    with lock:
        data["mouse_movements"] += 1
        check_save()

def on_press(key):
    with lock:
        data["keypresses"] += 1
        check_save()
save_dir = "activity_data"
if not os.path.exists(save_dir):
    os.makedirs(save_dir)
#filename = os.path.join(save_dir, f"activity_data_{datetime.now().strftime('%Y%m%d%H%M%S')}.json")
filename = os.path.join(save_dir, f"activity_data.json")
print(filename)


mouse_listener = mouse.Listener(on_click=on_click, on_move=on_move)
key_listener = keyboard.Listener(on_press=on_press)

mouse_listener.start()
key_listener.start()

try:
    mouse_listener.join()
    key_listener.join()
except KeyboardInterrupt:
    save_data()