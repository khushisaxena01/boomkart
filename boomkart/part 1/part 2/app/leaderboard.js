// Leaderboard system for storing and displaying best race times
var Leaderboard = {
    // Storage key for localStorage
    STORAGE_KEY: 'boomkart_leaderboard',

    // Initialize leaderboard data
    init: function() {
        if (!localStorage.getItem(this.STORAGE_KEY)) {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify({}));
        }
    },

    // Save a new time for a track
    saveTime: function(trackName, time, racer, laps, isMultiplayer) {
        var data = this.getData();
        if (!data[trackName]) {
            data[trackName] = [];
        }

        // Add new entry
        data[trackName].push({
            time: time,
            racer: racer,
            date: new Date().toISOString(),
            laps: laps || 1,
            multiplayer: isMultiplayer || false
        });

        // Sort by time (ascending) and keep only top 10
        data[trackName].sort(function(a, b) {
            return a.time - b.time;
        });

        if (data[trackName].length > 10) {
            data[trackName] = data[trackName].slice(0, 10);
        }

        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    },

    // Get leaderboard data
    getData: function() {
        return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '{}');
    },

    // Get top times for a specific track
    getTrackLeaderboard: function(trackName) {
        var data = this.getData();
        return data[trackName] || [];
    },

    // Format time for display
    formatTime: function(timeMs) {
        var seconds = (timeMs / 1000).toFixed(2);
        return seconds + 's';
    },

    // Display leaderboard in UI
    showLeaderboard: function(trackName) {
        var entries = this.getTrackLeaderboard(trackName);
        var html = '<h3>' + trackName.toUpperCase() + ' LEADERBOARD</h3>';

        if (entries.length === 0) {
            html += '<p>No times recorded yet!</p>';
        } else {
            // Group entries by lap count
            var groupedEntries = {};
            for (var i = 0; i < entries.length; i++) {
                var laps = entries[i].laps || 1;
                if (!groupedEntries[laps]) {
                    groupedEntries[laps] = [];
                }
                groupedEntries[laps].push(entries[i]);
            }

            // Display each lap count group
            for (var lapCount in groupedEntries) {
                if (groupedEntries.hasOwnProperty(lapCount)) {
                    var lapEntries = groupedEntries[lapCount];
                    var lapLabel = lapCount == 1 ? '1 Lap' : lapCount + ' Laps';

                    html += '<h4>' + lapLabel + '</h4>';
                    html += '<table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">';
                    html += '<tr><th style="text-align: left; padding: 5px;">Rank</th><th style="text-align: left; padding: 5px;">Time</th><th style="text-align: left; padding: 5px;">Kart</th></tr>';

                    for (var i = 0; i < lapEntries.length; i++) {
                        var entry = lapEntries[i];
                        var rank = i + 1;
                        var timeStr = this.formatTime(entry.time);
                        var racerName = this.getRacerDisplayName(entry.racer);

                        html += '<tr>';
                        html += '<td style="padding: 5px;">' + rank + '</td>';
                        html += '<td style="padding: 5px;">' + timeStr + '</td>';
                        html += '<td style="padding: 5px;">' + racerName + '</td>';
                        html += '</tr>';
                    }

                    html += '</table>';
                }
            }
        }

        html += '<div class="menuButton" onclick="showMenu(\'track\')"><- BACK</div>';

        document.getElementById('menu_leaderboard').innerHTML = html;
        showMenu('leaderboard');
    },



    // Show lap records menu with best times for each lap count
    showLapRecords: function() {
        var html = '<h3>LAP RECORDS</h3>';
        var allData = this.getData();
        var bestTimes = {
            1: [],
            2: [],
            3: []
        };

        // Debug: Log the data to console
        console.log('Leaderboard data:', allData);

        // Collect best times for each lap count from all tracks
        for (var track in allData) {
            if (allData.hasOwnProperty(track)) {
                var trackEntries = allData[track];
                console.log('Track:', track, 'Entries:', trackEntries);
                for (var i = 0; i < trackEntries.length; i++) {
                    var entry = trackEntries[i];
                    var laps = entry.laps || 1;
                    console.log('Entry:', entry, 'Laps:', laps);
                    if (laps >= 1 && laps <= 3) {
                        bestTimes[laps].push({
                            track: track,
                            time: entry.time,
                            racer: entry.racer,
                            date: entry.date,
                            laps: laps
                        });
                    }
                }
            }
        }

        console.log('Best times collected:', bestTimes);

        // Sort each lap count by time and take top 5
        for (var lapCount in bestTimes) {
            bestTimes[lapCount].sort(function(a, b) {
                return a.time - b.time;
            });
            bestTimes[lapCount] = bestTimes[lapCount].slice(0, 5);
        }

        console.log('Best times sorted:', bestTimes);

        // Display each lap count section
        for (var lapCount = 1; lapCount <= 3; lapCount++) {
            var entries = bestTimes[lapCount];
            var lapLabel = lapCount + ' Lap' + (lapCount > 1 ? 's' : '');

            html += '<h4>' + lapLabel + ' Records</h4>';

            if (entries.length === 0) {
                html += '<p>No ' + lapLabel.toLowerCase() + ' records yet!</p>';
                html += '<p style="font-size: 12px; color: #666;">Complete a ' + lapLabel.toLowerCase() + ' race to set your first record!</p>';
            } else {
                html += '<table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">';
                html += '<tr><th style="text-align: left; padding: 5px;">Rank</th><th style="text-align: left; padding: 5px;">Time</th><th style="text-align: left; padding: 5px;">Kart</th><th style="text-align: left; padding: 5px;">Track</th></tr>';

                for (var i = 0; i < entries.length; i++) {
                    var entry = entries[i];
                    var rank = i + 1;
                    var timeStr = this.formatTime(entry.time);
                    var racerName = this.getRacerDisplayName(entry.racer);
                    var trackName = entry.track.charAt(0).toUpperCase() + entry.track.slice(1);

                    html += '<tr>';
                    html += '<td style="padding: 5px;">' + rank + '</td>';
                    html += '<td style="padding: 5px;">' + timeStr + '</td>';
                    html += '<td style="padding: 5px;">' + racerName + '</td>';
                    html += '<td style="padding: 5px;">' + trackName + '</td>';
                    html += '</tr>';
                }

                html += '</table>';
            }
        }

        // Add sample data for testing if no real data exists
        var hasAnyData = bestTimes[1].length > 0 || bestTimes[2].length > 0 || bestTimes[3].length > 0;
        if (!hasAnyData) {
            html += '<div style="background: #333; padding: 15px; margin: 20px 0; border-radius: 5px;">';
            html += '<h4 style="color: #ffdd44; margin-top: 0;">🚀 Ready to Set Records?</h4>';
            html += '<p style="margin-bottom: 10px;">No lap records yet! Here\'s how to get started:</p>';
            html += '<ol style="text-align: left; margin: 0; padding-left: 20px;">';
            html += '<li>Choose a track from the main menu</li>';
            html += '<li>Select your number of laps (1, 2, or 3)</li>';
            html += '<li>Complete the race to automatically save your time!</li>';
            html += '<li>Come back here to see your records</li>';
            html += '</ol>';
            html += '<p style="margin-top: 10px; font-size: 12px; color: #aaa;">💡 Your best times are saved locally in your browser.</p>';
            html += '</div>';
        }

        // Add a note about how records are saved
        html += '<p style="font-size: 12px; color: #888; text-align: center; margin-top: 20px;">💡 Best lap times are automatically recorded when you complete races!</p>';

        html += '<div class="menuButton" onclick="showMenu(\'main\')"><- BACK</div>';

        document.getElementById('menu_leaderboard_laps').innerHTML = html;
        showMenu('leaderboard_laps');
    },

    // Show multiplayer leaderboard with multiplayer times
    showMultiplayerLeaderboard: function() {
        var html = '<h3>MULTIPLAYER LEADERBOARD</h3>';
        var allData = this.getData();
        var multiplayerEntries = [];

        // Collect all multiplayer entries from all tracks
        for (var track in allData) {
            if (allData.hasOwnProperty(track)) {
                var trackEntries = allData[track];
                for (var i = 0; i < trackEntries.length; i++) {
                    var entry = trackEntries[i];
                    if (entry.multiplayer) {
                        multiplayerEntries.push({
                            track: track,
                            time: entry.time,
                            racer: entry.racer,
                            date: entry.date,
                            laps: entry.laps || 1
                        });
                    }
                }
            }
        }

        // Sort by time (ascending - fastest first)
        multiplayerEntries.sort(function(a, b) {
            return a.time - b.time;
        });

        if (multiplayerEntries.length === 0) {
            html += '<p>No multiplayer games recorded yet!</p>';
            html += '<p>Play some multiplayer races to populate the leaderboard! 🏁</p>';
        } else {
            html += '<p style="text-align: center; margin-bottom: 20px;">🏆 The fastest multiplayer times ever recorded! 🏆</p>';
            html += '<table style="width: 100%; border-collapse: collapse;">';
            html += '<tr><th style="text-align: left; padding: 5px;">Rank</th><th style="text-align: left; padding: 5px;">Time</th><th style="text-align: left; padding: 5px;">Kart</th><th style="text-align: left; padding: 5px;">Track</th><th style="text-align: left; padding: 5px;">Laps</th><th style="text-align: left; padding: 5px;">Date</th></tr>';

            for (var i = 0; i < Math.min(multiplayerEntries.length, 20); i++) {
                var entry = multiplayerEntries[i];
                var rank = i + 1;
                var timeStr = this.formatTime(entry.time);
                var racerName = this.getRacerDisplayName(entry.racer);
                var trackName = entry.track.charAt(0).toUpperCase() + entry.track.slice(1);
                var lapsStr = entry.laps + ' Lap' + (entry.laps > 1 ? 's' : '');
                var dateStr = new Date(entry.date).toLocaleDateString();

                html += '<tr>';
                html += '<td style="padding: 5px;">' + rank + '</td>';
                html += '<td style="padding: 5px;">' + timeStr + '</td>';
                html += '<td style="padding: 5px;">' + racerName + '</td>';
                html += '<td style="padding: 5px;">' + trackName + '</td>';
                html += '<td style="padding: 5px;">' + lapsStr + '</td>';
                html += '<td style="padding: 5px;">' + dateStr + '</td>';
                html += '</tr>';
            }

            html += '</table>';
        }

        html += '<div class="menuButton" onclick="showMenu(\'main\')"><- BACK</div>';

        document.getElementById('menu_multiplayer_leaderboard').innerHTML = html;
        showMenu('multiplayer_leaderboard');
    },

    // Get display name for racer
    getRacerDisplayName: function(racerCode) {
        var names = {
            'kartA': 'YESTERMOBILE MARK 7',
            'kartB': 'CENTURION 2B-1G',
            'kartC': 'SALT MACHINE 2000',
            'taimi': 'TAIMI'
        };
        return names[racerCode] || racerCode;
    },

    // Update best times display in main menu
    updateBestTimesDisplay: function() {
        var allData = this.getData();
        var bestTimes = {
            1: null,
            2: null,
            3: null
        };

        // Find the best time for each lap count across all tracks
        for (var track in allData) {
            if (allData.hasOwnProperty(track)) {
                var trackEntries = allData[track];
                for (var i = 0; i < trackEntries.length; i++) {
                    var entry = trackEntries[i];
                    var laps = entry.laps || 1;
                    if (laps >= 1 && laps <= 3) {
                        if (!bestTimes[laps] || entry.time < bestTimes[laps].time) {
                            bestTimes[laps] = entry;
                        }
                    }
                }
            }
        }

        // Update the display elements
        for (var lapCount = 1; lapCount <= 3; lapCount++) {
            var element = document.getElementById('bestTime' + lapCount);
            if (element) {
                if (bestTimes[lapCount]) {
                    element.textContent = this.formatTime(bestTimes[lapCount].time);
                    element.style.color = '#00ff00'; // Green for recorded times
                } else {
                    element.textContent = '--:--';
                    element.style.color = '#666666'; // Gray for no times
                }
            }
        }
    }
};

// Initialize leaderboard when page loads
Leaderboard.init();

// Update best times display when main menu is shown
document.addEventListener('DOMContentLoaded', function() {
    // Override showMenu to update best times when main menu is displayed
    var originalShowMenu = window.showMenu;
    window.showMenu = function(menuName) {
        originalShowMenu(menuName);
        if (menuName === 'main') {
            setTimeout(function() {
                Leaderboard.updateBestTimesDisplay();
            }, 100);
        }
    };
});
