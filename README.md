# Is Kate on her Mac? 

Make python env (Python 3.14.0)

```
cd "mac_activity_tracker-2"
source venv/bin/activate
python3 src/main.py
python3 src/server.py src/dashboard.html
```

Also some of this is fs vibe coded

## To Do:
- Add a little extra space on heatmap between Friday and Monday.
- Account for missed days for barplot stats
- only keep the old necessary data. I think we could make a json file with the stats we need for the plots. Then reset the activity_data.json at EOD after saving the summary stats to the summary_activity_data.json.
-view of the heatmap should be autoscrolled to have 7 am all the way to the left
- maybe rewrite in AppleScript
- make mac application 
- Store date as UTC and make feature to select which time zone.