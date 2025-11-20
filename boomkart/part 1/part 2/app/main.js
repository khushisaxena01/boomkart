// three.js instance
var renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Selected track and racer
var track = null;
var racer = "kartB";
var selectedTrack = null;
var selectedLaps = 1;

var mainMenu = document.getElementById("mainMenu");

// Load a new track and hide the main menu
function loadMap(map) {
    unloadTrack();
    document.getElementById("mainMenu").style.display = "none";
    track = new Track(map);
}

// Dispose track and return to menu
function unloadTrack() {
    sfx.click.play();
    document.getElementById("gameMenu").style.display = "none";
    document.getElementById("mainMenu").style.display = "block";
    if (track !== null) {
        track.dispose();
        track = null;
    }
    // Reset selections when returning to menu
    selectedTrack = null;
    selectedLaps = 1;
}

// Pause game from menu or button
function pause() {
    sfx.click.play();
    track.state = "paused";
    document.getElementById("gameMenu").style.display = "flex";
}

// Resume game from menu or button
function unpause() {
    sfx.click.play();
    track.state = "running";
    document.getElementById("gameMenu").style.display = "none";
}

// Background colors for each menu
var backgroundColors = {
    "title": "#000000",
    "main": "#a02700",
    "racer": "#006900",
    "track": "#00516b",
    "laps": "#8b4513",
    "about": "#111111",
    "settings": "#111111",

    "leaderboard_laps": "#2a2a2a",
    "multiplayer_leaderboard": "#2a2a2a",
    "gameover": "#000000"
};

// Switch between menus
function showMenu(section) {

    // Set new background color (animated via CSS)
    mainMenu.style.backgroundColor = backgroundColors[section];

    var menus = document.getElementsByClassName("popup");
    for (i = 0; i < menus.length; i++) {
        menus[i].style.display = "none";
    }

    sfx.click.play();
    document.getElementById("menu_" + section).style.display = "block";
}

// Set selected racer
function setRacer(newRacer) {
    racer = newRacer;
    showMenu('track');
}

// Set selected track
function selectTrack(trackName) {
    selectedTrack = trackName;
    showMenu('laps');
}

// Set selected number of laps
function selectLaps(numLaps) {
    selectedLaps = numLaps;
    loadMap(selectedTrack);
}

// Bind touch events to onscreen controls
document.getElementById("left").addEventListener('touchstart', function (e) { input.left = true; }, false);
document.getElementById("left").addEventListener('touchend', function (e) { input.left = false; }, false);

document.getElementById("right").addEventListener('touchstart', function (e) { input.right = true; }, false);
document.getElementById("right").addEventListener('touchend', function (e) { input.right = false; }, false);

document.getElementById("aButton").addEventListener('touchstart', function (e) { input.A = true; input.up = true; }, false);
document.getElementById("aButton").addEventListener('touchend', function (e) { input.A = false; input.up = false; }, false);

document.getElementById("bButton").addEventListener('touchstart', function (e) { input.B = true; input.down = true; }, false);
document.getElementById("bButton").addEventListener('touchend', function (e) { input.B = false; input.down = false; }, false);

// Only show the touch controls on touch devices
window.addEventListener('touchstart', function () {
    document.getElementById("touch").style.display = "block";
});

// Disable context menu on touch elements
window.oncontextmenu = function (event) {
    event.preventDefault();
    event.stopPropagation();
    return false;
};

// Long press bug fix for iOS safari
document.ontouchmove = function (event) {
    event.preventDefault();
}

// fullscreen support for all browsers except (drumroll please) Safari
function toggleFullscreen() {
    sfx.click.play();
    var elem = document.documentElement;
    if (!document.fullscreenElement && !document.mozFullScreenElement &&
      !document.webkitFullscreenElement && !document.msFullscreenElement) {
        if (elem.requestFullscreen) {
            elem.requestFullscreen();
        } else if (elem.msRequestFullscreen) {
            elem.msRequestFullscreen();
        } else if (elem.mozRequestFullScreen) {
            elem.mozRequestFullScreen();
        } else if (elem.webkitRequestFullscreen) {
            elem.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }
    }
}

// Show hidden track and racer
function meow() {
    var cats = document.getElementsByClassName("secret");
    for (i = 0; i < cats.length; i++) cats[i].style.display = "block";
    sfx.lap.play();
}

var version = "1.4";

// Show game over screen
function showGameOver() {
    var html = '<h2>RACE COMPLETE!</h2>';

    if (track && track.lap) {
        var lap = track.lap;
        var trackName = track.TrackName;
        var isNewBest = false;

        // Get current best time for this track and lap count
        var bestTime = null;
        if (typeof Leaderboard !== 'undefined') {
            var entries = Leaderboard.getTrackLeaderboard(trackName);
            for (var i = 0; i < entries.length; i++) {
                if (entries[i].laps === lap.maxLaps) {
                    bestTime = entries[i].time;
                    break;
                }
            }
        }

        // Check if this is a new best time
        if (bestTime === null || lap.totalTime < bestTime) {
            isNewBest = true;
        }

        // Save race time to leaderboard
        if (typeof Leaderboard !== 'undefined') {
            Leaderboard.saveTime(trackName, lap.totalTime, racer, lap.maxLaps, multiplayerEnabled);
        }

        // For single lap races, show the lap time as total time
        if (lap.maxLaps === 1) {
            html += '<p>Lap Time: ' + (lap.totalTime / 1000).toFixed(2) + 's</p>';
        } else {
            html += '<p>Total Time: ' + (lap.totalTime / 1000).toFixed(2) + 's</p>';
        }

        if (isNewBest) {
            html += '<p style="color: #ffdd44; font-weight: bold;">🎉 NEW BEST TIME! 🎉</p>';
            html += '<p style="color: #00ff00; font-size: 14px;">Your time has been recorded in Lap Records!</p>';
        } else if (bestTime !== null) {
            html += '<p>Best Time: ' + (bestTime / 1000).toFixed(2) + 's</p>';
        }

        html += '<p>Laps Completed: ' + lap.count + '/' + lap.maxLaps + '</p>';

        if (lap.lapTimes.length > 0 && lap.maxLaps > 1) {
            html += '<h3>Lap Times:</h3>';
            html += '<ul>';
            for (var i = 0; i < lap.lapTimes.length; i++) {
                html += '<li>Lap ' + (i + 1) + ': ' + (lap.lapTimes[i] / 1000).toFixed(2) + 's</li>';
            }
            html += '</ul>';
        }

        if (lap.maxLaps > 1) {
            html += '<p>Average Lap Time: ' + ((lap.totalTime / lap.count) / 1000).toFixed(2) + 's</p>';
        }
    }

    html += '<div class="menuButton" onclick="showMenu(\'main\')">BACK TO MENU</div>';

    document.getElementById('gameover_content').innerHTML = html;
    showMenu('gameover');
}

// debug stuff
//showMenu("track");
//setRacer("kartB");
//loadMap("ascalon");
