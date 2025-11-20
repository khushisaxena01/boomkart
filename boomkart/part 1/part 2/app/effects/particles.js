/* particles.js - Enhanced particle system with optimizations
   Attaches to window.Effects
   Requires THREE.js
*/
(function(window){
  'use strict';
  
  window.Effects = window.Effects || {};

  /**
   * ParticleSystem - General purpose particle emitter
   * Optimized for dust trails, explosions, and effects
   */
  function ParticleSystem(params){
    params = params || {};
    
    this.max = params.max || 400;
    this.spriteUrl = params.spriteUrl || 'graphics/particles/dust.png';
    this.size = params.size || 0.18;
    this.gravity = params.gravity !== undefined ? params.gravity : -0.8;
    this.damping = params.damping || 0.98; // Air resistance
    this.scene = params.scene;
    this.color = params.color || 0xffffff;
    
    this._poolIndex = 0;
    this._activeCount = 0;

    // Create geometry with buffer attributes
    const geom = new THREE.BufferGeometry();
    const pos = new Float32Array(this.max * 3);
    const vel = new Float32Array(this.max * 3);
    const life = new Float32Array(this.max);
    const alpha = new Float32Array(this.max);

    // Initialize positions off-screen
    for(let i = 0; i < this.max * 3; i += 3) {
      pos[i] = pos[i+1] = pos[i+2] = 99999;
    }

    // Compatibility with older THREE.js versions
    if (geom.setAttribute) {
      geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geom.setAttribute('aVelocity', new THREE.BufferAttribute(vel, 3));
      geom.setAttribute('aLife', new THREE.BufferAttribute(life, 1));
      geom.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
    } else {
      geom.addAttribute('position', new THREE.BufferAttribute(pos, 3));
      geom.addAttribute('aVelocity', new THREE.BufferAttribute(vel, 3));
      geom.addAttribute('aLife', new THREE.BufferAttribute(life, 1));
      geom.addAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
    }

    // Load texture with fallback
    const tex = this.createFallbackTexture();
    const mat = new THREE.PointsMaterial({
      map: tex,
      size: this.size,
      transparent: true,
      depthWrite: false,
      blending: params.blending || THREE.AdditiveBlending,
      color: this.color,
      opacity: 0.8,
      sizeAttenuation: true
    });
    
    // Load external texture if provided
    if(this.spriteUrl) {
      const loader = new THREE.TextureLoader();
      loader.load(
        this.spriteUrl,
        function(texture) {
          mat.map = texture;
          mat.needsUpdate = true;
        },
        undefined,
        function(err) {
          console.warn('Particle texture load failed, using fallback');
        }
      );
    }

    this.points = new THREE.Points(geom, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 100; // Render after most objects
    
    this.geom = geom;
    this.pos = pos;
    this.vel = vel;
    this.life = life;
    this.alpha = alpha;
    this.mat = mat;
    
    if(this.scene) {
      this.scene.add(this.points);
    }
  }

  /**
   * Create fallback texture (canvas-based gradient)
   */
  ParticleSystem.prototype.createFallbackTexture = function(){
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);
    
    return new THREE.CanvasTexture(canvas);
  };

  /**
   * Emit a single particle
   */
  ParticleSystem.prototype.emit = function(x, y, z, vx, vy, vz, lifetime){
    const i = this._poolIndex % this.max;
    const base = i * 3;
    
    this.pos[base] = x;
    this.pos[base+1] = y;
    this.pos[base+2] = z;
    this.vel[base] = vx || 0;
    this.vel[base+1] = vy || 0;
    this.vel[base+2] = vz || 0;
    this.life[i] = lifetime || 1.0;
    this.alpha[i] = 1.0;
    
    this._poolIndex++;
    this._activeCount = Math.min(this._activeCount + 1, this.max);
  };

  /**
   * Emit a burst of particles (explosion effect)
   */
  ParticleSystem.prototype.emitBurst = function(x, y, z, count, speed, spread, life){
    count = count || 20;
    speed = speed || 0.8;
    spread = spread || 1.0;
    life = life || 1.2;
    
    for(let i = 0; i < count; i++){
      // Random spherical distribution
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      
      const vx = Math.sin(phi) * Math.cos(theta) * speed * spread;
      const vy = Math.abs(Math.sin(phi) * Math.sin(theta) * speed) * 0.8; // Bias upward
      const vz = Math.cos(phi) * speed * spread;
      
      const particleLife = life * (0.7 + Math.random() * 0.6);
      this.emit(x, y, z, vx, vy, vz, particleLife);
    }
  };

  /**
   * Emit particles in a cone (directional spray)
   */
  ParticleSystem.prototype.emitCone = function(x, y, z, dirX, dirY, dirZ, count, speed, angle){
    count = count || 5;
    speed = speed || 0.5;
    angle = angle || 0.3; // Radians
    
    // Normalize direction
    const len = Math.sqrt(dirX*dirX + dirY*dirY + dirZ*dirZ);
    dirX /= len; dirY /= len; dirZ /= len;
    
    for(let i = 0; i < count; i++){
      // Random angle within cone
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * angle;
      
      // Rotate direction vector
      const vx = dirX + Math.cos(theta) * Math.sin(phi);
      const vy = dirY + Math.sin(theta) * Math.sin(phi);
      const vz = dirZ + Math.cos(phi);
      
      const s = speed * (0.8 + Math.random() * 0.4);
      this.emit(x, y, z, vx * s, vy * s, vz * s, 0.8 + Math.random() * 0.4);
    }
  };

  /**
   * Update all particles
   */
  ParticleSystem.prototype.update = function(dt){
    if(!dt || dt <= 0) return;
    
    const pos = this.pos;
    const vel = this.vel;
    const life = this.life;
    const alpha = this.alpha;
    const max = this.max;
    
    let activeCount = 0;
    
    for(let i = 0; i < max; i++){
      const base = i * 3;
      
      if(life[i] > 0){
        activeCount++;
        
        // Apply gravity
        vel[base+1] += this.gravity * dt;
        
        // Apply damping (air resistance)
        vel[base] *= this.damping;
        vel[base+1] *= this.damping;
        vel[base+2] *= this.damping;
        
        // Update position
        pos[base] += vel[base] * dt;
        pos[base+1] += vel[base+1] * dt;
        pos[base+2] += vel[base+2] * dt;
        
        // Ground collision with bounce
        if(pos[base+1] < 0.05){
          pos[base+1] = 0.05;
          vel[base] *= 0.5; // Friction
          vel[base+2] *= 0.5;
          vel[base+1] *= -0.3; // Bounce
          life[i] *= 0.6; // Lose life on bounce
        }
        
        // Update lifetime and alpha
        life[i] -= dt;
        alpha[i] = Math.max(0, life[i]); // Fade out
        
        if(life[i] <= 0){
          // Move off-screen when dead
          pos[base] = pos[base+1] = pos[base+2] = 99999;
        }
      }
    }
    
    this._activeCount = activeCount;
    
    // Mark buffers for update
    this.geom.attributes.position.needsUpdate = true;
    this.geom.attributes.aVelocity.needsUpdate = true;
    this.geom.attributes.aLife.needsUpdate = true;
    this.geom.attributes.aAlpha.needsUpdate = true;
  };

  /**
   * Set particle color
   */
  ParticleSystem.prototype.setColor = function(color){
    this.mat.color.set(color);
  };

  /**
   * Get number of active particles
   */
  ParticleSystem.prototype.getActiveCount = function(){
    return this._activeCount;
  };

  /**
   * Clear all particles
   */
  ParticleSystem.prototype.clear = function(){
    for(let i = 0; i < this.max; i++){
      this.life[i] = 0;
      const base = i * 3;
      this.pos[base] = this.pos[base+1] = this.pos[base+2] = 99999;
    }
    this._activeCount = 0;
    this.geom.attributes.position.needsUpdate = true;
  };

  /**
   * Dispose and cleanup
   */
  ParticleSystem.prototype.dispose = function(){
    if(this.scene && this.points) {
      this.scene.remove(this.points);
    }
    if(this.geom) this.geom.dispose();
    if(this.mat) {
      if(this.mat.map) this.mat.map.dispose();
      this.mat.dispose();
    }
  };


  /**
   * RainSystem - Optimized rain particle system
   * Uses particle recycling for continuous rain
   */
  function RainSystem(params){
    params = params || {};
    
    this.count = params.count || 1000;
    this.scene = params.scene;
    this.intensity = params.intensity || 1.0;
    this.spread = params.spread || 80;
    this.enabled = true;
    
    const geom = new THREE.BufferGeometry();
    const pos = new Float32Array(this.count * 3);
    const vel = new Float32Array(this.count * 3);
    const alpha = new Float32Array(this.count);

    // Initialize rain particles
    for(let i = 0; i < this.count; i++){
      const base = i * 3;
      pos[base] = (Math.random() - 0.5) * this.spread;
      pos[base+1] = Math.random() * 30 + 10;
      pos[base+2] = (Math.random() - 0.5) * this.spread;
      
      vel[base] = (Math.random() - 0.5) * 0.5; // Slight wind
      vel[base+1] = -(8 + Math.random() * 8); // Fall speed
      vel[base+2] = 0;
      
      alpha[i] = 0.3 + Math.random() * 0.4;
    }

    // Compatibility check
    if (geom.setAttribute) {
      geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geom.setAttribute('aVelocity', new THREE.BufferAttribute(vel, 3));
      geom.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
    } else {
      geom.addAttribute('position', new THREE.BufferAttribute(pos, 3));
      geom.addAttribute('aVelocity', new THREE.BufferAttribute(vel, 3));
      geom.addAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
    }
    
    // Create raindrop texture
    const tex = this.createRaindropTexture();
    
    const mat = new THREE.PointsMaterial({
      map: tex,
      size: 0.8,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      color: 0xaaccff,
      opacity: 0.6
    });
    
    this.points = new THREE.Points(geom, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 99;
    
    this.geom = geom;
    this.pos = pos;
    this.vel = vel;
    this.alpha = alpha;
    this.mat = mat;
    
    if(this.scene) {
      this.scene.add(this.points);
    }
  }

  /**
   * Create raindrop texture (vertical streak)
   */
  RainSystem.prototype.createRaindropTexture = function(){
    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    
    const gradient = ctx.createLinearGradient(0, 0, 0, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
    gradient.addColorStop(0.3, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.7, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 8, 32);
    
    return new THREE.CanvasTexture(canvas);
  };

  /**
   * Update rain particles
   */
  RainSystem.prototype.update = function(dt, camPos){
    if(!this.enabled || !dt || dt <= 0) return;
    
    const pos = this.pos;
    const vel = this.vel;
    const cnt = this.count;
    
    // Use camera position or default
    const cx = camPos ? camPos.x : 0;
    const cy = camPos ? camPos.y : 10;
    const cz = camPos ? camPos.z : 0;
    
    for(let i = 0; i < cnt; i++){
      const base = i * 3;
      
      // Update position
      pos[base] += vel[base] * dt * this.intensity;
      pos[base+1] += vel[base+1] * dt * this.intensity;
      pos[base+2] += vel[base+2] * dt * this.intensity;
      
      // Recycle particles that hit ground or fall too far
      if(pos[base+1] < 0 || pos[base+1] < cy - 20){
        // Respawn near camera
        pos[base] = cx + (Math.random() - 0.5) * this.spread;
        pos[base+1] = cy + 20 + Math.random() * 15;
        pos[base+2] = cz + (Math.random() - 0.5) * this.spread;
        
        // Randomize velocity slightly
        vel[base] = (Math.random() - 0.5) * 0.5;
        vel[base+1] = -(8 + Math.random() * 8);
      }
    }
    
    this.geom.attributes.position.needsUpdate = true;
  };

  /**
   * Set rain intensity
   */
  RainSystem.prototype.setIntensity = function(intensity){
    this.intensity = Math.max(0, Math.min(2, intensity));
    this.mat.opacity = 0.3 + this.intensity * 0.3;
  };

  /**
   * Enable/disable rain
   */
  RainSystem.prototype.setEnabled = function(enabled){
    this.enabled = enabled;
    this.points.visible = enabled;
  };

  /**
   * Set wind direction
   */
  RainSystem.prototype.setWind = function(x, z){
    for(let i = 0; i < this.count; i++){
      const base = i * 3;
      this.vel[base] = x;
      this.vel[base+2] = z;
    }
    this.geom.attributes.aVelocity.needsUpdate = true;
  };

  /**
   * Dispose and cleanup
   */
  RainSystem.prototype.dispose = function(){
    if(this.scene && this.points) {
      this.scene.remove(this.points);
    }
    if(this.geom) this.geom.dispose();
    if(this.mat) {
      if(this.mat.map) this.mat.map.dispose();
      this.mat.dispose();
    }
  };


  /**
   * SnowSystem - Optimized snow particle system
   * Gentle falling snow with drift
   */
  function SnowSystem(params){
    params = params || {};
    
    this.count = params.count || 800;
    this.scene = params.scene;
    this.spread = params.spread || 100;
    this.enabled = true;
    
    const geom = new THREE.BufferGeometry();
    const pos = new Float32Array(this.count * 3);
    const vel = new Float32Array(this.count * 3);
    const size = new Float32Array(this.count);

    // Initialize snow particles
    for(let i = 0; i < this.count; i++){
      const base = i * 3;
      pos[base] = (Math.random() - 0.5) * this.spread;
      pos[base+1] = Math.random() * 40 + 5;
      pos[base+2] = (Math.random() - 0.5) * this.spread;
      
      vel[base] = (Math.random() - 0.5) * 0.3; // Drift
      vel[base+1] = -(0.5 + Math.random() * 1.5); // Gentle fall
      vel[base+2] = (Math.random() - 0.5) * 0.3;
      
      size[i] = 0.3 + Math.random() * 0.4;
    }

    // Compatibility check
    if (geom.setAttribute) {
      geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geom.setAttribute('aVelocity', new THREE.BufferAttribute(vel, 3));
      geom.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    } else {
      geom.addAttribute('position', new THREE.BufferAttribute(pos, 3));
      geom.addAttribute('aVelocity', new THREE.BufferAttribute(vel, 3));
      geom.addAttribute('aSize', new THREE.BufferAttribute(size, 1));
    }
    
    // Create snowflake texture
    const tex = this.createSnowTexture();
    
    const mat = new THREE.PointsMaterial({
      map: tex,
      size: 0.5,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      color: 0xffffff,
      opacity: 0.8
    });
    
    this.points = new THREE.Points(geom, mat);
    this.points.frustumCulled = false;
    
    this.geom = geom;
    this.pos = pos;
    this.vel = vel;
    this.size = size;
    this.mat = mat;
    this.driftPhase = 0;
    
    if(this.scene) {
      this.scene.add(this.points);
    }
  }

  /**
   * Create snowflake texture
   */
  SnowSystem.prototype.createSnowTexture = function(){
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);
    
    return new THREE.CanvasTexture(canvas);
  };

  /**
   * Update snow particles with drift
   */
  SnowSystem.prototype.update = function(dt, camPos){
    if(!this.enabled || !dt || dt <= 0) return;
    
    const pos = this.pos;
    const vel = this.vel;
    const cnt = this.count;
    
    this.driftPhase += dt * 0.5;
    
    const cx = camPos ? camPos.x : 0;
    const cy = camPos ? camPos.y : 10;
    const cz = camPos ? camPos.z : 0;
    
    for(let i = 0; i < cnt; i++){
      const base = i * 3;
      
      // Add gentle sine wave drift
      const drift = Math.sin(this.driftPhase + i * 0.1) * 0.02;
      
      pos[base] += (vel[base] + drift) * dt;
      pos[base+1] += vel[base+1] * dt;
      pos[base+2] += (vel[base+2] + drift) * dt;
      
      // Recycle particles
      if(pos[base+1] < 0 || pos[base+1] < cy - 25){
        pos[base] = cx + (Math.random() - 0.5) * this.spread;
        pos[base+1] = cy + 25 + Math.random() * 20;
        pos[base+2] = cz + (Math.random() - 0.5) * this.spread;
      }
    }
    
    this.geom.attributes.position.needsUpdate = true;
  };

  /**
   * Enable/disable snow
   */
  SnowSystem.prototype.setEnabled = function(enabled){
    this.enabled = enabled;
    this.points.visible = enabled;
  };

  /**
   * Dispose and cleanup
   */
  SnowSystem.prototype.dispose = function(){
    if(this.scene && this.points) {
      this.scene.remove(this.points);
    }
    if(this.geom) this.geom.dispose();
    if(this.mat) {
      if(this.mat.map) this.mat.map.dispose();
      this.mat.dispose();
    }
  };


  /**
   * SmokeSystem - Trail effect for boost/drift
   * Optimized for continuous emission
   */
  function SmokeSystem(params){
    params = params || {};
    
    this.max = params.max || 200;
    this.scene = params.scene;
    this.color = params.color || 0xcccccc;
    
    this._poolIndex = 0;
    
    const geom = new THREE.BufferGeometry();
    const pos = new Float32Array(this.max * 3);
    const vel = new Float32Array(this.max * 3);
    const life = new Float32Array(this.max);
    const scale = new Float32Array(this.max);
    
    // Initialize off-screen
    for(let i = 0; i < this.max * 3; i += 3) {
      pos[i] = pos[i+1] = pos[i+2] = 99999;
    }
    
    // Compatibility check for THREE.js versions
    if (geom.setAttribute) {
      geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geom.setAttribute('aVelocity', new THREE.BufferAttribute(vel, 3));
      geom.setAttribute('aLife', new THREE.BufferAttribute(life, 1));
      geom.setAttribute('aScale', new THREE.BufferAttribute(scale, 1));
    } else {
      geom.addAttribute('position', new THREE.BufferAttribute(pos, 3));
      geom.addAttribute('aVelocity', new THREE.BufferAttribute(vel, 3));
      geom.addAttribute('aLife', new THREE.BufferAttribute(life, 1));
      geom.addAttribute('aScale', new THREE.BufferAttribute(scale, 1));
    }
    
    const tex = this.createSmokeTexture();
    
    const mat = new THREE.PointsMaterial({
      map: tex,
      size: 0.4,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      color: this.color,
      opacity: 0.5
    });
    
    this.points = new THREE.Points(geom, mat);
    this.points.frustumCulled = false;
    
    this.geom = geom;
    this.pos = pos;
    this.vel = vel;
    this.life = life;
    this.scale = scale;
    this.mat = mat;
    
    if(this.scene) {
      this.scene.add(this.points);
    }
  }

  /**
   * Create smoke texture (soft cloud)
   */
  SmokeSystem.prototype.createSmokeTexture = function(){
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    
    // Multiple overlapping circles for cloud effect
    for(let i = 0; i < 5; i++){
      const x = 24 + Math.random() * 16;
      const y = 24 + Math.random() * 16;
      const r = 15 + Math.random() * 10;
      
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
      gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.15)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 64, 64);
    }
    
    return new THREE.CanvasTexture(canvas);
  };

  /**
   * Emit smoke particle
   */
  SmokeSystem.prototype.emit = function(x, y, z, vx, vy, vz){
    const i = this._poolIndex % this.max;
    const base = i * 3;
    
    this.pos[base] = x + (Math.random() - 0.5) * 0.2;
    this.pos[base+1] = y;
    this.pos[base+2] = z + (Math.random() - 0.5) * 0.2;
    
    this.vel[base] = (vx || 0) + (Math.random() - 0.5) * 0.1;
    this.vel[base+1] = (vy || 0.1) + Math.random() * 0.1;
    this.vel[base+2] = (vz || 0) + (Math.random() - 0.5) * 0.1;
    
    this.life[i] = 1.5 + Math.random() * 0.5;
    this.scale[i] = 0.3;
    
    this._poolIndex++;
  };

  /**
   * Update smoke particles (expand and fade)
   */
  SmokeSystem.prototype.update = function(dt){
    if(!dt || dt <= 0) return;
    
    const pos = this.pos;
    const vel = this.vel;
    const life = this.life;
    const scale = this.scale;
    
    for(let i = 0; i < this.max; i++){
      const base = i * 3;
      
      if(life[i] > 0){
        // Update position
        pos[base] += vel[base] * dt;
        pos[base+1] += vel[base+1] * dt;
        pos[base+2] += vel[base+2] * dt;
        
        // Expand over time
        scale[i] += dt * 0.3;
        
        // Slow down (dissipate)
        vel[base] *= 0.97;
        vel[base+1] *= 0.97;
        vel[base+2] *= 0.97;
        
        // Fade
        life[i] -= dt * 0.6;
        
        if(life[i] <= 0){
          pos[base] = pos[base+1] = pos[base+2] = 99999;
        }
      }
    }
    
    this.geom.attributes.position.needsUpdate = true;
    this.geom.attributes.aScale.needsUpdate = true;
    this.geom.attributes.aLife.needsUpdate = true;
  };

  /**
   * Dispose and cleanup
   */
  SmokeSystem.prototype.dispose = function(){
    if(this.scene && this.points) {
      this.scene.remove(this.points);
    }
    if(this.geom) this.geom.dispose();
    if(this.mat) {
      if(this.mat.map) this.mat.map.dispose();
      this.mat.dispose();
    }
  };


  // Export all systems to window.Effects
  window.Effects.ParticleSystem = ParticleSystem;
  window.Effects.RainSystem = RainSystem;
  window.Effects.SnowSystem = SnowSystem;
  window.Effects.SmokeSystem = SmokeSystem;

})(window);