            var config;
            var maps;

            var center;
            var pathArr;

            var map;
            var m1;
            var animId = null;
            var progress;

            var score = 0;
            var lives = 20;

            var invader = {};

            var invaderTypes = {};

            // array of current invaders on-screen
            var invaders = [];

            // array of towers on-screen
            var towers = [];

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
                invaderTypes = config.invaderTypes;

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

                // materialize invaderType icons
                for (var inv in invaderTypes) {
                    invaderTypes[inv].icon = L.icon({
                        iconUrl: invaderTypes[inv].iconUrl,
                        iconSize: L.point(invaderTypes[inv].iconSize)
                    });
                }

                // capture invaderType names for selection
                var invaderNames = [];
                for (var key in invaderTypes) {
                    invaderNames.push(key);
                }

                // define onclick action for start button
                document.getElementById('start').onclick = function(e) {
                    var invaderName = invaderNames[getRandomInt(0, invaderNames.length)];
                    addInvader(invaderName);
                }

                var prev = pathArr[0].loc;
                var next = pathArr[1].loc;
                var done = false;

                addTower();


            }

            function addTower(type = "default") {

                var tower = {
                    loc: [44.31290, -88.345160],
                    range: 0.050,
                    rechargeTime: 60,
                    charge: 0,
                    marker: null
                };

                var towerIcon = L.icon({
                    iconUrl: "img/96px-Jar.svg.png",
                    iconSize: L.point([32,32])
                });

                tower.marker = L.marker([44.31290, -88.345160], {
                    icon: towerIcon
                });
                tower.marker.addTo(map);

                // TODO change this to a tower object
                towers.push(tower);
            }

            function addInvader(type = "green") {
                // TODO get starting point(s) from map config
                var invader = {
                    loc: [],
                    speed: 0.001,
                    segProgress: 0,
                    prevWaypoint: 0,
                    nextWaypoint: 1,
                    marker: null
                };
                Object.assign(invader, invaderTypes[type]);

                invader.loc = pathArr[0].loc;
                invader.marker = L.marker(pathArr[0].loc, {
                    icon: invader.icon
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
                        newLoc = updateInvader(invaders[i]);
                        if (newLoc == 'finished') {
                            delete invaders[i];
                            updateLives();
                            continue;
                        }
                    }
                }

                var kill;
                for (i=0; i<towers.length; i++) {
                    if (towers[i]) {
                        kill = updateTower(towers[i]);
                        if (kill !== null) {
                            invaders[kill].marker.remove();
                            delete invaders[kill];
                            updateScore();
                            continue;
                        }
                    }
                }

                for (i=0; i<invaders.length; i++) {
                    if (invaders[i]) {
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

            function updateScore() {
                score += 1;
                var el = document.getElementById('score');
                el.innerText = score;
            }

            function updateLives() {
                lives -= 1;
                var el = document.getElementById('lives');
                el.innerText = lives;
            }

            function updateTower(tower) {
                //console.log(tower);

                tower.charge += 1;
                if (tower.charge < tower.rechargeTime) {
                    return null;
                }

                //console.log('tower charged');

                for (var i=0; i<invaders.length; i++) {
                    if (invaders[i]) {
                        //console.log('checking tower against invader', i);
                        if (checkHit(tower, invaders[i])) {
                            tower.charge = 0;
                            return i;
                        }
                    }
                }
                return null;
            }

            function checkHit(tower, invader) {
                var d = distance(tower.loc, invader.loc);
                //console.log('distance', d);
                if (tower.range > d) {
                    //console.log('checking', tower.range, d);
                    return true;
                }
                return false;
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

            function updateInvader(invader) {
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
                invader.loc = xy;
                return xy;
            }

            function render(invader, xy) {
                // render
                invader.marker.setLatLng(invader.loc);
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
                //console.log(p0);
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
