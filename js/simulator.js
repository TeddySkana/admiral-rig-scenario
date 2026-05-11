(() => {
  const canvas = document.getElementById('simCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const mini = document.getElementById('miniCanvas');
  const mctx = mini.getContext('2d');

  const UI = {
    play: document.getElementById('playBtn'),
    pause: document.getElementById('pauseBtn'),
    reset: document.getElementById('resetBtn'),
    speedButtons: Array.from(document.querySelectorAll('.speed-btn')),
    fps: document.querySelector('#fpsBadge strong'),
    time: document.getElementById('missionTime'),
    live: document.getElementById('liveThreats'),
    tracking: document.getElementById('trackingCount'),
    hostile: document.getElementById('hostileCount'),
    missionStatus: document.getElementById('missionStatus'),
    log: document.getElementById('eventLog'),
    table: document.getElementById('threatTable'),
    scenarioSeed: document.getElementById('scenarioSeed'),
    modal: document.getElementById('approvalModal'),
    approvalCard: document.getElementById('approvalCard'),
    approvalTitle: document.getElementById('approvalTitle'),
    approvalText: document.getElementById('approvalText'),
    confirmApproval: document.getElementById('confirmApprovalBtn'),
    cancelApproval: document.getElementById('cancelApprovalBtn'),
    video: document.getElementById('videoFeed'),
    videoThreatId: document.getElementById('videoThreatId'),
    mapNotice: document.getElementById('mapNotice'),
    logic: {
      detect: document.getElementById('logicDetect'),
      challenge: document.getElementById('logicChallenge'),
      intercept: document.getElementById('logicIntercept'),
      approval: document.getElementById('logicApproval'),
      weapon: document.getElementById('logicWeapon'),
      recover: document.getElementById('logicRecover')
    }
  };

  const YD_PER_STATUTE_MILE = 1760;
  const YD_PER_NAUTICAL_MILE = 2025.3718;
  const KNOT_TO_YD_PER_SEC = YD_PER_NAUTICAL_MILE / 3600;
  const DEG = Math.PI / 180;
  const TWO_PI = Math.PI * 2;

  const COLORS = {
    grid: 'rgba(107, 174, 209, 0.13)',
    gridStrong: 'rgba(107, 174, 209, 0.22)',
    waterA: '#082f46',
    waterB: '#0a3850',
    rig: '#e7f0fa',
    blue: '#5fb8ff',
    green: '#72efb1',
    neutral: '#72efb1',
    orange: '#ff9c3d',
    red: '#ff5967',
    gray: '#8899a6',
    yellow: '#ffe381',
    white: '#eaf3ff'
  };

  const CONFIG = {
    missionDurationSec: 11 * 3600,
    radarRangeYd: 20000,
    staticRingYd: 500,
    patrolRingYd: 3000,
    protectedPolyYd: 5000,
    magRangeYd: 2000,
    magHitProbability: 0.70,
    safetyFromTargetYd: 500,
    reserveLaunchDelaySec: 5 * 60,
    maxSpeedKt: 50,
    cruiseSpeedKt: 22,
    interceptSpeedKt: 40,
    zigzagSpeedKt: 20,
    warningSpeedKt: 30,
    enemySlowKt: 5,
    enemyAttackKt: 45,
    hostileZigzagChance: 0.80,
    hostileZigzagSpeedKt: 20,
    neutralTrafficSpeedKt: 12,
    enemySpawnRadiusYd: 15000,
    yardsVisibleX: 15 * YD_PER_NAUTICAL_MILE,
    yardsVisibleY: 15 * YD_PER_NAUTICAL_MILE,
    safeBowConeRad: 34 * DEG
  };

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function rand(min, max) { return min + Math.random() * (max - min); }
  function choice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function len(v) { return Math.hypot(v.x, v.y); }
  function norm(v) { const l = len(v) || 1; return { x: v.x / l, y: v.y / l }; }
  function angleTo(a, b) { return Math.atan2(b.y - a.y, b.x - a.x); }
  function wrapAngle(a) {
    while (a > Math.PI) a -= TWO_PI;
    while (a < -Math.PI) a += TWO_PI;
    return a;
  }
  function angleDiff(a, b) { return Math.abs(wrapAngle(a - b)); }
  function polar(r, a) { return { x: Math.cos(a) * r, y: Math.sin(a) * r }; }
  function ktToYdSec(kt) { return kt * KNOT_TO_YD_PER_SEC; }
  function formatTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  function statusColor(status) {
    if (status === 'unknown' || status === 'compliant') return COLORS.green;
    if (status === 'suspicious' || status === 'intercepting') return COLORS.orange;
    if (status === 'hostile' || status === 'engaging') return COLORS.red;
    if (status === 'neutralized' || status === 'left-area') return COLORS.gray;
    return COLORS.blue;
  }
  function lineInterpolate(a, b, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }

  class Boat {
    constructor(id, type, x, y, heading, opts = {}) {
      this.id = id;
      this.type = type;
      this.x = x;
      this.y = y;
      this.heading = heading;
      this.speedKt = opts.speedKt || 0;
      this.status = opts.status || 'patrol';
      this.lengthYd = opts.lengthYd || 20;
      this.widthYd = opts.widthYd || 7;
      this.role = opts.role || 'none';
      this.targetId = null;
      this.assignedTo = null;
      this.detected = opts.detected || false;
      this.responds = opts.responds || false;
      this.approval = 'none';
      this.nextShotAt = 0;
      this.magMissed = false;
      this.disabled = false;
      this.visible = opts.visible !== false;
      this.launchReadyAt = opts.launchReadyAt || 0;
      this.patrolAngle = opts.patrolAngle || 0;
      this.zigzagDir = 1;
      this.zigzagClock = 0;
      this.evasiveZigzag = false;
      this.threeDots = this.computeDots();
    }

    pos() { return { x: this.x, y: this.y }; }

    setPos(p) { this.x = p.x; this.y = p.y; this.threeDots = this.computeDots(); }

    computeDots() {
      const forward = { x: Math.cos(this.heading), y: Math.sin(this.heading) };
      const side = { x: -forward.y, y: forward.x };
      const scale = this.type === 'blue' ? 10 : 11;
      return [
        { x: this.x + forward.x * scale, y: this.y + forward.y * scale, tag: 'bow' },
        { x: this.x - forward.x * scale * 0.55 + side.x * scale * 0.28, y: this.y - forward.y * scale * 0.55 + side.y * scale * 0.28, tag: 'port' },
        { x: this.x - forward.x * scale * 0.55 - side.x * scale * 0.28, y: this.y - forward.y * scale * 0.55 - side.y * scale * 0.28, tag: 'starboard' }
      ];
    }

    move(dt, desiredHeading, speedKt) {
      if (this.disabled) return;
      this.heading = desiredHeading;
      this.speedKt = speedKt;
      this.x += Math.cos(this.heading) * ktToYdSec(speedKt) * dt;
      this.y += Math.sin(this.heading) * ktToYdSec(speedKt) * dt;
      this.threeDots = this.computeDots();
    }
  }

  class OffshoreSimulator {
    constructor() {
      this.running = false;
      this.speedMultiplier = 1;
      this.lastFrame = 0;
      this.frameCounter = 0;
      this.frameTime = 0;
      this.fps = 0;
      this.reset();
      this.bindEvents();
      requestAnimationFrame(this.frame.bind(this));
    }

    reset() {
      this.time = 0;
      this.events = [];
      this.outcome = 'Nominal';
      if (this.approvalTimer) clearTimeout(this.approvalTimer);
      if (this.mapNoticeTimer) clearTimeout(this.mapNoticeTimer);
      this.approvalTimer = null;
      this.mapNoticeTimer = null;
      if (UI.mapNotice) UI.mapNotice.classList.add('hidden');
      this.pendingApprovalThreatId = null;
      this.approvalPauseActive = false;
      this.modalOpen = false;
      this.rig = { x: 0, y: 0 };
      this.attackMode = Math.random() < 0.5 ? 'coordinated' : 'separated';
      this.blue = [];
      this.threats = [];
      this.neutrals = [];
      this.reserveRequested = false;
      this.reserveLaunched = false;
      this.initBoats();
      this.initThreatSchedule();
      this.initNeutralTraffic();
      this.log('00:00', 'Mission loaded. Dynamic patrol, static guard, reserve boat, and neutral traffic are initialized.');
      this.log('00:00', this.describeSchedule());
      this.hideApproval(true);
      this.updateSeedPanel();
      this.updateUI();
    }

    initBoats() {
      const p401 = polar(CONFIG.patrolRingYd, -65 * DEG);
      const p402 = polar(CONFIG.staticRingYd, 122 * DEG);
      this.blue.push(new Boat('BS 401', 'blue', p401.x, p401.y, -65 * DEG + Math.PI / 2, { role: 'dynamic-patrol', speedKt: CONFIG.cruiseSpeedKt, patrolAngle: -65 * DEG }));
      this.blue.push(new Boat('BS 402', 'blue', p402.x, p402.y, angleTo(p402, this.rig), { role: 'static-guard', speedKt: 0 }));
      this.blue.push(new Boat('BS 403', 'blue', 0, 0, 0, { role: 'reserve', status: 'reserve', visible: true, speedKt: 0 }));
    }

    outsideMapPoint(angle, margin = 2400) {
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      const halfX = CONFIG.yardsVisibleX / 2;
      const halfY = CONFIG.yardsVisibleY / 2;
      const rx = Math.abs(c) < 1e-6 ? Infinity : halfX / Math.abs(c);
      const ry = Math.abs(s) < 1e-6 ? Infinity : halfY / Math.abs(s);
      return polar(Math.min(rx, ry) + margin, angle);
    }

    isOutsideMapPoint(point, margin = 0) {
      return Math.abs(point.x) > CONFIG.yardsVisibleX / 2 + margin || Math.abs(point.y) > CONFIG.yardsVisibleY / 2 + margin;
    }

    initThreatSchedule() {
      let times;
      if (this.attackMode === 'coordinated') {
        const t = rand(5 * 60, 15 * 60);
        // Coordinated attack: both hostile boats enter together. Because both
        // start at the same 15000 yd radius and use the same profile, they
        // arrive at the radar ring and the rig together, from different angles.
        times = [t, t];
      } else {
        times = [rand(5 * 60, 10 * 60), rand(15 * 60, 20 * 60)];
      }
      times.sort((a, b) => a - b);
      const usedAngles = [];
      times.forEach((activationTime, i) => {
        let a = rand(0, TWO_PI);
        if (usedAngles.length) {
          const separation = rand(110 * DEG, 230 * DEG);
          a = usedAngles[0] + choice([-1, 1]) * separation;
        }
        usedAngles.push(a);
        const start = polar(CONFIG.enemySpawnRadiusYd, a);
        const heading = angleTo(start, this.rig);
        const responds = Math.random() < 0.30;
        const b = new Boat(`TH-${String(i + 1).padStart(2, '0')}`, 'threat', start.x, start.y, heading, {
          role: 'threat',
          status: 'unknown',
          speedKt: CONFIG.enemySlowKt,
          visible: false,
          detected: false,
          responds
        });
        b.activationTime = activationTime;
        b.spawnRadiusYd = CONFIG.enemySpawnRadiusYd;
        b.enteredMapLogged = false;
        b.evasiveSeed = Math.random() < CONFIG.hostileZigzagChance;
        b.evasiveZigzagAngleDeg = rand(30, 60);
        b.complianceTurn = choice([-1, 1]);
        b.assignedBoats = [];
        b.bs402SupportLogged = false;
        b.massInterceptLogged = false;
        this.threats.push(b);
      });
    }

    initNeutralTraffic() {
      const halfX = CONFIG.yardsVisibleX / 2;
      const halfY = CONFIG.yardsVisibleY / 2;
      let start;
      let end;
      let pathClearanceYd = 0;

      // Civilian traffic is sampled as a short corner transit from outside one
      // map edge to outside an adjacent edge. This keeps the dashed white path
      // visible inside the map while avoiding the large radar ring.
      let foundSafePath = false;
      for (let attempt = 0; attempt < 250; attempt += 1) {
        const sx = choice([-1, 1]);
        const sy = choice([-1, 1]);
        const marginA = rand(1200, 3000);
        const marginB = rand(1200, 3000);
        const xNearCorner = sx * rand(Math.max(0, halfX - 900), halfX + 1400);
        const yNearCorner = sy * rand(Math.max(0, halfY - 900), halfY + 1400);
        if (Math.random() < 0.5) {
          start = { x: xNearCorner, y: sy * (halfY + marginA) };
          end = { x: sx * (halfX + marginB), y: yNearCorner };
        } else {
          start = { x: sx * (halfX + marginA), y: yNearCorner };
          end = { x: xNearCorner, y: sy * (halfY + marginB) };
        }
        if (Math.random() < 0.5) [start, end] = [end, start];
        pathClearanceYd = this.distancePointToSegment(this.rig, start, end);
        if (pathClearanceYd > CONFIG.radarRangeYd + 150) {
          foundSafePath = true;
          break;
        }
      }

      if (!foundSafePath) {
        const sx = choice([-1, 1]);
        const sy = choice([-1, 1]);
        start = { x: sx * (halfX - 90), y: sy * (halfY + 2600) };
        end = { x: sx * (halfX + 2600), y: sy * (halfY - 90) };
        if (Math.random() < 0.5) [start, end] = [end, start];
        pathClearanceYd = this.distancePointToSegment(this.rig, start, end);
      }

      const civilian = new Boat('CV-01', 'neutral', start.x, start.y, angleTo(start, end), {
        role: 'neutral-traffic',
        status: 'civilian',
        speedKt: CONFIG.neutralTrafficSpeedKt,
        visible: true,
        detected: true,
        lengthYd: 26,
        widthYd: 8
      });
      civilian.pathStart = start;
      civilian.pathEnd = end;
      civilian.pathClearanceYd = pathClearanceYd;
      this.neutrals.push(civilian);
      this.log('00:00', `${civilian.id} neutral civilian transit is present on a dashed white path outside the ${CONFIG.radarRangeYd.toLocaleString()} yd radar ring.`);
    }

    distancePointToSegment(point, a, b) {
      return dist(point, this.closestPointOnSegment(point, a, b));
    }

    closestPointOnSegment(point, a, b) {
      const ab = { x: b.x - a.x, y: b.y - a.y };
      const ap = { x: point.x - a.x, y: point.y - a.y };
      const abLenSq = ab.x * ab.x + ab.y * ab.y || 1;
      const t = clamp((ap.x * ab.x + ap.y * ab.y) / abLenSq, 0, 1);
      return { x: a.x + ab.x * t, y: a.y + ab.y * t };
    }

    closestPointOnCircle(point, radiusYd) {
      const a = angleTo(this.rig, point);
      return polar(radiusYd, a);
    }

    blockingPointFor(interceptor, target) {
      const targetPos = target.pos();
      const targetBearing = angleTo(this.rig, targetPos);
      const targetRigRange = dist(targetPos, this.rig);
      const closest = this.closestPointOnSegment(interceptor.pos(), this.rig, targetPos);
      const closestRigRange = dist(closest, this.rig);

      // BS 401 first cuts to a point on the threat-to-rig line instead of
      // chasing the threat immediately. Keep that blocking point between the
      // patrol ring and the protected polygon while the target is outside 5000 yd.
      const minBlockRange = CONFIG.patrolRingYd;
      const maxBlockRange = Math.max(minBlockRange + 300, Math.min(CONFIG.protectedPolyYd, targetRigRange - 850));
      if (closestRigRange < minBlockRange || dist(closest, targetPos) < 850) {
        return polar(maxBlockRange, targetBearing);
      }
      return closest;
    }

    describeSchedule() {
      if (this.attackMode === 'coordinated') {
        return `Attack schedule decided on load: coordinated arrival, both boats spawn together at 15000 yd near ${formatTime(this.threats[0].activationTime)}.`;
      }
      return `Attack schedule decided on load: separated arrival from 15000 yd, first near ${formatTime(this.threats[0].activationTime)}, second near ${formatTime(this.threats[1].activationTime)}.`;
    }

    bindEvents() {
      UI.play.addEventListener('click', () => {
        if (this.approvalPauseActive) {
          this.logTime('Simulation is paused until the HQ approval popup receives a response.');
          return;
        }
        this.running = true;
      });
      UI.pause.addEventListener('click', () => { this.running = false; });
      UI.reset.addEventListener('click', () => { this.running = false; this.reset(); });
      UI.speedButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          this.setSpeedMultiplier(Number(btn.dataset.speed));
        });
      });
      UI.confirmApproval.addEventListener('click', () => this.confirmApproval());
      UI.cancelApproval.addEventListener('click', () => this.cancelApprovalDisplay());
      window.addEventListener('resize', () => this.draw());
    }

    frame(ts) {
      if (!this.lastFrame) this.lastFrame = ts;
      const realDt = Math.min(0.05, (ts - this.lastFrame) / 1000);
      this.lastFrame = ts;
      this.frameCounter += 1;
      this.frameTime += realDt;
      if (this.frameTime >= 0.5) {
        this.fps = Math.round(this.frameCounter / this.frameTime);
        this.frameCounter = 0;
        this.frameTime = 0;
      }
      if (this.running) {
        const simDt = realDt * this.speedMultiplier;
        this.step(simDt);
      }
      this.draw();
      requestAnimationFrame(this.frame.bind(this));
    }

    step(dt) {
      if (this.outcome.startsWith('Mission failed') || this.time > CONFIG.missionDurationSec) {
        this.running = false;
        return;
      }
      this.time += dt;
      this.updatePatrols(dt);
      this.updateReserve(dt);
      this.updateNeutralTraffic(dt);
      this.updateThreats(dt);
      this.enforceInterceptionAssignments();
      this.updateInterceptors(dt);
      this.updateMissionOutcome();
      this.refreshMissionLogicState();
      this.updateUI();
    }

    updatePatrols(dt) {
      const patrol = this.blue.find(b => b.id === 'BS 401');
      if (patrol && patrol.role === 'returning-patrol' && !patrol.targetId) {
        if (!patrol.returnPoint) patrol.returnPoint = this.closestPointOnCircle(patrol.pos(), CONFIG.patrolRingYd);
        const rangeToReturn = dist(patrol.pos(), patrol.returnPoint);
        if (rangeToReturn > 90) {
          patrol.status = 'returning-patrol';
          patrol.move(dt, angleTo(patrol.pos(), patrol.returnPoint), CONFIG.cruiseSpeedKt);
        } else {
          patrol.setPos(patrol.returnPoint);
          patrol.returnPoint = null;
          patrol.role = 'dynamic-patrol';
          patrol.patrolAngle = angleTo(this.rig, patrol.pos());
          patrol.status = 'patrol';
        }
      }
      if (patrol && patrol.role === 'dynamic-patrol' && !patrol.targetId) {
        const angularSpeed = ktToYdSec(CONFIG.cruiseSpeedKt) / CONFIG.patrolRingYd;
        patrol.patrolAngle += angularSpeed * dt;
        const p = polar(CONFIG.patrolRingYd, patrol.patrolAngle);
        patrol.x = p.x;
        patrol.y = p.y;
        patrol.heading = patrol.patrolAngle + Math.PI / 2;
        patrol.speedKt = CONFIG.cruiseSpeedKt;
        patrol.status = 'patrol';
        patrol.threeDots = patrol.computeDots();
      }
      const staticGuard = this.blue.find(b => b.id === 'BS 402');
      if (staticGuard && staticGuard.role === 'returning-static' && !staticGuard.targetId) {
        if (!staticGuard.returnPoint) staticGuard.returnPoint = this.closestPointOnCircle(staticGuard.pos(), CONFIG.staticRingYd);
        const rangeToReturn = dist(staticGuard.pos(), staticGuard.returnPoint);
        if (rangeToReturn > 65) {
          staticGuard.status = 'returning-static';
          staticGuard.move(dt, angleTo(staticGuard.pos(), staticGuard.returnPoint), CONFIG.cruiseSpeedKt);
        } else {
          staticGuard.setPos(staticGuard.returnPoint);
          staticGuard.returnPoint = null;
          staticGuard.role = 'static-guard';
          staticGuard.status = 'static-guard';
        }
      }
      if (staticGuard && staticGuard.role === 'static-guard' && !staticGuard.targetId) {
        staticGuard.status = 'static-guard';
        staticGuard.heading = angleTo(staticGuard.pos(), this.rig);
        staticGuard.threeDots = staticGuard.computeDots();
      }
    }

    updateReserve() {
      const reserve = this.blue.find(b => b.id === 'BS 403');
      if (reserve && this.reserveRequested && !this.reserveLaunched && this.time >= reserve.launchReadyAt) {
        this.reserveLaunched = true;
        reserve.role = 'interceptor';
        reserve.status = 'patrol';
        const p = polar(CONFIG.staticRingYd + 220, 20 * DEG);
        reserve.setPos(p);
        reserve.heading = 20 * DEG;
        this.logTime('Reserve BS 403 launched after the five minute readiness delay.');
        this.assignUncoveredThreats();
      }
    }

    requestReserve() {
      const reserve = this.blue.find(b => b.id === 'BS 403');
      if (!reserve || this.reserveRequested) return;
      this.reserveRequested = true;
      reserve.status = 'launching';
      reserve.launchReadyAt = this.time + CONFIG.reserveLaunchDelaySec;
      this.logTime('Reserve launch requested. BS 403 will be available in 5 minutes.');
    }

    updateNeutralTraffic(dt) {
      for (const n of this.neutrals) {
        if (n.status === 'left-area') continue;
        const desired = angleTo(n.pos(), n.pathEnd);
        n.move(dt, desired, n.speedKt || CONFIG.neutralTrafficSpeedKt);
        if (dist(n.pos(), n.pathEnd) < 220 || this.isOutsideMapPoint(n.pos(), 3200)) {
          n.status = 'left-area';
          n.visible = false;
          this.logTime(`${n.id} completed neutral transit. Its dashed path stayed outside the 20000 yd radar ring.`);
        }
      }
    }

    updateThreats(dt) {
      for (const t of this.threats) {
        if (t.status === 'neutralized' || t.status === 'left-area') continue;
        if (this.time < t.activationTime) continue;
        if (!t.enteredMapLogged) {
          t.enteredMapLogged = true;
          this.setSpeedMultiplier(10);
          this.logTime(`${t.id} entered the 15 x 15 NM map from ${Math.round(t.spawnRadiusYd || CONFIG.enemySpawnRadiusYd).toLocaleString()} yd. Simulation speed increased to x10.`);
        }

        const rangeRig = dist(t.pos(), this.rig);
        if (!t.detected && rangeRig <= CONFIG.radarRangeYd) {
          t.detected = true;
          t.visible = true;
          t.status = 'unknown';
          this.setLogic('detect');
          this.setSpeedMultiplier(10);
          this.logTime(`${t.id} discovered by rig radar at ${Math.round(rangeRig)} yd. Detection message appears before interception begins, and simulation speed increased to x10 before the radio-response decision.`);
          this.challengeThreat(t);
        }

        if (!t.detected) {
          t.move(dt, angleTo(t.pos(), this.rig), CONFIG.enemySlowKt);
          continue;
        }

        if (t.status === 'compliant') {
          this.moveCompliantThreat(t, dt);
          continue;
        }

        if (t.status === 'unknown') {
          t.move(dt, angleTo(t.pos(), this.rig), CONFIG.enemySlowKt);
          continue;
        }

        if (t.status === 'suspicious' || t.status === 'hostile' || t.status === 'engaging') {
          this.moveHostileThreat(t, dt);
          if (dist(t.pos(), this.rig) <= CONFIG.protectedPolyYd && t.status !== 'hostile') {
            t.status = 'hostile';
            this.setLogic('intercept', 'danger');
            this.logTime(`${t.id} penetrated the 5000 yd and is now hostile.`);
          }
        }

        if (Math.abs(t.x) > CONFIG.yardsVisibleX * 0.75 || Math.abs(t.y) > CONFIG.yardsVisibleY * 0.85) {
          if (t.status === 'compliant') {
            t.status = 'left-area';
            this.logTime(`${t.id} complied, avoided the protected polygon, and left the monitored area.`);
          }
        }
      }
    }

    challengeThreat(t) {
      this.setLogic('challenge');
      if (t.responds) {
        t.status = 'compliant';
        t.speedKt = 10;
        this.prepareCompliantEscape(t);
        this.logTime(`${t.id} identified by radio. It remains green and exits the map on a safe course outside the 5000 yd polygon.`);
      } else {
        t.status = 'suspicious';
        t.speedKt = CONFIG.enemyAttackKt;
        this.setLogic('intercept', 'warning');
        this.logTime(`${t.id} did not respond. Status changed from green to orange and interception begins.`);
        this.showMapNotice(`${t.id} failed the radio challenge. Interception is starting.`, 5000);
        this.assignInterceptor(t);
      }
    }

    prepareCompliantEscape(t) {
      const p = t.pos();
      const radial = angleTo(this.rig, p);
      const outward = { x: Math.cos(radial), y: Math.sin(radial) };
      const tangent = { x: Math.cos(radial + t.complianceTurn * 90 * DEG), y: Math.sin(radial + t.complianceTurn * 90 * DEG) };
      const v = norm({ x: tangent.x + outward.x * 0.28, y: tangent.y + outward.y * 0.28 });
      t.complianceHeading = Math.atan2(v.y, v.x);
      t.complianceExit = {
        x: p.x + Math.cos(t.complianceHeading) * CONFIG.yardsVisibleX * 1.4,
        y: p.y + Math.sin(t.complianceHeading) * CONFIG.yardsVisibleY * 1.4
      };
      t.complianceMinRangeYd = Math.round(this.distancePointToSegment(this.rig, p, t.complianceExit));
    }

    moveCompliantThreat(t, dt) {
      const p = t.pos();
      let desired = Number.isFinite(t.complianceHeading) ? t.complianceHeading : angleTo(p, t.complianceExit || this.outsideMapPoint(angleTo(this.rig, p), 4500));
      let speed = t.speedKt || 10;
      const next = {
        x: p.x + Math.cos(desired) * ktToYdSec(speed) * dt,
        y: p.y + Math.sin(desired) * ktToYdSec(speed) * dt
      };
      if (dist(next, this.rig) < CONFIG.protectedPolyYd + 350) {
        desired = angleTo(this.rig, p);
        speed = 12;
      }
      t.move(dt, desired, speed);
      if (this.isOutsideMapPoint(t.pos(), 1800)) {
        t.status = 'left-area';
        t.visible = false;
        this.logTime(`${t.id} complied, avoided the 5000 yd polygon, and left the monitored area.`);
      }
    }

    moveHostileThreat(t, dt) {
      const p = t.pos();
      let desired = angleTo(p, this.rig);
      let speed = CONFIG.enemyAttackKt;
      if (t.evasiveZigzag) {
        t.zigzagClock += dt;
        const wave = Math.sign(Math.sin(t.zigzagClock / 10)) || 1;
        const zigzagAngle = clamp(t.evasiveZigzagAngleDeg || 45, 30, 60);
        desired += wave * zigzagAngle * DEG;
        speed = CONFIG.hostileZigzagSpeedKt;
      }
      t.move(dt, desired, speed);
    }

    assignUncoveredThreats() {
      for (const t of this.threats) {
        if ((t.status === 'suspicious' || t.status === 'hostile') && (!Array.isArray(t.assignedBoats) || t.assignedBoats.length === 0)) this.assignInterceptor(t);
      }
    }

    assignBoatToThreat(boat, threat, allowRetarget = false) {
      if (!boat || !threat || boat.disabled) return false;
      if (boat.id === 'BS 403' && !this.reserveLaunched) {
        this.requestReserve();
        return false;
      }
      if (boat.targetId && boat.targetId !== threat.id && !allowRetarget) return false;

      if (boat.targetId && boat.targetId !== threat.id && allowRetarget) {
        const previous = this.threats.find(t => t.id === boat.targetId);
        if (previous && Array.isArray(previous.assignedBoats)) {
          previous.assignedBoats = previous.assignedBoats.filter(id => id !== boat.id);
          previous.assignedTo = previous.assignedBoats.join(', ') || null;
        }
      }

      boat.targetId = threat.id;
      boat.role = 'interceptor';
      boat.status = 'intercept-approach';
      boat.interceptPhase = boat.id === 'BS 401' ? 'blocking-point' : 'direct';
      if (!Array.isArray(threat.assignedBoats)) threat.assignedBoats = [];
      if (!threat.assignedBoats.includes(boat.id)) threat.assignedBoats.push(boat.id);
      threat.assignedTo = threat.assignedBoats.join(', ');
      return true;
    }

    assignInterceptor(t) {
      const candidates = this.blue.filter(b => !b.disabled && !b.targetId && (b.id === 'BS 401' || (b.id === 'BS 403' && this.reserveLaunched) || b.id === 'BS 402'));
      candidates.sort((a, b) => dist(a.pos(), t.pos()) - dist(b.pos(), t.pos()));
      const chosenBoat = candidates.find(b => b.id === 'BS 401') || candidates.find(b => b.id === 'BS 403') || candidates.find(b => b.id === 'BS 402') || candidates[0];
      if (this.assignBoatToThreat(chosenBoat, t)) {
        this.logTime(`${chosenBoat.id} assigned to intercept ${t.id}.`);
      } else {
        this.requestReserve();
        this.logTime(`${t.id} is suspicious, but no free interceptor is available yet.`);
      }
      const activeThreats = this.threats.filter(x => x.status === 'suspicious' || x.status === 'hostile' || x.status === 'engaging').length;
      const assigned = this.threats.filter(x => (x.status === 'suspicious' || x.status === 'hostile' || x.status === 'engaging') && Array.isArray(x.assignedBoats) && x.assignedBoats.length > 0).length;
      if (activeThreats > assigned && !this.reserveLaunched) this.requestReserve();
      if (activeThreats > 1 && !this.reserveLaunched) this.requestReserve();
    }

    enforceInterceptionAssignments() {
      const active = this.threats
        .filter(t => t.detected && !t.disabled && ['suspicious', 'hostile', 'engaging'].includes(t.status))
        .sort((a, b) => dist(a.pos(), this.rig) - dist(b.pos(), this.rig));
      if (!active.length) return;

      const nearSixThousand = active.find(t => dist(t.pos(), this.rig) <= 6000);
      if (nearSixThousand) {
        const bs402 = this.blue.find(b => b.id === 'BS 402' && !b.disabled);
        if (bs402 && bs402.targetId !== nearSixThousand.id && this.assignBoatToThreat(bs402, nearSixThousand, false)) {
          if (!nearSixThousand.bs402SupportLogged) {
            nearSixThousand.bs402SupportLogged = true;
            this.logTime(`${nearSixThousand.id} crossed the 6000 yd radius. BS 402 leaves static guard and joins the interception.`);
          }
        }
      }

      const insideProtected = active.find(t => dist(t.pos(), this.rig) <= CONFIG.protectedPolyYd);
      if (insideProtected) {
        if (!insideProtected.massInterceptLogged) {
          insideProtected.massInterceptLogged = true;
          this.logTime(`${insideProtected.id} is inside the 5000 yd. All available blue vessels drive directly toward the threat.`);
        }
        for (const boat of this.blue) {
          if (boat.id === 'BS 403' && !this.reserveLaunched) {
            this.requestReserve();
            continue;
          }
          this.assignBoatToThreat(boat, insideProtected, true);
        }
      }
    }

    updateInterceptors(dt) {
      for (const b of this.blue) {
        if (!b.targetId || b.disabled) continue;
        const target = this.threats.find(t => t.id === b.targetId);
        if (!target || target.status === 'neutralized' || target.status === 'left-area') {
          this.releaseInterceptor(b, 'return');
          continue;
        }

        const range = dist(b.pos(), target.pos());
        const targetRigRange = dist(target.pos(), this.rig);
        let desired = angleTo(b.pos(), target.pos());
        let speed = CONFIG.interceptSpeedKt;

        if (range <= 1000) {
          speed = CONFIG.warningSpeedKt;
          if (target.approval !== 'approved') {
            b.status = 'await-approval';
            this.requestApproval(target, b);
          } else {
            b.status = 'engage-mag';
            this.engageMag(b, target, range);
          }
        } else if (targetRigRange <= CONFIG.protectedPolyYd) {
          // Once the threat is inside the protected polygon, every assigned blue
          // vessel points its bow directly at the threat and closes distance.
          b.status = 'direct-intercept';
          desired = angleTo(b.pos(), target.pos());
          speed = CONFIG.interceptSpeedKt;
        } else if (b.id === 'BS 401') {
          // BS 401 uses a cut-off geometry first: reach the nearest blocking
          // point on the threat-to-rig line, then close toward the threat.
          const blockPoint = this.blockingPointFor(b, target);
          if (dist(b.pos(), blockPoint) > 380 && b.interceptPhase !== 'closing') {
            b.status = 'cutoff-point';
            desired = angleTo(b.pos(), blockPoint);
            speed = CONFIG.interceptSpeedKt;
          } else {
            b.interceptPhase = 'closing';
            b.status = 'intercept-approach';
            desired = angleTo(b.pos(), target.pos());
            speed = CONFIG.interceptSpeedKt;
          }
        } else if (range > CONFIG.protectedPolyYd) {
          b.status = 'intercept-approach';
          speed = CONFIG.interceptSpeedKt;
        } else if (range > CONFIG.magRangeYd) {
          b.status = 'zigzag-warning';
          b.zigzagClock += dt;
          const wave = Math.sign(Math.sin(b.zigzagClock / 12)) || 1;
          const targetSpeedFactor = clamp(target.speedKt / CONFIG.enemyAttackKt, 0, 1);
          const angle = (30 + 30 * targetSpeedFactor) * DEG;
          desired += wave * angle;
          speed = CONFIG.zigzagSpeedKt;
        } else {
          b.status = 'warning-fire';
          speed = CONFIG.warningSpeedKt;
          if (!target.warningLogged) {
            target.warningLogged = true;
            this.logTime(`${b.id} reached 2000 yd from ${target.id}. Zigzag stops. Warning flares alternate left and right.`);
          }
        }

        if (b.status === 'engage-mag' && b.magMissed && range <= 200) {
          b.status = 'ram';
          speed = CONFIG.maxSpeedKt;
          this.logTime(`${b.id} is within 200 yd of ${target.id}. MAG failed, switching to collision intercept.`);
          target.status = 'neutralized';
          target.disabled = true;
          b.disabled = true;
          b.status = 'disabled';
          this.logTime(`${target.id} neutralized by physical collision. ${b.id} is lost.`);
          if (!this.hasActiveSuspiciousThreat()) UI.video.classList.add('hidden');
          this.releaseInterceptor(b, 'lost');
          continue;
        }

        if (b.status === 'engage-mag' && !this.safeToFire(b)) {
          const around = angleTo(this.rig, target.pos()) + 90 * DEG;
          const flank = { x: target.x + Math.cos(around) * 600, y: target.y + Math.sin(around) * 600 };
          desired = angleTo(b.pos(), flank);
          speed = 24;
        }
        b.move(dt, desired, speed);
      }
    }
    requestApproval(target, interceptor) {
      if (target.approval === 'pending' || target.approval === 'approved') return;
      target.approval = 'pending';
      this.pendingApprovalThreatId = target.id;
      this.approvalPauseActive = true;
      this.setLogic('approval', 'danger');
      this.logTime(`${interceptor.id} reached 1000 yd from ${target.id}. Violent interception approval requested. Simulation paused for HQ response.`);
      this.showApproval(target);
      this.running = false;
      this.approvalTimer = setTimeout(() => {
        if (target.approval === 'pending') {
          UI.approvalCard.classList.remove('pending');
          UI.approvalCard.classList.add('approved');
          UI.approvalTitle.textContent = 'HQ approved violent interception';
          UI.approvalText.textContent = 'The approval screen is green. Confirm interception or cancel the display to continue the simulation at x1.';
          UI.confirmApproval.disabled = false;
          this.showVideoFor(target);
        }
      }, 5000);
    }

    showApproval(target) {
      this.modalOpen = true;
      if (UI.mapNotice) UI.mapNotice.classList.add('hidden');
      UI.modal.classList.remove('hidden');
      UI.video.classList.add('hidden');
      UI.approvalCard.classList.add('pending');
      UI.approvalCard.classList.remove('approved');
      UI.approvalTitle.textContent = `Waiting for violent interception approval for ${target.id}`;
      UI.approvalText.textContent = 'HQ review in progress. The simulation is paused; the screen will turn green after five seconds or continue when you cancel the display.';
      UI.confirmApproval.disabled = true;
      UI.videoThreatId.textContent = target.id;
    }

    hideApproval(hideVideo = false) {
      if (this.approvalTimer) clearTimeout(this.approvalTimer);
      this.approvalTimer = null;
      this.modalOpen = false;
      this.approvalPauseActive = false;
      UI.modal.classList.add('hidden');
      if (hideVideo) UI.video.classList.add('hidden');
      UI.confirmApproval.disabled = true;
      this.pendingApprovalThreatId = null;
    }

    showVideoFor(target) {
      if (!target) return;
      UI.video.classList.remove('hidden');
      UI.videoThreatId.textContent = target.id;
    }

    showMapNotice(message, durationMs = 5000) {
      if (!UI.mapNotice) return;
      UI.mapNotice.textContent = message;
      UI.mapNotice.classList.remove('hidden');
      if (this.mapNoticeTimer) clearTimeout(this.mapNoticeTimer);
      this.mapNoticeTimer = setTimeout(() => {
        UI.mapNotice.classList.add('hidden');
      }, durationMs);
    }

    confirmApproval() {
      const target = this.threats.find(t => t.id === this.pendingApprovalThreatId);
      if (target && target.approval === 'pending') {
        target.approval = 'approved';
        target.status = 'engaging';
        if (target.evasiveSeed) {
          target.evasiveZigzag = true;
          this.logTime(`${target.id} begins evasive zigzag at 20 kt, angled ${Math.round(target.evasiveZigzagAngleDeg || 45)} degrees off-axis after weapon engagement starts.`);
        }
        this.setLogic('weapon', 'danger');
        this.logTime(`HQ approval confirmed for ${target.id}. MAG engagement authorized at 70% hit probability.`);
      }
      this.hideApproval(false);
      this.showVideoFor(target);
      this.setSpeedMultiplier(1);
      this.running = true;
    }

    cancelApprovalDisplay() {
      const target = this.threats.find(t => t.id === this.pendingApprovalThreatId);
      if (target && target.approval === 'pending') {
        target.approval = 'approved';
        target.status = 'engaging';
        if (target.evasiveSeed) {
          target.evasiveZigzag = true;
          this.logTime(`${target.id} begins evasive zigzag at 20 kt, angled ${Math.round(target.evasiveZigzagAngleDeg || 45)} degrees off-axis after weapon engagement starts.`);
        }
        this.setLogic('weapon', 'danger');
        this.logTime('Approval display cancelled by the user. HQ approval is treated as received and the simulation continues at x1.');
      } else {
        this.logTime('Approval display closed.');
      }
      this.hideApproval(false);
      this.showVideoFor(target);
      this.setSpeedMultiplier(1);
      this.running = true;
    }

    safeToFire(b) {
      const toRig = angleTo(b.pos(), this.rig);
      return angleDiff(b.heading, toRig) > CONFIG.safeBowConeRad;
    }

    engageMag(b, target, range) {
      if (range > CONFIG.magRangeYd) return;
      if (!this.safeToFire(b)) {
        if (!target.safeHoldLogged) {
          target.safeHoldLogged = true;
          this.logTime(`${b.id} holds MAG fire: bow cone points toward the rig. Moving to a safer firing angle.`);
        }
        return;
      }
      if (this.time < b.nextShotAt) return;
      b.nextShotAt = this.time + 5;
      const hit = Math.random() < CONFIG.magHitProbability;
      if (hit) {
        target.status = 'neutralized';
        target.disabled = true;
        this.logTime(`${b.id} MAG burst hit ${target.id}. Target neutralized.`);
        if (!this.hasActiveSuspiciousThreat()) UI.video.classList.add('hidden');
        this.releaseInterceptor(b, 'return');
        if (this.hasActiveSuspiciousThreat()) this.setLogic('intercept', 'danger', false);
        else this.setLogic('recover');
      } else {
        b.magMissed = true;
        target.magMissed = true;
        this.logTime(`${b.id} MAG burst missed ${target.id}. Continue closing for last-resort interception.`);
      }
    }

    releaseInterceptor(b, mode) {
      const oldTarget = b.targetId;
      const previousTarget = this.threats.find(t => t.id === oldTarget);
      if (previousTarget && Array.isArray(previousTarget.assignedBoats)) {
        previousTarget.assignedBoats = previousTarget.assignedBoats.filter(id => id !== b.id);
        previousTarget.assignedTo = previousTarget.assignedBoats.join(', ') || null;
      }
      b.targetId = null;
      b.interceptPhase = null;
      b.magMissed = false;
      if (b.disabled) return;
      if (b.id === 'BS 401') {
        b.role = 'returning-patrol';
        b.status = 'returning-patrol';
        b.returnPoint = this.closestPointOnCircle(b.pos(), CONFIG.patrolRingYd);
        b.patrolAngle = angleTo(this.rig, b.returnPoint);
      } else if (b.id === 'BS 402') {
        b.role = 'returning-static';
        b.status = 'returning-static';
        b.returnPoint = this.closestPointOnCircle(b.pos(), CONFIG.staticRingYd);
      } else if (b.id === 'BS 403') {
        b.role = 'interceptor';
        b.status = 'patrol';
        b.returnPoint = null;
      } else {
        b.role = 'static-guard';
        b.status = 'static-guard';
      }
      if (mode === 'return') this.logTime(`${b.id} released from ${oldTarget} and returning to the nearest point on its patrol ring before resuming patrol.`);
    }

    hasActiveSuspiciousThreat() {
      return this.threats.some(t => t.detected && !t.disabled && ['suspicious', 'hostile', 'engaging'].includes(t.status));
    }

    refreshMissionLogicState() {
      if (this.approvalPauseActive || this.pendingApprovalThreatId) return;
      if (this.hasActiveSuspiciousThreat() && UI.logic.recover.classList.contains('active')) {
        this.setLogic('intercept', 'danger', false);
      }
    }

    updateMissionOutcome() {
      if (this.time >= CONFIG.missionDurationSec) {
        this.outcome = 'Mission success';
        this.running = false;
        return;
      }
      for (const t of this.threats) {
        if (t.status === 'suspicious' || t.status === 'hostile' || t.status === 'engaging') {
          if (dist(t.pos(), this.rig) <= CONFIG.staticRingYd) {
            this.outcome = `Mission failed: ${t.id} reached the rig safety ring`;
            this.logTime(this.outcome);
            this.running = false;
            return;
          }
          if (dist(t.pos(), this.rig) <= CONFIG.protectedPolyYd && !t.penetrationLogged) {
            t.penetrationLogged = true;
            this.logTime(`${t.id} entered the 5000 yd. Mission continues; failure is only inside the 500 yd ring.`);
          }
        }
      }
    }

    updateUI() {
      UI.fps.textContent = String(this.fps);
      UI.time.textContent = formatTime(this.time);
      const live = this.threats.filter(t => t.detected && !['neutralized', 'left-area', 'compliant'].includes(t.status)).length;
      const tracking = this.threats.filter(t => t.detected && t.status !== 'left-area').length;
      const hostile = this.threats.filter(t => ['suspicious', 'hostile', 'engaging'].includes(t.status)).length;
      UI.live.textContent = String(live);
      UI.tracking.textContent = String(tracking);
      UI.hostile.textContent = String(hostile);
      UI.missionStatus.textContent = this.outcome;
      this.updateThreatTable();
    }

    updateThreatTable() {
      UI.table.innerHTML = '';
      for (const t of this.threats) {
        const tr = document.createElement('tr');
        const range = t.detected ? `${Math.round(dist(t.pos(), this.rig)).toLocaleString()} yd` : 'Not seen';
        tr.innerHTML = `
          <td>${t.id}</td>
          <td><span class="status-pill"><span class="status-dot" style="background:${statusColor(t.status)}"></span>${t.detected ? t.status : 'not detected'}</span></td>
          <td>${range}</td>
          <td>${t.assignedTo || '-'}</td>
        `;
        UI.table.appendChild(tr);
      }
    }

    updateSeedPanel() {
      const lines = this.threats.map(t => `${t.id}: spawn 15000 yd at ${formatTime(t.activationTime)}, radio ${t.responds ? 'responds (30% path)' : 'no response (70% path)'}`);
      const neutral = this.neutrals[0];
      const neutralLine = neutral ? `<br>CV-01 neutral path clearance: ${Math.round(neutral.pathClearanceYd).toLocaleString()} yd from rig (outside ${CONFIG.radarRangeYd.toLocaleString()} yd ring)` : '';
      UI.scenarioSeed.innerHTML = `<strong>Load decisions</strong><br>${this.attackMode === 'coordinated' ? '50% branch: coordinated attack' : '50% branch: separated attack'}<br>${lines.join('<br>')}<br>MAG hit probability in code: 70%${neutralLine}`;
    }

    logTime(message) { this.log(formatTime(this.time), message); }

    log(timeText, message) {
      this.events.unshift({ timeText, message });
      this.events = this.events.slice(0, 30);
      UI.log.innerHTML = '';
      this.events.forEach(e => {
        const li = document.createElement('li');
        li.innerHTML = `<strong>${e.timeText}</strong> ${e.message}`;
        UI.log.appendChild(li);
      });
    }

    setSpeedMultiplier(speed) {
      this.speedMultiplier = speed;
      UI.speedButtons.forEach(btn => {
        btn.classList.toggle('active', Number(btn.dataset.speed) === speed);
      });
    }

    setLogic(key, state = 'active', autoSpeed = true) {
      const el = UI.logic[key];
      if (!el) return;
      Object.values(UI.logic).forEach(node => node.classList.remove('active', 'warning', 'danger'));
      el.classList.add(state);
      if (key === 'intercept' && autoSpeed) this.setSpeedMultiplier(10);
    }

    worldToScreen(p) {
      const rect = canvas.getBoundingClientRect();
      const sx = rect.width / CONFIG.yardsVisibleX;
      const sy = rect.height / CONFIG.yardsVisibleY;
      const s = Math.min(sx, sy);
      return {
        x: rect.width / 2 + p.x * s,
        y: rect.height / 2 + p.y * s,
        scale: s
      };
    }

    resizeCanvasToDisplaySize() {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.round(rect.width * dpr);
      const h = Math.round(rect.height * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return rect;
    }

    draw() {
      const rect = this.resizeCanvasToDisplaySize();
      ctx.clearRect(0, 0, rect.width, rect.height);
      this.drawWater(rect);
      this.drawGrid(rect);
      this.drawMapBoundary();
      this.drawRangeElements(rect);
      this.drawNeutralPaths();
      this.drawRig(rect);
      this.drawThreats(rect);
      this.drawNeutralTraffic();
      this.drawBlue(rect);
      this.drawScale(rect);
      this.drawLegend(rect);
      this.drawMiniMap();
    }

    drawWater(rect) {
      const g = ctx.createLinearGradient(0, 0, 0, rect.height);
      g.addColorStop(0, '#0a344d');
      g.addColorStop(1, '#072a40');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, rect.width, rect.height);

      // Static water texture only; no wave animation.
      ctx.save();
      ctx.strokeStyle = 'rgba(121, 210, 246, 0.045)';
      ctx.lineWidth = 1;
      for (let y = 26; y < rect.height; y += 42) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(rect.width, y);
        ctx.stroke();
      }
      ctx.restore();
    }

    drawGrid(rect) {
      const s = this.worldToScreen({ x: 0, y: 0 }).scale;
      const gridYd = YD_PER_STATUTE_MILE;
      ctx.save();
      ctx.lineWidth = 1;
      for (let x = -CONFIG.yardsVisibleX / 2; x <= CONFIG.yardsVisibleX / 2; x += gridYd) {
        const p = this.worldToScreen({ x, y: 0 });
        ctx.strokeStyle = Math.abs(x) < 1 ? COLORS.gridStrong : COLORS.grid;
        ctx.beginPath(); ctx.moveTo(p.x, 0); ctx.lineTo(p.x, rect.height); ctx.stroke();
      }
      for (let y = -CONFIG.yardsVisibleY / 2; y <= CONFIG.yardsVisibleY / 2; y += gridYd) {
        const p = this.worldToScreen({ x: 0, y });
        ctx.strokeStyle = Math.abs(y) < 1 ? COLORS.gridStrong : COLORS.grid;
        ctx.beginPath(); ctx.moveTo(0, p.y); ctx.lineTo(rect.width, p.y); ctx.stroke();
      }
      ctx.restore();
    }

    drawMapBoundary() {
      const halfX = CONFIG.yardsVisibleX / 2;
      const halfY = CONFIG.yardsVisibleY / 2;
      const nw = this.worldToScreen({ x: -halfX, y: -halfY });
      const se = this.worldToScreen({ x: halfX, y: halfY });
      ctx.save();
      ctx.strokeStyle = 'rgba(234, 243, 255, 0.26)';
      ctx.lineWidth = 1;
      ctx.setLineDash([12, 8]);
      ctx.strokeRect(nw.x, nw.y, se.x - nw.x, se.y - nw.y);
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(234, 243, 255, 0.72)';
      ctx.font = '800 12px Inter, system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('15 x 15 NM map', se.x - 8, nw.y + 18);
      ctx.restore();
    }

    drawRangeElements() {
      const center = this.worldToScreen(this.rig);
      this.drawCircle(CONFIG.radarRangeYd, 'rgba(90, 188, 222, 0.28)', '20000 yd', 45 * DEG);
      this.drawCircle(CONFIG.protectedPolyYd, 'rgba(255, 156, 61, 0.48)', '5000 yd', 140 * DEG);
      this.drawCircle(CONFIG.patrolRingYd, 'rgba(232, 244, 255, 0.75)', '3000 yd', -98 * DEG, 2);
      this.drawCircle(CONFIG.staticRingYd, 'rgba(130, 245, 195, 0.9)', '500 yd', 58 * DEG, 2);
      // Protected polygon outline removed to reduce map clutter; the 5000 yd radius label remains.
    }

    drawCircle(radiusYd, stroke, label, labelAngle, lineWidth = 1) {
      const c = this.worldToScreen(this.rig);
      const s = c.scale;
      ctx.save();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.arc(c.x, c.y, radiusYd * s, 0, TWO_PI);
      ctx.stroke();
      const lp = { x: c.x + Math.cos(labelAngle) * radiusYd * s, y: c.y + Math.sin(labelAngle) * radiusYd * s };
      ctx.fillStyle = stroke.replace('0.28', '0.95').replace('0.48', '0.95').replace('0.75', '0.95').replace('0.9', '0.95');
      ctx.font = '700 12px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, lp.x, lp.y - 8);
      ctx.restore();
    }

    drawProtectedPolygon(center) {
      const s = center.scale;
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 156, 61, 0.62)';
      ctx.fillStyle = 'rgba(255, 156, 61, 0.035)';
      ctx.lineWidth = 1;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = -90 * DEG + i * TWO_PI / 6;
        const x = center.x + Math.cos(a) * CONFIG.protectedPolyYd * s;
        const y = center.y + Math.sin(a) * CONFIG.protectedPolyYd * s;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    drawRig() {
      const p = this.worldToScreen(this.rig);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.fillStyle = 'rgba(234, 243, 255, 0.95)';
      ctx.strokeStyle = 'rgba(234, 243, 255, 0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, TWO_PI);
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#ff9c3d';
      ctx.beginPath();
      ctx.moveTo(-11, -9); ctx.lineTo(11, 9); ctx.moveTo(11, -9); ctx.lineTo(-11, 9); ctx.stroke();
      ctx.fillStyle = COLORS.white;
      ctx.font = '800 10px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('RIG', 0, -16);
      ctx.restore();
    }

    drawNeutralPaths() {
      ctx.save();
      ctx.strokeStyle = 'rgba(234, 243, 255, 0.78)';
      ctx.lineWidth = 1.4;
      ctx.setLineDash([9, 9]);
      for (const n of this.neutrals) {
        if (!n.pathStart || !n.pathEnd) continue;
        const a = this.worldToScreen(n.pathStart);
        const b = this.worldToScreen(n.pathEnd);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    drawNeutralTraffic() {
      for (const n of this.neutrals) {
        if (!n.visible) continue;
        this.drawBoatTriangle(n, COLORS.neutral);
        this.drawBoatLabel(n, COLORS.neutral);
      }
    }

    drawBlue() {
      for (const b of this.blue) {
        if (!b.visible) continue;
        const color = b.disabled ? COLORS.gray : COLORS.blue;
        this.drawBoatTriangle(b, color);
        this.drawBoatLabel(b, color);
      }
    }

    drawThreats() {
      for (const t of this.threats) {
        if (!t.visible || !t.detected) continue;
        this.drawBoatTriangle(t, statusColor(t.status));
        this.drawBoatLabel(t, statusColor(t.status));
      }
    }

    drawBoatTriangle(boat, color) {
      const p = this.worldToScreen(boat.pos());
      const bodyLength = boat.type === 'blue' ? 16 : boat.type === 'neutral' ? 15 : 14;
      const bodyWidth = boat.type === 'blue' ? 7 : 6;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(boat.heading);
      ctx.fillStyle = color;
      ctx.strokeStyle = 'rgba(255,255,255,0.86)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(bodyLength * 0.72, 0);
      ctx.lineTo(-bodyLength * 0.58, -bodyWidth * 0.5);
      ctx.lineTo(-bodyLength * 0.58, bodyWidth * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Internal three-dot vessel model: bow, port stern, starboard stern.
      ctx.fillStyle = 'rgba(255,255,255,0.68)';
      const dotRadius = 1.25;
      const dots = [
        { x: bodyLength * 0.45, y: 0 },
        { x: -bodyLength * 0.32, y: -bodyWidth * 0.24 },
        { x: -bodyLength * 0.32, y: bodyWidth * 0.24 }
      ];
      for (const d of dots) {
        ctx.beginPath();
        ctx.arc(d.x, d.y, dotRadius, 0, TWO_PI);
        ctx.fill();
      }
      ctx.restore();
    }

    drawBoatLabel(boat, color) {
      const p = this.worldToScreen(boat.pos());
      ctx.save();
      ctx.fillStyle = color;
      ctx.font = '800 10px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(boat.id, p.x, p.y + 18);
      ctx.restore();
    }

    drawVectors() {
      ctx.save();
      ctx.lineWidth = 1.5;
      for (const b of this.blue) {
        if (!b.targetId || b.disabled) continue;
        const t = this.threats.find(x => x.id === b.targetId);
        if (!t || !t.detected || t.status === 'neutralized') continue;
        const a = this.worldToScreen(b.pos());
        const c = this.worldToScreen(t.pos());
        ctx.strokeStyle = 'rgba(255, 227, 129, 0.55)';
        ctx.setLineDash([7, 7]);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.restore();
    }

    drawScale(rect) {
      const totalMiles = 10;
      const segmentMiles = 2.5;
      const totalYd = totalMiles * YD_PER_NAUTICAL_MILE;
      const s = this.worldToScreen(this.rig).scale;
      const w = totalYd * s;
      const h = 10;
      const x = rect.width - w - 34;
      const y = rect.height - 44;
      ctx.save();
      ctx.font = '800 12px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      for (let i = 0; i < totalMiles / segmentMiles; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#0b0f13' : '#eaf3ff';
        ctx.fillRect(x + i * (w / 4), y, w / 4, h);
        ctx.strokeStyle = '#eaf3ff';
        ctx.strokeRect(x + i * (w / 4), y, w / 4, h);
      }
      ctx.fillStyle = '#eaf3ff';
      for (let i = 0; i <= 4; i++) {
        const val = i * segmentMiles;
        const tx = x + i * (w / 4);
        ctx.fillText(String(val).replace('.0', ''), tx, y - 8);
      }
      ctx.fillText('NM', x + w / 2, y + 28);
      ctx.restore();
    }

    drawLegend(rect) {
      const items = [
        ['Blue force', COLORS.blue],
        ['Compliant / unknown', COLORS.green],
        ['Neutral traffic', COLORS.neutral],
        ['Suspicious', COLORS.orange],
        ['Hostile / engaging', COLORS.red],
        ['Neutralized', COLORS.gray]
      ];
      const x = 18;
      let y = 18;
      ctx.save();
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = 'rgba(2, 13, 22, 0.52)';
      ctx.strokeStyle = 'rgba(110, 180, 210, 0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x - 10, y - 12, 190, items.length * 24 + 14, 12);
      ctx.fill(); ctx.stroke();
      ctx.font = '800 12px Inter, system-ui, sans-serif';
      ctx.textAlign = 'left';
      for (const [label, color] of items) {
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(x, y, 5, 0, TWO_PI); ctx.fill();
        ctx.fillStyle = 'rgba(234, 243, 255, 0.86)';
        ctx.fillText(label, x + 14, y + 4);
        y += 24;
      }
      ctx.restore();
    }

    drawMiniMap() {
      const dpr = window.devicePixelRatio || 1;
      const rect = mini.getBoundingClientRect();
      const w = Math.round(rect.width * dpr);
      const h = Math.round(rect.height * dpr);
      if (mini.width !== w || mini.height !== h) { mini.width = w; mini.height = h; }
      mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      mctx.clearRect(0, 0, rect.width, rect.height);
      mctx.fillStyle = 'rgba(5, 19, 31, 0.4)';
      mctx.fillRect(0, 0, rect.width, rect.height);
      const center = { x: rect.width / 2, y: rect.height / 2 };
      const scale = Math.min(rect.width, rect.height) / (CONFIG.radarRangeYd * 2.2);
      mctx.strokeStyle = 'rgba(126, 227, 255, 0.35)';
      mctx.beginPath(); mctx.arc(center.x, center.y, CONFIG.radarRangeYd * scale, 0, TWO_PI); mctx.stroke();
      mctx.strokeStyle = 'rgba(255, 156, 61, 0.45)';
      mctx.beginPath(); mctx.arc(center.x, center.y, CONFIG.protectedPolyYd * scale, 0, TWO_PI); mctx.stroke();
      mctx.fillStyle = COLORS.white;
      mctx.beginPath(); mctx.arc(center.x, center.y, 4, 0, TWO_PI); mctx.fill();
      for (const b of this.blue) this.drawMiniBoat(b, center, scale, b.disabled ? COLORS.gray : COLORS.blue);
      for (const n of this.neutrals) if (n.visible) this.drawMiniBoat(n, center, scale, COLORS.neutral);
      for (const t of this.threats) if (t.visible && t.detected) this.drawMiniBoat(t, center, scale, statusColor(t.status));
      mctx.fillStyle = 'rgba(234, 243, 255, 0.9)';
      mctx.font = '800 11px Inter, system-ui, sans-serif';
      mctx.textAlign = 'center';
      const northX = rect.width - 20;
      const northY = 16;
      mctx.fillText('N', northX, northY);
      mctx.beginPath();
      mctx.moveTo(northX, northY + 8); mctx.lineTo(northX - 5, northY + 20); mctx.lineTo(northX + 5, northY + 20); mctx.closePath(); mctx.fill();
    }

    drawMiniBoat(boat, center, scale, color) {
      const x = center.x + boat.x * scale;
      const y = center.y + boat.y * scale;
      if (x < 0 || x > center.x * 2 || y < 0 || y > center.y * 2) return;
      mctx.save();
      mctx.translate(x, y);
      mctx.rotate(boat.heading);
      mctx.fillStyle = color;
      mctx.beginPath();
      mctx.moveTo(8, 0); mctx.lineTo(-5, -3); mctx.lineTo(-5, 3); mctx.closePath();
      mctx.fill();
      mctx.restore();
    }
  }

  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
      const radius = Math.min(r, w / 2, h / 2);
      this.moveTo(x + radius, y);
      this.arcTo(x + w, y, x + w, y + h, radius);
      this.arcTo(x + w, y + h, x, y + h, radius);
      this.arcTo(x, y + h, x, y, radius);
      this.arcTo(x, y, x + w, y, radius);
      return this;
    };
  }

  new OffshoreSimulator();
})();
