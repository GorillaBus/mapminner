# Map Miner

Collect public traffic data from mapping services and generate statistic data.


# Document index

1. What it does?
2. Terms of use
3. Status
4. How it works
5. Requirements
6. How do I install and set it up?
6.  1. Install
6.  2. Settings
6.  3. Define a Map Model
6.  4. Generate the map model
7. Map Miner commands
7.  1. Generating the zone bitmaps
7.  2. Registering bitmaps
7.  3. Generate and register
7.  4. Fetch bitmaps from FTP
7.  5. Maintenance
8. Different setups
9. Settings file: detailed explanation
9. FAQ



# 1. What it does

Map Miner **reads** publicly exposed traffic information from mapping services, **records** the state for defined map Zones and **generates** statistics.


# 2. Terms of use

This software was created as part of a personal research and it is published to be used with the same purpose.

If you use this software you agree that:

1. This software is for personal use only.
2. You are not going to use this software for commercial applications.
3. You will use the generated data or content under the terms of the source (Google Maps).
4. I'm not responsible for the use you give to this software.
5. This software comes with no guarantee.


# 3. Status

This application is in it's very early state, and if you are reading this, then this is the first publication of the code.
You are welcome to contribute if you find a better way to organize the code, better architecture, errors or to provide a better solution for any aspect of the software.


# 4. How it works

Map Miner will connect to Google Maps API and capture a screenshot of the map rendered by the service for each of the predefined map 'Zones'. Will then divide each bitmap (PNG) into *n* subdivisions (called 'Areas') and generate a *traffic score* for each of the Areas.

So, what is a 'Zone' in Map Miner? A map Zone is a squared area in the map specified by Longitude and Latitude. The size of a zone depends on the *projection* of the area of the world you are working on (see the FAQ for more details).

Each Zone will be divided into Areas. The more divisions a Zone has, the more resolution you will get. By default Map Miner expects 64 areas per Zone.

You can then generate aggregated information for statistical analysis. Right now Map Miner will give you the average hourly traffic score for each Area in CSV format, ready to be used in R, Python or any other thing you like.

*note* that at the moment, it is up to you to generate and define Zones and Areas. This involves GIS knowledge, projections and some tests to see if your zones fit the Google Maps window to be captured (see FAQ).


# 5. Requirements

Recommended:
* i7 with 16gb RAM
* A Linux or Unix-like operating system. Should work perfectly on Mac OS also - Tested on Fedora 25/26/27.
* [MongoDB!](https://www.mongodb.com/) - Tested on version 3.4.6
* [NodeJS!](https://nodejs.org/) - Tested on version 8.9.1
* Other dependencies are installed via NPM.

Should work ok on an i5 with 8gb RAM.
Disk space depends on the use case.

Windows systems are not in the scope, if you want to give support for windows feel free to contribute with code.


# 6. How do I install and set everything up?

## 6.1 Install

Clone this repo on the computer you would like to use and run *npm install* to install dependencies.
Make sure MongoDB service is up and running and NodeJS is correctly installed on your box.


## 6.2 Settings

Copy the /config/settings.json.default to /config/settings.json.
You can find a full definition of the config file on this chapter 9, but the most important to make it run is:

MongoDB: set host and port. If you need auth set your user and password also.
Mining: add your own Google Maps API key.


## 6.3 Define a Map Model

A map model describes the Zones to be analyzed by the application and their subdivisions (referred to as 'Areas'). At the moment Map Miner does not provide an UI to define the map model, you may use your preferred GIS tools to define Zones and Areas and export them as JSON.

The structure of a map model file is the following:

[{
  "code": <string>,			A unique code to identify zones on external applications
  "lat": <float>,			Zone's center point coordinate component 1
  "long": <float>,			Zone's center point coordinate component 2
  "areas":[{				Array of Area objects
    "id": <int>,			A unique ID to identify Areas on external applications
    "long": <float>,			Area's center point coordinate component 1
    "lat": <float>			Area's center point coordinate component 2
   },{
    ...
   }]
}]

Think of a Zone as a buffer in the map and of Areas as smaller buffers inside the Zone.

There is an example map model file in the map-data/ called "obelisco.json". That map model will create a single Zone with the center in Buenos Aires, over the Obelisco monument (a very hot spot in the city). This Zone is divided into an 8x8 grid (64 areas). Read on to learn how to use it.


When creating your own map model, keep in mind:

1. Map Miner will always request the Google Maps API to render 640x640 maps with a zoom level of 15 *this is mandatory as when in zoom level 15 all streets show traffic data*. The example map model (obelisco.json) creates a Zone of 1.5km * 1.5km. This size is fine to work with the coordinate projection used in Buenos Aires but it won’t work for other areas. Keep reading to learn how to size zones for other areas of the globe.

*YES* this can be tricky but I will automate this step on future updates, promised.

2. Be sure to position your zones so that they don't overlap.
2. A zone must be divided in **n** areas: the same way you defined Zones, you should define the areas inside them providing lat/long.
3. You can divide a large space (like a city) in consecutive zones (like a grid) or you can mine data from different, non-consecutive zones.


If you are going to create the map model from an R or Python script, follow this steps:

1. Find the correct projection to convert from Lat/Long to meters in the area of the globe you are working on.
2. Define the Longitude and Latitude of the center point of any place in the map from where you wish to start.
3. Create a squared buffer with the correct size (should fit 100% of the 640x640 Google Maps window with zoom=15). In R you can use GGMAP package, create a buffer and print it on the map until you see it covers 100%. Oh, and if you are a math mastermind and can convert pixels to meters using the projections, please share the solution with me so I can implement it faster.
4. Give a unique 'code' to that zone (must be alphanumerical only).
5. Divide that buffer into a N x N grid, for example: 8x8 (64 divisions).
6. Find the Latitude and Longitude for the center point of each of the grid's squares (Areas).
7. Define a unique ID for each division.

Usually map model files are saved on the "map-data/" directory. If you generate a map model for your city please share push it :)


## 6.4 Generate the map model

Once you have your map model file in the correct JSON format and the software is installed and configured, generate the map model with the following command:

  node app.js --svc Controller --req createMapModel --params *<path-to-map-model>*

This will create two collections in MongoDB: Zones and Areas.

At this point the system is ready to start generating traffic data.


# 7. Map Miner commands

Normally you will run a cronjob on your box to generate data periodically, in any case, use this commands:


## 7.1 Generating the zone bitmaps

  node app.js --svc Controller --req generate --params *<path-to-map-model>*

It will launch a static web server to serve the map-displaying html file, and once running, will connect to the Google Maps API and generate a bitmap file for each of the defined Zones -containing the current traffic state-. All files will be saved in the temporal bitmap directory (by default 'bmp.tmp/'). Each file contains a timestamp and a Zone code in its file name.

*note:* if you want you can use your own http server, check the "Different setups" chapter.


## 7.2 Registering bitmaps

Once you have bitmaps in the temporal directory you can register them:

  node app.js --svc Controller --req register

This will read and interpret the pixel data of all the bitmap files inside the  directory and will save the state of each area as a *score* with a time stamp. Once registered the bitmaps are moved to the predefined main directory (by default 'bmp/')


## 7.3 Generate and register combo

I recommend to have two separated cronjobs: one that will periodically generate bitmaps and another -that may run with less frequency- that will register the contents inside the temporal directory.

If you prefer to Generate and just after that Register, use this:

  node app.js --svc Controller --req generateAndRegister


## 7.4 Fetch bitmaps from FTP

You may have this code deployed on a remote server to generate the bitmaps on the remote storage but would like to register the files locally. In that case, create a cronjob with the following command to periodically fetch all remote bitmaps via FTP:

  node app.js --svc Controller --req fetch

And if you like to fetch and register immediately, use:

  node app.js --svc Controller --req fetchAndRegister

Check the 'Different setups' chapter.


## 7.5 Maintenance

Map Miner will create indexes in MongoDB collections for performance. This indexes should be re-generated from time to time using:

  node app.js –svc Maintainer –req reIndex

(it can take a while, be patient)


If any error happens during bitmap registration the DB could get inconsistent. Map Miner can detect and solve this automatically if you use the setting:

  register.auto_rapair_database = true

You can also manually analyze and repair the DB with:

  node app.js --svc Maintainer --req reshapeDb


To create a new map model:

  node app.js --svc Maintainer --req createMapModel --params <path-to-map-model>


When you are generating bitmaps remotely, all files transferred to local storage with Controller::fetch() are also saved on the remote "bkp/" directory.
Using this command Map Miner will connect to the remote storage, verify if the backed-up files have all been registered locally and if some were missed/skipped by any reason it will download and register it:

  node app.js --svc Maintainer --req verifyFromBkp


# 8. Different setups


Cronjob schemas

All-in-one: create a unique cronjob that periodically run the "generateAndRegister" command. If you want hourly averages schedule 60 min executions (or less).

Combined: use two cronjobs, one that generates periodically and another that will register all generated files one or two times a day.


Remote generate

You can always deploy Map Miner on a remote server and set a cronjob to generate the bitmaps. In that case you can then install a local copy of Map Miner and set it up to collect the bitmaps via FTP and register on the local database.

On the remote system: set paths.remote_bmp and paths.remote_bmp_bkp, and make sure you have write access on them.
On the local Map Miner: set ftp.host, ftp.port, ftp.user and ftp.pass. ftp.secure is true by default. If ftp.batch is set then Map Miner will only download as many bitmaps as zones exist, else, if will download all files found (recommended).


# 9. Settings file: detailed explanation

mongodb:
 host: server ip/host
 port: server port
 db: database name, default is "map miner"
 user: username (if no auth leave blank)
 pass: password (if no auth leave blank)

paths:
 bmp: main (registered) bitmap storage directory
 bmp_temp: temporal (unregistered) bitmap storage directory.
 remote_bmp: used by the FTP client to find remote generated bitmaps
 remote_bmp_bkp: used by remote

mining:
 use_native_server: if true will use a static http server to serve the html file that displays the map
 service_url: if 'use_native_server' is false, provide the URL to the html file
 user_agent: if you want to use a specific user-agent set it here
 delay: delay between generating each bitmap, 4-5 is safe
 timeout: how much to wait for the generate process to finish before considering an possible error
 size: default size of the bitmaps (may be equal to the API's map size)
 api_key: your Google Maps API key

map:
 zones: how many zones are you using?
 areas_per_zone: how many divisions does your Zones have?

http:
 root: the directory that hold the static html file that displays the map
 port: server port to be used
 host: interface you would like to use
 index: html file with customized API settings that displays the map

ftp:
 use_ftp: tells Map Miner you are using collecting bitmaps from a remote FTP server
 host: server ip/host
 user: ftp username
 pass: ftp password
 secure: uses secure ftp connection
 batch: will only download as many bitmaps as zones exists

register:
 auto_repair_db: will attempt to repair the db whenever an inconsistency error is found
 log_upsert: the state of each area is saved in as a mongodb document called "Log". When set to true it will check if a Log exists before creation, and if positive, will update it. Else, if will insert a new one and duplicates (and inconsistency) may occur in same scenarios (no worries, Map Miner can solve inconsistency errors). If your system is slow set this to false and  auto_repair_db to true
 queue_max: maximum simultaneous registrations

logging:
 file: path to the log file
 max_size: maximum size before archiving
 compress: do you want to compress archived logs?
 stdout: will also log to standard output

language:
 week_days: name of the week days that will appear on the exported dataset
 months: name of the months that will appear in the exported dataset


# 10. Exporting the data

You can create a CSV dataset with the aggregated information that will give the hourly average traffic score for each area, grouped by day, month and year.

To do this run the shell script:

 ./export.sh <filename>

The dataset will be saved in the csv/ directory. Make sure you have execute permission on this file, if not sure run:

  chmod u+x export.sh

More exporting options coming soon!



# 11. FAQ

Q: Is Map Miner legal?

A: It is legal as long as you use it for personal purposes. If you give any other use to the software or to the generated data/contents you should check the Terms and Conditions of the Google Maps API to verify if your activity is legal. Remember you are responsible for what you use this software for.


Q: Why did you created this app?

A: I'm studding the different variables that impact on air pollution in the cities and I needed more accurate traffic data as this is -at least in most cities- the variable that better explain the air quality measurements.


Q: Do you sell traffic data?

A: No. I only collected data for my study.


Q: Why does Map Miner uses a default zoom size of 15 when connecting to the Google Maps API?

A: This is the smallest zoom value at which the Google Maps API will show traffic data for all of the displayed streets. But this is not mandatory, you can play around with zoom levels an also with the map size to find configurations that better suit the area of the globe you are studding. If you find something interesting please share it!


Q: Will you make Zone and Area definition easier in the future?

A: Yes. I will add an UI to create the map model in future releases when Map Miner will become a full featured web application.


Q: How does Map Miner generate the traffic score?

A: It will read pixel by pixel of the generated bitmaps and detect which are of the colors that represent the Low, Mid and High values (green, orange and red) and multiplies each pixel count by a factor of 1, 2 and 3 cor-relatively.

Q: I still don't get it, how do I create the map model for a specific area in the globe?

A: The globe is not a perfect sphere, there are elevations and there are falls. The different terrain configurations require the use of specific coordinate systems that will produce more precise measures on the area.
In GIS (Geographical Information Systems) you use projections to convert from one coordinate system to another, this way you can convert from Lat/Long to Meters and measure the distance between two different points in the map given their coordinates.

This is why the size in meters of the area represented in a 640x640 Google Map at zoom level 15 will differ from one region to another, for example, while this configuration is equivalent to a  squared area of 1.500mts x 1.500mts (approx) in Buenos Aires, Argentina, when you get a map with same configurations in La Havana, Cuba, the represented area will be much smaller. That is why you can't just go and define 1.5km * 1.5km Zones and get Map Miner working world wide: you need to understand projections and you need to calculate the area that will be covered, using the correct projection, by the 640x640 map in the region of the globe you want to work on.

It may be tricky at first but burn your eyes reading for a couple of days and it will turn to be as easy as counting with your fingers (yeah, I'm being optimistic :])
