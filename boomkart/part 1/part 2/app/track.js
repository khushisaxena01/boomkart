var map = [];
var powerups = [];
var powerupMeshes = [];

var Track = function (trackName) {

    var self = this;

    // Public variables
    self.TrackName = "debug";
    self.isDisposed = false;
    self.state = "loading";

    // Scenes
    var scene = null;
    var camera = null;

    // Map data
    var map = [];

    // Lap info
    var lap = {
        started: false,
        times: [0, 0, 0],
        checkpoint: false,
        count: 0,
        totalTime: 0,
        lapTimes: [],
        maxLaps: selectedLaps || 1
    };

    // Top right lap timer
    var timerDisplay = document.getElementById("timeCurrent");

    // FPS and intervals
    var timer = {
        animationframe: 0,
        lastUpdate: performance.now(),
        elapsed: 0.0,
        updaterate: 0.0
    };

    // Tile info
    var target = {
        position: { x: 0, z: 0 },
        tile: { index: 0, x: 0, z: 0 }
    };

    var current = {
        tile: { index: 0 }
    };

    // Player / physics
    var player = {
        position: new THREE.Vector3(0, 0.5, 0),
        speed: 0,
        turnspeed: 0,
        angle: 0,
        _speedBoostActive: false,
        _speedBoostTimeout: null
    };

    var limits = racers[racer].limits;

    // Loading counter
    var loadingstack = 0;

    // Assets
    var textures = {
        map: undefined,
        kart: undefined,
        outOfBounds: undefined,
        skyBox: undefined,
        background: [],
        powerup: {}
    };

    var materials = {
        map: undefined,
        kart: undefined,
        outOfBounds: undefined,
        skyBox: undefined,
        background: [],
        powerup: {}
    };

    var meshes = {
        map: undefined,
        kart: undefined,
        outOfBounds: undefined,
        skyBox: [],
        background: []
    };

    var geometry = {
        map: undefined,
        kart: undefined,
        outOfBounds: undefined,
        skyBox: undefined,
        background: undefined
    };

    // Enhanced visual effects systems
    var effects = {
        lighting: null,
        dustTrail: null,
        pickupBurst: null,
        smokeTrail: null,
        rain: null,
        snow: null
    };

    // Main class
    this.Track = function () {

        try {
            ga('send', 'event', 'Race', trackName + "_" + racer);
        } catch (e) {
            // oops no tracking..
        }

        document.getElementById("loading").style.display = "flex";

        // Reset all timers
        document.getElementById("timeCurrent").innerText = "00:00";
        document.getElementById("timeBest").innerText = "00:00";
        document.getElementById("timeLast").innerText = "00:00";
        document.getElementById("currentLap").innerHTML = ("0000" + lap.count).slice(-4);

        // Reset lap tracking for multi-lap races
        lap.totalTime = 0;
        lap.lapTimes = [];
        lap.maxLaps = selectedLaps || 1;

        // Load all assets and track defaults
        this.TrackName = trackName;

        setupScene();
        loadAssets();

        // Load map JSON
        xhr = new XMLHttpRequest();
        xhr.open("GET", "tracks/" + self.TrackName + "/map.json", true);
        xhr.onreadystatechange = function () {
            if (xhr.readyState == 4 && xhr.status == 200) {
                var json = JSON.parse(xhr.responseText);

                // Store map data
                map = json.tiles;

                // Load powerups from map JSON
                powerups = json.powerups || [];

                // Convert powerup tile coords to world coords and create meshes
                for (var i = 0; i < powerups.length; i++) {
                    var p = powerups[i];
                    p.worldX = -50 + Math.floor((p.x * (100 / 128))) + 0.8;
                    p.worldZ = -50 + Math.floor((p.y * (100 / 128))) - 0.39;
                    p.collected = false;
                    
                    // Create mesh - billboard style, facing camera
                    var geom = new THREE.PlaneGeometry(0.6, 0.6);
                    var mat = materials.powerup[p.type] || new THREE.MeshBasicMaterial({ color: 0xffffff });
                    var m = new THREE.Mesh(geom, mat);
                    m.position.set(p.worldX, 0.4, p.worldZ);
                    m.castShadow = false;
                    m.receiveShadow = false;
                    scene.add(m);
                    p.mesh = m;
                    powerupMeshes.push(m);
                    
                    // Add animated floating effect
                    p.floatOffset = Math.random() * Math.PI * 2;
                }

                // Set start position
                player.position = new THREE.Vector3(
                    -50 + Math.floor((json.start[0] * (100 / 128))) + 0.8,
                    0.5,
                    -50 + Math.floor((json.start[1] * (100 / 128))) - 0.39
                );

                // Player angle
                player.angle = -json.start[2];

                // Start updating the screen
                render();
            }
        };
        xhr.send();
    };

    function update(elapsed) {

        // Make sure we don't try to update the game if the map is disposed
        if (!self.isDisposed) {

            // Calculate how fast the game is running (1.0 = 60FPS)
            timer.updaterate = ((1 / (1 / 60)) * elapsed / 1000);

            // Toggle pause menu
            if (self.state == "running" && input.start) {
                input.start = false;
                pause();
            } else if (self.state == "paused" && input.start) {
                input.start = false;
                unpause();
            }

            // Update the game if it isn't loading, paused, or finished
            if (self.state == "running") {

                // Player animation tick
                timer.animationframe = (timer.animationframe + 1) % 60;

                // Update elapsed lap time
                lap.times[0] += elapsed;

                // Steering
                if (input.left) {
                    if (timer.updaterate < 1) {
                        player.turnspeed += (limits.turnSpeed);
                    } else {
                        player.turnspeed += (limits.turnSpeed * timer.updaterate);
                    }
                    textures.kart.offset.x = 0.5;
                } else if (input.right) {
                    if (timer.updaterate < 1) {
                        player.turnspeed -= (limits.turnSpeed);
                    } else {
                        player.turnspeed -= (limits.turnSpeed * timer.updaterate);
                    }
                    textures.kart.offset.x = 0.75;
                } else {
                    player.turnspeed = player.turnspeed / (1 + (limits.turnFriction * timer.updaterate));
                    if (player.speed > 0.2) {
                        if (timer.animationframe > 30) {
                            textures.kart.offset.x = 0.25;
                        } else {
                            textures.kart.offset.x = 0;
                        }
                    } else {
                        textures.kart.offset.x = 0;
                    }
                }

                // Boostpad has been hit
                if (current.tile.index == 3) {
                    player.speed = limits.maxSpeed + limits.maxBoost;
                    // Emit boost particles
                    if (effects.smokeTrail) {
                        for (var b = 0; b < 3; b++) {
                            effects.smokeTrail.emit(
                                player.position.x,
                                0.2,
                                player.position.z,
                                0, 0.3, 0
                            );
                        }
                    }
                }

                // Make skidding noise at high speeds / angles
                if (player.speed > 0.2 && (player.turnspeed > 1.1 || player.turnspeed < -1.1)) {
                    if (!sfx.skidd.playing()) sfx.skidd.play();
                    
                    // Emit drift smoke
                    if (effects.smokeTrail && timer.animationframe % 3 === 0) {
                        effects.smokeTrail.emit(
                            player.position.x + (Math.random() - 0.5) * 0.3,
                            0.1,
                            player.position.z + (Math.random() - 0.5) * 0.3,
                            (Math.random() - 0.5) * 0.2,
                            0.1,
                            (Math.random() - 0.5) * 0.2
                        );
                    }
                } else {
                    if (sfx.skidd.playing()) {
                        sfx.skidd.stop();
                    }
                }

                // Under / over steer
                if (player.turnspeed > -0.05 && player.turnspeed < 0.05) player.turnspeed = 0;
                if (player.turnspeed > limits.maxTurnSpeed) player.turnspeed = limits.maxTurnSpeed;
                if (player.turnspeed < -limits.maxTurnSpeed) player.turnspeed = -limits.maxTurnSpeed;

                // Turn the kart
                player.angle += (player.turnspeed * timer.updaterate);

                // Acceleration
                if (input.up || input.A) {
                    if (player.speed < 0.015) player.speed = 0.04;
                    player.speed = player.speed * (1 + (limits.acceleration * timer.updaterate));
                } else if (input.down || input.B) {
                    if (player.speed > 0) player.speed = player.speed / (1 + (limits.brake * timer.updaterate));
                } else {
                    player.speed = player.speed / (1 + (limits.friction * timer.updaterate));
                }

                // Cap maximum speed (allow boost to exceed normal max)
                var maxAllowed = player._speedBoostActive ? limits.maxSpeed + limits.maxBoost : limits.maxSpeed;
                if (player.speed > maxAllowed + 0.1) {
                    player.speed -= (0.03 * timer.updaterate);
                } else if (player.speed > maxAllowed) {
                    player.speed = maxAllowed;
                }

                // Make sure the player won't keep rolling forever at low speeds
                if (player.speed < 0.01 && player.speed > 0) player.speed = 0;

                // Reverse
                if (input.down && player.speed <= 0) {
                    player.speed = limits.reverseSpeed;
                } else {
                    if (player.speed < 0) player.speed += (0.01 * timer.updaterate);
                }

                // Get the next tile in our way
                target.position.x = player.position.x - ((player.speed * timer.updaterate) * Math.sin(player.angle * Math.PI / 180));
                target.position.z = player.position.z - ((player.speed * timer.updaterate) * Math.cos(player.angle * Math.PI / 180));
                target.tile.x = Math.floor(128 / 100 * (target.position.x + 50));
                target.tile.z = Math.floor(128 / 100 * (target.position.z + 50));
                target.tile.index = map[target.tile.z][target.tile.x];

                // Check if the player will hit a wall or go out of boundary
                if (target.position.x > 50 || target.position.x < -50 || target.position.z > 50 || target.position.z < -50 || target.tile.index == 1) {
                    if (player.speed >= 0) {
                        player.speed = player.speed * -1;
                        player.position.x -= (player.speed - 0.15) * Math.sin(player.angle * Math.PI / 180);
                        player.position.z -= (player.speed - 0.15) * Math.cos(player.angle * Math.PI / 180);
                        input.up = false;
                        input.down = false;
                        if (!sfx.bump.playing()) sfx.bump.play();
                        
                        // Emit impact particles
                        if (effects.pickupBurst) {
                            effects.pickupBurst.emitBurst(player.position.x, 0.3, player.position.z, 15, 1.2, 0.8, 0.8);
                        }
                    } else {
                        player.speed = 0;
                        input.up = false;
                        input.down = false;
                    }
                } else {
                    player.position.x = target.position.x;
                    player.position.z = target.position.z;
                }

                // Slow down in mud
                if (target.tile.index == 2 && player.speed > 0.10) {
                    player.speed = 0.10;
                    // Emit mud particles
                    if (effects.dustTrail && timer.animationframe % 2 === 0) {
                        effects.dustTrail.emit(
                            player.position.x + (Math.random() - 0.5) * 0.4,
                            0.1,
                            player.position.z + (Math.random() - 0.5) * 0.4,
                            (Math.random() - 0.5) * 0.15,
                            0.05 + Math.random() * 0.1,
                            (Math.random() - 0.5) * 0.15,
                            1.2
                        );
                    }
                }

                // Passed a checkpoint tile
                if (target.tile.index == 5 && current.tile.index != 5) lap.checkpoint = true;

                // Player passed the finish line after hitting a checkpoint
                if (target.tile.index == 4 && current.tile.index != 4 && lap.checkpoint) {
                    lap.checkpoint = false;
                    lap.times[1] = lap.times[0];
                    lap.times[0] = 0;
                    if (lap.times[1] < lap.times[2] || lap.times[2] == 0) lap.times[2] = lap.times[1];
                    lap.count++;
                    lap.lapTimes.push(lap.times[1]);
                    lap.totalTime += lap.times[1];

                    document.getElementById("currentLap").innerText = ("0000" + lap.count).slice(-4);
                    document.getElementById("timeLast").innerText = (lap.times[1] / 1000).toFixed(2);
                    document.getElementById("timeBest").innerText = (lap.times[2] / 1000).toFixed(2);

                    // Check if race is complete
                    if (lap.count >= lap.maxLaps) {
                        // Race finished - save total time to leaderboard
                        if (typeof Leaderboard !== 'undefined') {
                            Leaderboard.saveTime(self.TrackName, lap.totalTime, racer, lap.maxLaps);
                        }

                        // Show game over screen
                        showGameOver();

                        // Stop the race immediately for single lap races
                        if (lap.maxLaps === 1) {
                            self.state = "finished";
                        }
                    } else {
                        // Continue to next lap
                        sfx.lap.play();

                        // Celebration particles
                        if (effects.pickupBurst) {
                            effects.pickupBurst.emitBurst(player.position.x, 1.0, player.position.z, 30, 1.5, 1.0, 1.5);
                        }
                    }
                }

                // Start timer at first lap
                if (target.tile.index == 4 && current.tile.index != 4) {
                    if (!lap.started) {
                        lap.times[0] = 0;
                        lap.started = true;
                    }
                }

                // SFX - Launch pad
                if (target.tile.index == 3 && current.tile.index != 3) sfx.woosh.play();

                // Increase/decrease engine playback rate and lap timer
                if (Math.round(timer.animationframe % 10) == 0) {
                    sfx.engine.rate(1.3 + (player.speed * 2));
                    if (lap.started) timerDisplay.innerText = (lap.times[0] / 1000).toFixed(2);
                }

                // Store current tile for next frame
                current.tile.index = target.tile.index;

                // Check for powerup pickups
                for (var i = powerups.length - 1; i >= 0; i--) {
                    var pu = powerups[i];
                    if (pu.collected) continue;
                    var dx = player.position.x - pu.worldX;
                    var dz = player.position.z - pu.worldZ;
                    var dist = Math.sqrt(dx * dx + dz * dz);
                    if (dist < 0.9) {
                        pu.collected = true;
                        
                        // Emit pickup explosion effect
                        if (effects.pickupBurst) {
                            effects.pickupBurst.emitBurst(pu.worldX, 0.4, pu.worldZ, 24, 1.0, 1.2, 1.0);
                        }
                        
                        if (pu.mesh) {
                            scene.remove(pu.mesh);
                            try { pu.mesh.geometry.dispose(); } catch (e) {}
                            try { if (pu.mesh.material.map) pu.mesh.material.map.dispose(); } catch (e) {}
                            try { pu.mesh.material.dispose(); } catch (e) {}
                            pu.mesh = null;
                        }
                        activatePowerup(pu.type, player);
                        powerups.splice(i, 1);
                    }
                }

                // Emit dust trail when moving
                if (effects.dustTrail && player.speed > 0.3 && timer.animationframe % 2 === 0) {
                    var angle = player.angle * Math.PI / 180;
                    var offsetX = Math.sin(angle) * -0.3;
                    var offsetZ = Math.cos(angle) * -0.3;
                    
                    effects.dustTrail.emit(
                        player.position.x + offsetX + (Math.random() - 0.5) * 0.2,
                        0.05,
                        player.position.z + offsetZ + (Math.random() - 0.5) * 0.2,
                        (Math.random() - 0.5) * 0.1,
                        0.02 + Math.random() * 0.05,
                        (Math.random() - 0.5) * 0.1,
                        0.8 + Math.random() * 0.4
                    );
                }

                // Update particle systems
                var dt = elapsed / 1000;
                if (effects.dustTrail) effects.dustTrail.update(dt);
                if (effects.pickupBurst) effects.pickupBurst.update(dt);
                if (effects.smokeTrail) effects.smokeTrail.update(dt);
                if (effects.rain) effects.rain.update(dt, camera.position);
                if (effects.snow) effects.snow.update(dt, camera.position);
                
                // Update lighting system
                if (effects.lighting) effects.lighting.update(dt);
                
                // Animate powerup floating effect
                for (var p = 0; p < powerupMeshes.length; p++) {
                    if (powerupMeshes[p] && powerupMeshes[p].parent) {
                        var pu = powerups[p];
                        if (pu && !pu.collected) {
                            var floatY = 0.4 + Math.sin(Date.now() * 0.003 + pu.floatOffset) * 0.1;
                            powerupMeshes[p].position.y = floatY;
                            // Rotate slowly
                            powerupMeshes[p].rotation.y += 0.02;
                        }
                    }
                }

            } else if (self.state == "paused") {
                // game is paused
            } else if (self.state == "loading") {
                if (loadingstack <= 0) {
                    document.getElementById("loading").style.display = "none";
                    sfx.engine.fade(0, 1, 500, sfx.engine.play());
                    self.state = "running";
                }
            }
        }
    }

    function render() {
        if (!self.isDisposed) {
            // EXPOSE PROPERTIES FOR MULTIPLAYER
            self.player = player;
            self.scene = scene;
            self.lap = lap;
            
            timer.elapsed = (performance.now() - timer.lastUpdate);
            timer.lastUpdate = performance.now();

            update(timer.elapsed);

            if (self.state != "loading") {
                meshes.kart.position.set(player.position.x, 0.4, player.position.z);
                meshes.kart.rotation.y = player.angle * (Math.PI / 180);
                camera.position.z = Math.cos(player.angle * Math.PI / 180) * 4 + player.position.z;
                camera.position.x = Math.sin(player.angle * Math.PI / 180) * 4 + player.position.x;
                camera.lookAt(new THREE.Vector3(player.position.x, player.position.y + 0.3, player.position.z));
                
                // Make powerup icons always face the camera (billboard effect)
                for (var i = 0; i < powerupMeshes.length; i++) {
                    if (powerupMeshes[i] && powerupMeshes[i].parent) {
                        powerupMeshes[i].lookAt(camera.position);
                    }
                }
                
                renderer.render(scene, camera);
            }

            requestAnimationFrame(render);
        }
    }

    function setupScene() {
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0xa0c1f7);
        
        camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 2000);
        camera.position.set(0, 1.3, 0);
        
        // Initialize enhanced lighting system (only if effects loaded)
        if (window.Effects && window.Effects.Lighting) {
            effects.lighting = new window.Effects.Lighting(scene, renderer, {
                shadowMapSize: 2048,
                startTime: 0.4,
                autoProgress: true,
                cycleSpeed: 0.002
            });
        }
        
        // Initialize particle systems (only if effects loaded)
        if (window.Effects && window.Effects.ParticleSystem) {
            effects.dustTrail = new window.Effects.ParticleSystem({
                scene: scene,
                max: 300,
                spriteUrl: null,
                size: 0.25,
                gravity: -0.5,
                damping: 0.95,
                color: 0xaa8866
            });
            
            effects.pickupBurst = new window.Effects.ParticleSystem({
                scene: scene,
                max: 200,
                spriteUrl: null,
                size: 0.3,
                gravity: -1.2,
                damping: 0.96,
                color: 0xffdd44,
                blending: THREE.AdditiveBlending
            });
        }
        
        // Initialize smoke system (only if effects loaded)
        if (window.Effects && window.Effects.SmokeSystem) {
            effects.smokeTrail = new window.Effects.SmokeSystem({
                scene: scene,
                max: 150,
                color: 0xcccccc
            });
        }
        
        window.addEventListener('resize', onWindowResize, false);
        onWindowResize();
    }

    function activatePowerup(type, player) {
        switch (type) {
            case "speed":
                var boostMultiplier = 2.0;
                var boostDurationMs = 3000;

                if (player._speedBoostTimeout) {
                    clearTimeout(player._speedBoostTimeout);
                }

                player.speed = Math.min(player.speed * boostMultiplier, (limits.maxSpeed + limits.maxBoost));
                player._speedBoostActive = true;

                player._speedBoostTimeout = setTimeout(function () {
                    player._speedBoostActive = false;
                    player._speedBoostTimeout = null;
                }, boostDurationMs);

                if (sfx && sfx.woosh) {
                    try { sfx.woosh.play(); } catch (e) {}
                }
                
                if (effects.smokeTrail) {
                    for (var i = 0; i < 10; i++) {
                        effects.smokeTrail.emit(
                            player.position.x + (Math.random() - 0.5) * 0.5,
                            0.2,
                            player.position.z + (Math.random() - 0.5) * 0.5,
                            (Math.random() - 0.5) * 0.3,
                            0.2,
                            (Math.random() - 0.5) * 0.3
                        );
                    }
                }
                break;

            case "shell":
                player.speed = limits.maxSpeed + limits.maxBoost;
                
                if (sfx && sfx.woosh) {
                    try { sfx.woosh.play(); } catch (e) {}
                }
                
                if (effects.pickupBurst) {
                    effects.pickupBurst.emitBurst(player.position.x, 0.5, player.position.z, 20, 1.5, 1.0, 1.0);
                }
                break;

            case "obstacle":
                player.speed = 0;
                player.turnspeed = 0;
                
                if (sfx && sfx.bump) {
                    try { sfx.bump.play(); } catch (e) {}
                }
                
                if (effects.dustTrail) {
                    for (var j = 0; j < 15; j++) {
                        effects.dustTrail.emit(
                            player.position.x,
                            0.3,
                            player.position.z,
                            (Math.random() - 0.5) * 0.8,
                            Math.random() * 0.5,
                            (Math.random() - 0.5) * 0.8,
                            1.0
                        );
                    }
                }
                break;

            default:
                console.log("Unknown powerup:", type);
        }
    }

    function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    function loadAssets() {
        sfx.engine.load();

        // Powerup textures
        var powerupTypes = ["speed", "obstacle"];

        // Load powerup textures
        for (var i = 0; i < powerupTypes.length; i++) {
            loadingstack++;
            var type = powerupTypes[i];
            textures.powerup[type] = new THREE.TextureLoader().load("graphics/powerups/" + type + ".png", function () { loadingstack -= 1; });
            textures.powerup[type].generateMipmaps = false;
            textures.powerup[type].minFilter = THREE.NearestFilter;
            textures.powerup[type].magFilter = THREE.NearestFilter;
            materials.powerup[type] = new THREE.MeshBasicMaterial({ map: textures.powerup[type], transparent: true });
        }

        // Race track
        loadingstack++;
        geometry.map = new THREE.PlaneGeometry(100, 100);
        geometry.map.rotateX(-(Math.PI / 2));
        textures.map = new THREE.TextureLoader().load("tracks/" + self.TrackName + "/map.png", function () { loadingstack -= 1; });
        textures.map.generateMipmaps = false;
        textures.map.minFilter = THREE.NearestFilter;
        textures.map.magFilter = THREE.NearestFilter;
        materials.map = new THREE.MeshLambertMaterial({ map: textures.map });
        meshes.map = new THREE.Mesh(geometry.map, materials.map);
        meshes.map.receiveShadow = true;
        scene.add(meshes.map);

        // Player kart
        loadingstack++;
        geometry.kart = new THREE.PlaneGeometry(0.8, 0.8);
        textures.kart = new THREE.TextureLoader().load("graphics/racers/" + racer + ".png", function () { loadingstack -= 1; });
        textures.kart.generateMipmaps = false;
        textures.kart.minFilter = THREE.NearestFilter;
        textures.kart.magFilter = THREE.NearestFilter;
        textures.kart.repeat.set(0.25, 1);
        materials.kart = new THREE.MeshBasicMaterial({ map: textures.kart, transparent: true });
        meshes.kart = new THREE.Mesh(geometry.kart, materials.kart);
        meshes.kart.castShadow = true;
        meshes.kart.receiveShadow = false;
        scene.add(meshes.kart);

        // Out of bounds
        loadingstack++;
        geometry.outOfBounds = new THREE.PlaneGeometry(500, 500);
        geometry.outOfBounds.rotateX(-(Math.PI / 2));
        geometry.outOfBounds.translate(0, -0.05, 0);
        textures.outOfBounds = new THREE.TextureLoader().load("tracks/" + self.TrackName + "/default.png", function () { loadingstack -= 1; });
        textures.outOfBounds.generateMipmaps = false;
        textures.outOfBounds.wrapS = THREE.RepeatWrapping;
        textures.outOfBounds.wrapT = THREE.RepeatWrapping;
        textures.outOfBounds.repeat.set(500, 500);
        textures.outOfBounds.minFilter = THREE.NearestFilter;
        textures.outOfBounds.magFilter = THREE.NearestFilter;
        materials.outOfBounds = new THREE.MeshLambertMaterial({ map: textures.outOfBounds });
        meshes.outOfBounds = new THREE.Mesh(geometry.outOfBounds, materials.outOfBounds);
        meshes.outOfBounds.receiveShadow = true;
        scene.add(meshes.outOfBounds);

        // Skybox (far)
        loadingstack++;
        geometry.skyBox = new THREE.PlaneGeometry(500, 125);
        textures.skyBox = new THREE.TextureLoader().load("tracks/" + self.TrackName + "/skybox.png", function () { loadingstack -= 1; });
        textures.skyBox.generateMipmaps = false;
        textures.skyBox.minFilter = THREE.NearestFilter;
        textures.skyBox.magFilter = THREE.NearestFilter;
        materials.skyBox = new THREE.MeshBasicMaterial({ map: textures.skyBox });

        for (i = 0; i < 4; i++) {
            meshes.skyBox.push(new THREE.Mesh(geometry.skyBox, materials.skyBox));
            scene.add(meshes.skyBox[i]);
        }

        meshes.skyBox[0].position.set(0, 62, -250);
        meshes.skyBox[1].position.set(0, 62, 250);
        meshes.skyBox[1].rotateY(Math.PI);
        meshes.skyBox[2].position.set(-250, 62, 0);
        meshes.skyBox[2].rotateY(Math.PI / 2);
        meshes.skyBox[3].position.set(250, 62, 0);
        meshes.skyBox[3].rotateY(-Math.PI / 2);

        // Skybox (near) - background
        geometry.background = new THREE.PlaneGeometry(320, 80);
        for (i = 0; i < 4; i++) {
            loadingstack++;
            textures.background.push(new THREE.TextureLoader().load("tracks/" + self.TrackName + "/background_" + i + ".png", function () { loadingstack -= 1; }));
            textures.background[i].generateMipmaps = false;
            textures.background[i].minFilter = THREE.NearestFilter;
            textures.background[i].magFilter = THREE.NearestFilter;
            materials.background.push(new THREE.MeshBasicMaterial({ map: textures.background[i], transparent: true }));
            meshes.background.push(new THREE.Mesh(geometry.background, materials.background[i]));
            scene.add(meshes.background[i]);
        }

        meshes.background[0].position.set(0, 40, -160);
        meshes.background[1].position.set(160, 40, 0);
        meshes.background[1].rotateY(-Math.PI / 2);
        meshes.background[2].position.set(0, 40, 160);
        meshes.background[2].rotateY(Math.PI);
        meshes.background[3].position.set(-160, 40, 0);
        meshes.background[3].rotateY(Math.PI / 2);
    }

    this.dispose = function () {
        self.isDisposed = true;
        window.removeEventListener('resize', onWindowResize, false);
        sfx.engine.fade(1, 0, 500);
        sfx.engine.stop();

        scene.remove(meshes.map);
        geometry.map.dispose();
        textures.map.dispose();
        materials.map.dispose();

        scene.remove(meshes.outOfBounds);
        geometry.outOfBounds.dispose();
        textures.outOfBounds.dispose();
        materials.outOfBounds.dispose();

        scene.remove(meshes.kart);
        geometry.kart.dispose();
        textures.kart.dispose();
        materials.kart.dispose();

        for (i = 0; i < 4; i++) {
            scene.remove(meshes.skyBox[i]);
        }
        geometry.skyBox.dispose();
        textures.skyBox.dispose();
        materials.skyBox.dispose();

        for (i = 0; i < 4; i++) {
            scene.remove(meshes.background[i]);
            textures.background[i].dispose();
            materials.background[i].dispose();
        }
        geometry.background.dispose();

        // Remove powerup meshes
        for (i = 0; i < powerups.length; i++) {
            try {
                if (powerups[i].mesh) {
                    scene.remove(powerups[i].mesh);
                    powerups[i].mesh.geometry.dispose();
                    if (powerups[i].mesh.material.map) powerups[i].mesh.material.map.dispose();
                    powerups[i].mesh.material.dispose();
                    powerups[i].mesh = null;
                }
            } catch (e) {}
        }
        powerups = [];
        powerupMeshes = [];

        // Dispose powerup materials/textures
        try {
            for (var t in materials.powerup) {
                if (materials.powerup[t]) materials.powerup[t].dispose();
            }
            for (var t2 in textures.powerup) {
                if (textures.powerup[t2]) textures.powerup[t2].dispose();
            }
        } catch (e) {}

        // Dispose particle systems
        if (effects.dustTrail) effects.dustTrail.dispose();
        if (effects.pickupBurst) effects.pickupBurst.dispose();
        if (effects.smokeTrail) effects.smokeTrail.dispose();
        if (effects.rain) effects.rain.dispose();
        if (effects.snow) effects.snow.dispose();
        
        // Dispose lighting
        if (effects.lighting) effects.lighting.dispose();

        scene = null;
        camera = null;
    };

    // Init
    this.Track();
};