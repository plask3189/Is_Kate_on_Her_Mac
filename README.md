# Is Kate on her Mac? 

After making python env (Python 3.14.0)

```
cd "mac_activity_tracker-2"
source venv/bin/activate
python3 src/main.py
python3 src/server.py src/dashboard.html
```
Also this is mostly vibe coded

## To Do:
- Make heatmap and barplot side by side. probably will need to flip the barplot axes.
- Most likely start time
- Most likey end time
- Account for missed days for barplot stats
- only keep the old necessary data.
-  ridge plot of all actiity data over all weekdays, where the x axis is day and the y axis is activity level 
-view of the heatmap should be autoscrolled to have 7 am all the way to the left