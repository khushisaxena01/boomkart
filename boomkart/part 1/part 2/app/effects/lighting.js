(function(window){
  'use strict';
  
  window.Effects = window.Effects || {};
  
  function Lighting(scene, renderer, options){
    options = options || {};
    
    this.scene = scene;
    this.renderer = renderer;
    
    // Enable shadows with optimized settings
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Ambient light - fills shadows
    this.ambient = new THREE.AmbientLight(0xffffff, 0.35);
    this.scene.add(this.ambient);

    // sun light with shadows
    this.sun = new THREE.DirectionalLight(0xffffff, 1.0);
    this.sun.position.set(50, 80, 15);
    this.sun.castShadow = true;
    
    //shadow map settings
    this.sun.shadow.mapSize.width = options.shadowMapSize || 2048;
    this.sun.shadow.mapSize.height = options.shadowMapSize || 2048;
    this.sun.shadow.camera.near = 0.5;
    this.sun.shadow.camera.far = 500;
    this.sun.shadow.bias = -0.0001;
    
    // Shadow camera bounds
    const d = 120;
    this.sun.shadow.camera.left = -d;
    this.sun.shadow.camera.right = d;
    this.sun.shadow.camera.top = d;
    this.sun.shadow.camera.bottom = -d;
    this.scene.add(this.sun);

    // Hemisphere light - simulates sky/ground ambient
    this.hemi = new THREE.HemisphereLight(0xffffdd, 0x8899bb, 0.35);
    this.scene.add(this.hemi);

    this.glowLight = new THREE.PointLight(0xffffff, 0, 10);
    this.glowLight.visible = false;
    this.scene.add(this.glowLight);

    // Atmospheric fog
    this.scene.fog = new THREE.FogExp2(0xaabbd8, 0.0004);
    
    // Time of day state
    this.timeOfDay = options.startTime || 0.4; // Start at morning
    this.autoProgress = options.autoProgress !== undefined ? options.autoProgress : true;
    this.cycleSpeed = options.cycleSpeed || 0.003; // Slower, more realistic
    
    // Weather system
    this.weather = {
      rain: false,
      rainIntensity: 0,
      targetRainIntensity: 0,
      storm: false
    };
    
    // Color presets for different times
    this.colorPresets = {
      sunrise: { sky: 0xff9966, horizon: 0xffcc88, sun: 0xff8844, ambient: 0.4 },
      day: { sky: 0x87c3ff, horizon: 0xccddff, sun: 0xffffff, ambient: 0.8 },
      sunset: { sky: 0xff6633, horizon: 0xff9955, sun: 0xff5522, ambient: 0.5 },
      night: { sky: 0x061427, horizon: 0x0a1a3a, sun: 0x4466ff, ambient: 0.15 }
    };
    
    // Performance optimization
    this._updateCounter = 0;
    this._skipFrames = 2; // Update lighting every N frames
    
    // Initial update
    this.updateDayNight(0);
  }

  /**
   * Main update function - call every frame
   * @param {number} dt - Delta time in seconds
   */
  Lighting.prototype.update = function(dt){
    this._updateCounter++;
    
    // Skip frames for performance (lighting doesn't need 60fps updates)
    if(this._updateCounter % this._skipFrames !== 0) return;
    
    if(this.autoProgress && dt > 0) {
      this.timeOfDay = (this.timeOfDay + dt * this.cycleSpeed) % 1;
    }
    
    this.updateDayNight(dt);
    this.updateWeather(dt);
  };

  /**
   * Update day/night cycle lighting
   * @param {number} dt - Delta time (optional, for auto-progression)
   */
  Lighting.prototype.updateDayNight = function(dt){
    const t = this.timeOfDay;
    const ang = t * Math.PI * 2;
    
    // Sun position follows circular arc
    const radius = 150;
    const sunHeight = Math.sin(ang);
    const sunX = Math.cos(ang) * radius;
    const sunY = Math.max(-20, Math.sin(ang) * radius);
    const sunZ = 40;
    
    this.sun.position.set(sunX, sunY, sunZ);
    
    // Calculate intensity based on sun height
    const rawIntensity = Math.max(0, sunHeight);
    const intensity = Math.pow(rawIntensity, 0.7); // Softer curve
    
    // Determine time of day phase
    const phase = this.getTimePhase(t);
    
    // Interpolate colors based on phase
    let skyColor, horizonColor, sunColor, ambientIntensity;
    
    if(phase.name === 'sunrise' || phase.name === 'sunset') {
      // Golden hour colors
      const preset = this.colorPresets[phase.name];
      skyColor = new THREE.Color(preset.sky);
      horizonColor = new THREE.Color(preset.horizon);
      sunColor = new THREE.Color(preset.sun);
      ambientIntensity = preset.ambient * phase.blend;
    } else if(phase.name === 'day') {
      // Bright daylight
      const preset = this.colorPresets.day;
      skyColor = new THREE.Color(preset.sky);
      horizonColor = new THREE.Color(preset.horizon);
      sunColor = new THREE.Color(preset.sun);
      ambientIntensity = preset.ambient;
    } else {
      // Night time - moonlight
      const preset = this.colorPresets.night;
      skyColor = new THREE.Color(preset.sky);
      horizonColor = new THREE.Color(preset.horizon);
      sunColor = new THREE.Color(preset.sun);
      ambientIntensity = preset.ambient;
    }
    
    // Apply sun color and intensity
    this.sun.color.copy(sunColor);
    this.sun.intensity = 0.3 + intensity * 1.4;
    
    // Ambient and hemisphere lights
    this.ambient.intensity = 0.2 + ambientIntensity * 0.6;
    this.hemi.intensity = 0.15 + intensity * 0.4;
    
    // Update hemisphere colors (sky/ground)
    this.hemi.color.copy(horizonColor);
    this.hemi.groundColor.setHSL(0.6, 0.3, 0.15 + intensity * 0.2);
    
    // Scene background - blend sky and horizon
    const bgColor = skyColor.clone().lerp(horizonColor, 0.3);
    this.scene.background = bgColor;
    
    // Fog color and density
    const fogColor = skyColor.clone().lerp(horizonColor, 0.5);
    this.scene.fog.color.copy(fogColor);
    
    // Fog density - thicker at night and dawn/dusk
    const baseDensity = 0.0003;
    const nightBonus = (1 - intensity) * 0.0008;
    this.scene.fog.density = baseDensity + nightBonus;
  };

  /**
   * Determine which time phase we're in
   * @param {number} t - Time of day (0-1)
   * @returns {object} Phase info with name and blend factor
   */
  Lighting.prototype.getTimePhase = function(t){
    // Time phases:
    // 0.0-0.15: night
    // 0.15-0.25: sunrise
    // 0.25-0.65: day
    // 0.65-0.75: sunset
    // 0.75-1.0: night
    
    if(t < 0.15) {
      return { name: 'night', blend: 1.0 };
    } else if(t < 0.25) {
      const blend = (t - 0.15) / 0.1;
      return { name: 'sunrise', blend: blend };
    } else if(t < 0.65) {
      return { name: 'day', blend: 1.0 };
    } else if(t < 0.75) {
      const blend = (t - 0.65) / 0.1;
      return { name: 'sunset', blend: blend };
    } else {
      return { name: 'night', blend: 1.0 };
    }
  };

  /**
   * Update weather effects (rain, fog)
   * @param {number} dt - Delta time
   */
  Lighting.prototype.updateWeather = function(dt){
    // Smoothly interpolate rain intensity
    const lerpSpeed = 0.5 * dt;
    this.weather.rainIntensity += (this.weather.targetRainIntensity - this.weather.rainIntensity) * lerpSpeed;
    
    if(this.weather.rain) {
      // Increase fog during rain
      const rainFog = this.weather.rainIntensity * 0.0015;
      this.scene.fog.density += rainFog;
      
      // Darken ambient during heavy rain
      const rainDarken = this.weather.rainIntensity * 0.3;
      this.ambient.intensity = Math.max(0.1, this.ambient.intensity - rainDarken);
      
      // Glow light for lightning effect (if storm)
      if(this.weather.storm && Math.random() < 0.002) {
        this.triggerLightning();
      }
    }
  };

  /**
   * Enable rain weather effect
   * @param {number} intensity - 0 to 1
   */
  Lighting.prototype.enableRain = function(intensity){
    this.weather.rain = true;
    this.weather.targetRainIntensity = Math.max(0, Math.min(1, intensity || 0.7));
  };

  /**
   * Disable rain weather effect
   */
  Lighting.prototype.disableRain = function(){
    this.weather.rain = false;
    this.weather.targetRainIntensity = 0;
  };

  /**
   * Enable storm mode (rain + lightning)
   */
  Lighting.prototype.enableStorm = function(){
    this.enableRain(1.0);
    this.weather.storm = true;
  };

  /**
   * Disable storm mode
   */
  Lighting.prototype.disableStorm = function(){
    this.weather.storm = false;
    this.disableRain();
  };

  /**
   * Trigger lightning flash effect
   */
  Lighting.prototype.triggerLightning = function(){
    const self = this;
    
    // Flash the ambient light
    const originalIntensity = this.ambient.intensity;
    this.ambient.intensity = 2.0;
    
    // Enable glow light at random position
    this.glowLight.intensity = 3.0;
    this.glowLight.position.set(
      (Math.random() - 0.5) * 200,
      50 + Math.random() * 50,
      (Math.random() - 0.5) * 200
    );
    this.glowLight.visible = true;
    
    // Fade out after short delay
    setTimeout(function(){
      self.ambient.intensity = originalIntensity;
      self.glowLight.visible = false;
    }, 100 + Math.random() * 100);
  };

  /**
   * Set time of day manually
   * @param {number} time - 0 to 1 (0=midnight, 0.5=noon)
   */
  Lighting.prototype.setTimeOfDay = function(time){
    this.timeOfDay = Math.max(0, Math.min(1, time));
    this.updateDayNight(0);
  };

  /**
   * Toggle auto-progression of day/night cycle
   * @param {boolean} enabled
   */
  Lighting.prototype.setAutoProgress = function(enabled){
    this.autoProgress = enabled;
  };

  /**
   * Set cycle speed
   * @param {number} speed - Multiplier for cycle speed
   */
  Lighting.prototype.setCycleSpeed = function(speed){
    this.cycleSpeed = Math.max(0, speed);
  };

  /**
   * Add dynamic light to follow an object (e.g., kart headlights)
   * @param {THREE.Vector3} position - Position to place light
   * @param {number} intensity - Light intensity
   * @param {number} distance - Light distance
   * @returns {THREE.PointLight} The created light
   */
  Lighting.prototype.addDynamicLight = function(position, intensity, distance){
    const light = new THREE.PointLight(0xffeecc, intensity || 1.0, distance || 15);
    light.position.copy(position);
    light.castShadow = false; // Performance optimization
    this.scene.add(light);
    return light;
  };

  /**
   * Cleanup - remove all lights
   */
  Lighting.prototype.dispose = function(){
    if(this.ambient) this.scene.remove(this.ambient);
    if(this.sun) this.scene.remove(this.sun);
    if(this.hemi) this.scene.remove(this.hemi);
    if(this.glowLight) this.scene.remove(this.glowLight);
    this.scene.fog = null;
  };

  // Export to window
  window.Effects.Lighting = Lighting;

})(window);