            var config;
            var maps;

            var center;
            var pathArr;

            var map;
            var m1;
            var animId = null;
            var progress;

            var invader = {};

            var invaderTypes = {};

            var invaders = [];

            window.onload = function() {
                // load config files, then run
                loadConfig()
                .then(() => {
                    init();
                });
            }

            /**
             * recursive
             * update path[waypoint][dist] array
             */
            function updateDistance(path, waypoint = 0) {
                console.log('updating distance: ', waypoint);
                var next;
                for (var i=0; i<path[waypoint].next.length; i++) {
                    next = path[waypoint].next[i];
                    if (next == -1) {
                        console.log('found end from ', waypoint , ' to ', next);
                        return;
                    } else {
                        console.log('calc from ', waypoint , ' to ', next);
                        var d = distance(path[waypoint].loc, path[next].loc);
                        console.log(d);
                        console.log(path[next].dist);
                        if (path[next].dist[waypoint]) {
                            console.log('already there');
                            return;
                        }
                        path[next].dist[waypoint] = d;
                        updateDistance(path, next);
                    }
                }

            }

            function init() {

                pathArr = config.maps[0].path;
                center = config.maps[0].center;
                zoom = config.maps[0].zoom;

                // load the distances in the path array
                // each entry is the incremental distance from the previous waypoint
                updateDistance(pathArr);
                console.log(pathArr);

                map = new L.Map("mapid", {
                    center: center,
                    zoom: zoom
                });

                var layer = new L.TileLayer(config.tiles.serviceUrl, {
                    maxZoom: config.tiles.maxZoom,
                    attribution: config.tiles.attribution
                });

                // add the layer to the map
                map.addLayer(layer);

                var startingPoint = L.marker(pathArr[0].loc).addTo(map)
                    .bindPopup('Neighborhood<br/>entry point.')
                    .openPopup();

                document.getElementById('start').onclick = function(e) {
                    addInvader();
                }

                invaderTypes.green = {
                    icon: L.icon({
                        iconUrl: 'img/120px-Emblem-shamrock.svg.png',
                        iconSize: L.point(32,32)
                    })
                };

                var prev = pathArr[0].loc;
                var next = pathArr[1].loc;
                var done = false;
            }

            function addInvader(type = "green") {
                // TODO read through map to determine starting prev/nextWaypoints
                var invader = {
                    color: "green",
                    speed: 0.004,
                    segProgress: 0,
                    prevWaypoint: 0,
                    nextWaypoint: 1,
                    marker: null
                };
                invader.marker = L.marker(pathArr[0].loc, {
                    icon: invaderTypes.green.icon
                });
                invader.marker.addTo(map);

                invaders.push(invader);

                if (animId) {
                    cancelAnimationFrame(animId);
                }
                animId = requestAnimationFrame(animate); // start the first frame
            }

            var xy;

            function animate() {
                var newLoc;
                for (i=0; i<invaders.length; i++) {
                    // skip empty indexes
                    if (invaders[i]) {
                        newLoc = update(invaders[i]);
                        if (newLoc == 'finished') {
                            delete invaders[i];
                            continue;
                        }
                        render(invaders[i], newLoc);
                    }
                }

                // either re-animate, or reset
                var firstItem = invaders.find(x=>x!==undefined);
                if (firstItem) {
                    animId = requestAnimationFrame(animate); // request the next frame
                } else {
                    invaders = [];
                }
            }

            function selectNextWaypoint(invader, pathArr) {
                var choices = pathArr[invader.nextWaypoint].next;
                if (choices.length > 1) {
                    return pathArr[invader.nextWaypoint].next[getRandomInt(0, choices.length)];
                }
                return pathArr[invader.nextWaypoint].next[0];
            }

            //The maximum is exclusive and the minimum is inclusive
            function getRandomInt(min, max) {
                min = Math.ceil(min);
                max = Math.floor(max);
                return Math.floor(Math.random() * (max - min) + min);
            }

            function update(invader) {
                var xy;

                // update state
                invader.segProgress += invader.speed;

                // update nextWaypoint if reached next path point
                if (invader.segProgress >= pathArr[invader.nextWaypoint].dist[invader.prevWaypoint]) {
                    invader.segProgress -= pathArr[invader.nextWaypoint].dist[invader.prevWaypoint];
                    invader.prevWaypoint = invader.nextWaypoint;
                    invader.nextWaypoint = selectNextWaypoint(invader, pathArr);

                    if (invader.nextWaypoint == -1) {
                        // invader made it to end of path
                        // remove from invader array
                        invader.marker.remove();
                        return 'finished';
                    }
                }

                // calculate incremental segment progress
                var segDist = pathArr[invader.nextWaypoint].dist[invader.prevWaypoint];
                xy = interpolate(pathArr[invader.prevWaypoint].loc, pathArr[invader.nextWaypoint].loc, invader.segProgress/segDist);
                return xy;
            }

            function render(invader, xy) {
                // render
                invader.marker.setLatLng(xy);
            }

            /**
             * p0, p1 are arrays representing a LatLng
             * progress is a number between 0 and 1
             */
            function interpolate(p0, p1, progress) {
                var x = (p1[0] - p0[0]) * progress + p0[0];
                var y = (p1[1] - p0[1]) * progress + p0[1];
                //console.log([x,y]);
                return [x,y];
            }

            var calcLat = function() {
                return 111;
            }

            var calcLon = function(lat) {
                return Math.cos(lat*Math.PI/180) * calcLat();
            }

            /**
             * calculates distance in km
             * one degree of latitude is 111 km
             * one degree of longitude at 45 latitude is 79 km
             */
            var distance = function(p0, p1) {
                console.log(p0);
                var kmLat = calcLat();
                var kmLon = calcLon(p0[0]);

                var ydiff = (p0[0]-p1[0]) * kmLat;
                var xdiff = (p0[1]-p1[1]) * kmLon;
                var dist = Math.sqrt(xdiff*xdiff + ydiff*ydiff);
                return dist;
            }

            // get app config info
            async function getConfigFile(url = 'config/config.json', data = {}) {
                const response = await fetch(url, {
                    method: 'GET',
                    mode: 'same-origin',
                    cache: 'no-cache',
                    credentials: 'same-origin'
                });
                return response.json();
            }

            // start with config/config.json, then load other
            // configs as defined there
            async function loadConfig() {
                return await getConfigFile()
                .then(data => {
                    config = data;
                    return config.configs;
                })
                .then(configs => {
                    return Promise.all(configs.map((item, index, array) => {
                        return getConfigFile(item)
                            .then(newConfig => {
                                for (var key in newConfig) {
                                    if (config[key]) {
                                        // if existing, then merge gracefully
                                        if (config[key] instanceof Array) {
                                            config[key] = config[key].concat(newConfig[key]);
                                        } else if (typeof config[key] === 'object') {
                                            config[key] = {...config[key], ...newConfig[key]};
                                        } else {
                                            console.log('config parsing error');
                                            console.log(typeof config[key]);
                                        }
                                    } else {
                                        // if not existing, then assign from new
                                        config[key] = newConfig[key];
                                    }
                                }
                            });
                    }));
                })
            }
