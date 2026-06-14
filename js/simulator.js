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
    videoSafetyText: document.getElementById('videoSafetyText'),
    mapNotice: document.getElementById('mapNotice'),
    timeOfDay: document.getElementById('timeOfDaySelect'),
    targetClass: document.getElementById('targetClassSelect'),
    staticPatrolRadius: document.getElementById('staticPatrolRadiusInput'),
    dynamicPatrolRadius: document.getElementById('dynamicPatrolRadiusDisplay'),
    opticalRanges: document.getElementById('opticalRangesDisplay'),
    scenarioSettingsHint: document.getElementById('scenarioSettingsHint'),
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
    outerMapRingYd: 20000,
    rigSafetyRingYd: 500,
    defaultStaticPatrolRadiusYd: 500,
    protectedPolyYd: 5000,
    magRangeYd: 2000,
    magSafetySectorRangeYd: 2100,
    magSafetySectorAngleRad: 60 * DEG,
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
    yardsVisibleY: 15 * YD_PER_NAUTICAL_MILE
  };

  const OPTICAL_RANGE_TABLE = {
    small: {
      day: { detect: 7000, recognize: 6000, identify: 4000 },
      night: { detect: 5000, recognize: 4000, identify: 2000 }
    },
    medium: {
      day: { detect: 10000, recognize: 8000, identify: 6000 },
      night: { detect: 8000, recognize: 7000, identify: 5000 }
    },
    large: {
      day: { detect: 18000, recognize: 14000, identify: 12000 },
      night: { detect: 16000, recognize: 12000, identify: 10000 }
    }
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
  function titleCase(word) { return String(word || '').charAt(0).toUpperCase() + String(word || '').slice(1); }
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
  function getOpticalRanges(targetClass, timeOfDay) {
    const classKey = OPTICAL_RANGE_TABLE[targetClass] ? targetClass : 'small';
    const timeKey = OPTICAL_RANGE_TABLE[classKey][timeOfDay] ? timeOfDay : 'day';
    const ranges = OPTICAL_RANGE_TABLE[classKey][timeKey];
    return { detect: ranges.detect, recognize: ranges.recognize, identify: ranges.identify };
  }
  function computeDynamicPatrolRadiusYd(ranges, staticRadiusYd) {
    // The document requires the dynamic patrol radius to be selected
    // automatically from the rig/COG geometry but does not give a precise
    // formula. We bias toward staying inside the identification envelope while
    // keeping separation from the user-set static guard and the 5000 yd area.
    return clamp(ranges.identify - 1000, staticRadiusYd + 500, CONFIG.protectedPolyYd - 500);
  }
  function formatYd(value) { return `${Math.round(value).toLocaleString()} yd`; }
  function formatOpticalRanges(ranges) {
    return `Detect ${ranges.detect.toLocaleString()} yd / Recognize ${ranges.recognize.toLocaleString()} yd / Identify ${ranges.identify.toLocaleString()} yd`;
  }

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
      this.previewScenario = this.readScenarioSettings();
      this.reset();
      this.bindEvents();
      this.refreshScenarioPreview(false);
      requestAnimationFrame(this.frame.bind(this));
    }

    reset() {
      this.time = 0;
      this.events = [];
      this.outcome = 'Nominal';
      this.activeScenario = this.readScenarioSettings();
      this.previewScenario = { ...this.activeScenario, opticalRanges: { ...this.activeScenario.opticalRanges } };
      if (this.approvalTimer) clearTimeout(this.approvalTimer);
      if (this.mapNoticeTimer) clearTimeout(this.mapNoticeTimer);
      this.approvalTimer = null;
      this.mapNoticeTimer = null;
      if (UI.mapNotice) UI.mapNotice.classList.add('hidden');
      this.pendingApprovalThreatId = null;
      this.approvalPauseActive = false;
      this.modalOpen = false;
      this.currentFireSector = null;
      this.rig = { x: 0, y: 0 };
      this.secondSuspiciousDuringFirst = Math.random() < 0.40;
      this.secondThreatScheduled = false;
      this.secondThreatActivated = false;
      this.blue = [];
      this.threats = [];
      this.neutrals = [];
      this.reserveRequested = false;
      this.reserveLaunched = false;
      this.initBoats();
      this.initThreatSchedule();
      this.initNeutralTraffic();
      this.log('00:00', `Mission loaded. ${titleCase(this.activeScenario.timeOfDay)} / ${titleCase(this.activeScenario.targetClass)} hostile profile active, dynamic patrol auto-set to ${formatYd(this.activeScenario.dynamicPatrolRadiusYd)}, static guard set to ${formatYd(this.activeScenario.staticPatrolRadiusYd)}.`);
      this.log('00:00', this.describeSchedule());
      this.hideApproval(true);
      this.refreshScenarioPreview(false);
      this.updateSeedPanel();
      this.updateUI();
    }

    readScenarioSettings() {
      const timeOfDay = UI.timeOfDay?.value === 'night' ? 'night' : 'day';
      const targetClass = ['small', 'medium', 'large'].includes(UI.targetClass?.value) ? UI.targetClass.value : 'small';
      const rawStatic = Number(UI.staticPatrolRadius?.value || CONFIG.defaultStaticPatrolRadiusYd);
      const staticPatrolRadiusYd = clamp(Math.round(rawStatic || CONFIG.defaultStaticPatrolRadiusYd), 300, CONFIG.protectedPolyYd - 500);
      const opticalRanges = getOpticalRanges(targetClass, timeOfDay);
      const dynamicPatrolRadiusYd = computeDynamicPatrolRadiusYd(opticalRanges, staticPatrolRadiusYd);
      return {
        timeOfDay,
        targetClass,
        staticPatrolRadiusYd,
        opticalRanges,
        dynamicPatrolRadiusYd,
        challengeEndRangeYd: Math.max(opticalRanges.identify, opticalRanges.detect - 2000)
      };
    }

    refreshScenarioPreview(showResetHint = false) {
      this.previewScenario = this.readScenarioSettings();
      if (UI.staticPatrolRadius) UI.staticPatrolRadius.value = String(this.previewScenario.staticPatrolRadiusYd);
      if (UI.dynamicPatrolRadius) UI.dynamicPatrolRadius.textContent = formatYd(this.previewScenario.dynamicPatrolRadiusYd);
      if (UI.opticalRanges) UI.opticalRanges.textContent = formatOpticalRanges(this.previewScenario.opticalRanges);
      if (UI.scenarioSettingsHint) {
        UI.scenarioSettingsHint.textContent = showResetHint
          ? 'Scenario changes update the preview now and apply to the live mission on reset.'
          : 'Scenario changes update the preview now and apply to the mission on reset.';
      }
    }

    initBoats() {
      const p401 = polar(this.activeScenario.dynamicPatrolRadiusYd, -65 * DEG);
      const p402 = polar(this.activeScenario.staticPatrolRadiusYd, 122 * DEG);
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

    buildThreat(id, activationTime, angle, spawnRadiusYd, opts = {}) {
      const start = polar(spawnRadiusYd, angle);
      const heading = angleTo(start, this.rig);
      const responds = typeof opts.responds === 'boolean' ? opts.responds : Math.random() < 0.30;
      const threat = new Boat(id, 'threat', start.x, start.y, heading, {
        role: 'threat',
        status: 'unknown',
        speedKt: CONFIG.enemySlowKt,
        visible: false,
        detected: false,
        responds
      });
      threat.activationTime = activationTime;
      threat.spawnRadiusYd = spawnRadiusYd;
      threat.enteredMapLogged = false;
      threat.evasiveSeed = Math.random() < CONFIG.hostileZigzagChance;
      threat.evasiveZigzagAngleDeg = 30;
      threat.complianceTurn = choice([-1, 1]);
      threat.assignedBoats = [];
      threat.bs402SupportLogged = false;
      threat.massInterceptLogged = false;
      threat.targetClass = this.activeScenario.targetClass;
      threat.timeOfDay = this.activeScenario.timeOfDay;
      threat.opticalRanges = { ...this.activeScenario.opticalRanges };
      threat.challengeEndRangeYd = this.activeScenario.challengeEndRangeYd;
      threat.radioChallengeStarted = false;
      threat.radioResolved = false;
      threat.phase = 'not detected';
      threat.radioResultLabel = responds ? '30% compliant branch' : '70% no-response branch';
      threat.branchTag = opts.branchTag || 'primary';
      threat.deferredActivation = Boolean(opts.deferredActivation);
      threat.deferredSpawnRadiusYd = opts.deferredSpawnRadiusYd || spawnRadiusYd;
      threat.secondBranchThreat = Boolean(opts.secondBranchThreat);
      threat.warningLogged = false;
      threat.lightsFlaresLogged = false;
      threat.lastSafetyBlocker = null;
      return threat;
    }

    initThreatSchedule() {
      const firstActivation = rand(5 * 60, 10 * 60);
      const firstAngle = rand(0, TWO_PI);
      this.threats.push(this.buildThreat('TH-01', firstActivation, firstAngle, CONFIG.enemySpawnRadiusYd, {
        branchTag: 'primary',
        responds: this.secondSuspiciousDuringFirst ? false : undefined
      }));

      if (this.secondSuspiciousDuringFirst) {
        // The document requires the 40% branch to create a second suspicious
        // target while the first is already being handled. To guarantee that
        // overlap inside a short simulator run, the second contact is created
        // in a deferred state and activated later from a closer range.
        const secondAngle = firstAngle + choice([-1, 1]) * rand(110 * DEG, 220 * DEG);
        const deferredRadius = Math.min(CONFIG.enemySpawnRadiusYd, this.activeScenario.opticalRanges.detect + 1200);
        const secondThreat = this.buildThreat('TH-02', Infinity, secondAngle, deferredRadius, {
          branchTag: 'second-suspicious-during-first',
          deferredActivation: true,
          deferredSpawnRadiusYd: deferredRadius,
          secondBranchThreat: true,
          responds: false
        });
        secondThreat.phase = 'awaiting branch trigger';
        this.threats.push(secondThreat);
      }
    }

    initNeutralTraffic() {
      const halfX = CONFIG.yardsVisibleX / 2;
      const halfY = CONFIG.yardsVisibleY / 2;
      let start;
      let end;
      let pathClearanceYd = 0;

      // Civilian traffic is sampled as a short corner transit from outside one
      // map edge to outside an adjacent edge. This keeps the dashed white path
      // visible inside the map while avoiding the large outer reference ring.
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
        if (pathClearanceYd > CONFIG.outerMapRingYd + 150) {
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
      this.log('00:00', `${civilian.id} neutral civilian transit is present on a dashed white path outside the ${CONFIG.outerMapRingYd.toLocaleString()} yd outer reference ring.`);
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
      const minBlockRange = this.activeScenario.dynamicPatrolRadiusYd;
      const maxBlockRange = Math.max(minBlockRange + 300, Math.min(CONFIG.protectedPolyYd, targetRigRange - 850));
      if (closestRigRange < minBlockRange || dist(closest, targetPos) < 850) {
        return polar(maxBlockRange, targetBearing);
      }
      return closest;
    }

    describeSchedule() {
      const primary = this.threats.find(t => t.id === 'TH-01');
      if (this.secondSuspiciousDuringFirst) {
        return `Attack schedule decided on load: TH-01 spawns at ${formatYd(primary.spawnRadiusYd)} near ${formatTime(primary.activationTime)}. The 40% second-suspicious branch is active and will trigger TH-02 while BS 401 is already handling TH-01.`;
      }
      return `Attack schedule decided on load: TH-01 spawns alone at ${formatYd(primary.spawnRadiusYd)} near ${formatTime(primary.activationTime)}. The 40% second-suspicious branch did not roll, so no simultaneous second hostile handling case is created in this run.`;
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
      [UI.timeOfDay, UI.targetClass, UI.staticPatrolRadius].forEach(control => {
        if (!control) return;
        control.addEventListener('change', () => {
          this.refreshScenarioPreview(this.running || this.time > 0);
          if (this.running || this.time > 0) this.showMapNotice('Scenario setting changes will apply after reset.', 2600);
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
      const dynamicRadius = this.activeScenario.dynamicPatrolRadiusYd;
      const staticRadius = this.activeScenario.staticPatrolRadiusYd;
      if (patrol && patrol.role === 'returning-patrol' && !patrol.targetId) {
        if (!patrol.returnPoint) patrol.returnPoint = this.closestPointOnCircle(patrol.pos(), dynamicRadius);
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
        const angularSpeed = ktToYdSec(CONFIG.cruiseSpeedKt) / dynamicRadius;
        patrol.patrolAngle += angularSpeed * dt;
        const p = polar(dynamicRadius, patrol.patrolAngle);
        patrol.x = p.x;
        patrol.y = p.y;
        patrol.heading = patrol.patrolAngle + Math.PI / 2;
        patrol.speedKt = CONFIG.cruiseSpeedKt;
        patrol.status = 'patrol';
        patrol.threeDots = patrol.computeDots();
      }
      const staticGuard = this.blue.find(b => b.id === 'BS 402');
      if (staticGuard && staticGuard.role === 'returning-static' && !staticGuard.targetId) {
        if (!staticGuard.returnPoint) staticGuard.returnPoint = this.closestPointOnCircle(staticGuard.pos(), staticRadius);
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
        const p = polar(this.activeScenario.staticPatrolRadiusYd + 220, 20 * DEG);
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
          this.logTime(`${n.id} completed neutral transit. Its dashed path stayed outside the 20000 yd outer reference ring.`);
        }
      }
    }

    updateThreats(dt) {
      this.maybeActivateSecondThreat();
      for (const t of this.threats) {
        if (t.status === 'neutralized' || t.status === 'left-area') continue;
        if (t.deferredActivation || this.time < t.activationTime) continue;
        if (!t.enteredMapLogged) {
          t.enteredMapLogged = true;
          this.setSpeedMultiplier(10);
          this.logTime(`${t.id} entered the 15 x 15 NM map from ${Math.round(t.spawnRadiusYd || CONFIG.enemySpawnRadiusYd).toLocaleString()} yd. Simulation speed increased to x10.`);
        }

        const rangeRig = dist(t.pos(), this.rig);
        if (!t.detected && rangeRig <= t.opticalRanges.detect) {
          t.detected = true;
          t.visible = true;
          t.status = 'unknown';
          t.phase = 'optical detected';
          t.radioChallengeStarted = true;
          this.setLogic('detect');
          this.setSpeedMultiplier(10);
          this.logTime(`${t.id} optical detection at ${Math.round(rangeRig)} yd. Rig sensors pass the contact to the patrol boat and the radio challenge window opens down to ${Math.round(t.challengeEndRangeYd)} yd.`);
        }

        if (!t.detected) {
          t.phase = 'not detected';
          t.move(dt, angleTo(t.pos(), this.rig), CONFIG.enemySlowKt);
          continue;
        }

        if (t.status === 'compliant') {
          t.phase = 'compliant';
          this.moveCompliantThreat(t, dt);
          continue;
        }

        if (!t.radioResolved) {
          t.phase = 'radio challenge';
          t.move(dt, angleTo(t.pos(), this.rig), CONFIG.enemySlowKt);
          if (rangeRig <= t.challengeEndRangeYd) this.challengeThreat(t);
          continue;
        }

        if (t.status === 'unknown') {
          t.phase = 'optical detected';
          t.move(dt, angleTo(t.pos(), this.rig), CONFIG.enemySlowKt);
          continue;
        }

        if (t.status === 'suspicious' || t.status === 'hostile' || t.status === 'engaging') {
          this.moveHostileThreat(t, dt);
          if (dist(t.pos(), this.rig) <= CONFIG.protectedPolyYd && t.status !== 'hostile' && t.status !== 'engaging') {
            t.status = 'hostile';
            t.phase = 'hostile';
            this.setLogic('intercept', 'danger');
            this.logTime(`${t.id} penetrated the 5000 yd protected area and is now hostile.`);
          }
        }

        if (Math.abs(t.x) > CONFIG.yardsVisibleX * 0.75 || Math.abs(t.y) > CONFIG.yardsVisibleY * 0.85) {
          if (t.status === 'compliant') {
            t.status = 'left-area';
            t.visible = false;
            this.logTime(`${t.id} complied, avoided the protected polygon, and left the monitored area.`);
          }
        }
      }
    }

    maybeActivateSecondThreat() {
      if (!this.secondSuspiciousDuringFirst || this.secondThreatScheduled) return;
      const primaryThreat = this.threats.find(t => t.id === 'TH-01');
      const patrol = this.blue.find(b => b.id === 'BS 401');
      const secondThreat = this.threats.find(t => t.secondBranchThreat);
      if (!primaryThreat || !patrol || !secondThreat) return;
      if (!['suspicious', 'hostile', 'engaging'].includes(primaryThreat.status)) return;
      if (patrol.targetId !== primaryThreat.id) return;
      secondThreat.deferredActivation = false;
      secondThreat.activationTime = this.time + rand(2 * 60, 4 * 60);
      secondThreat.spawnRadiusYd = secondThreat.deferredSpawnRadiusYd;
      secondThreat.phase = 'queued for second branch';
      this.secondThreatScheduled = true;
      this.logTime(`40% second-suspicious branch triggered. TH-02 will activate while BS 401 is already handling TH-01, which will force BS 402 off static guard only if TH-02 also fails its radio challenge.`);
      this.updateSeedPanel();
    }

    challengeThreat(t) {
      this.setLogic('challenge');
      t.radioResolved = true;
      if (t.responds) {
        t.status = 'compliant';
        t.phase = 'compliant';
        t.speedKt = 10;
        this.prepareCompliantEscape(t);
        this.logTime(`${t.id} reached the radio challenge decision line at ${Math.round(dist(t.pos(), this.rig))} yd and responded. It is no longer suspicious, and blue forces continue patrol while it exits safely.`);
      } else {
        t.status = 'suspicious';
        t.phase = 'suspicious';
        t.speedKt = CONFIG.enemyAttackKt;
        this.setLogic('intercept', 'warning');
        this.logTime(`${t.id} reached the radio challenge decision line at ${Math.round(dist(t.pos(), this.rig))} yd and did not respond. Status changes to suspicious and the target accelerates to 45 kt toward the rig.`);
        this.showMapNotice(`${t.id} failed the radio challenge. 40 kt interception is starting.`, 5000);
        this.assignInterceptor(t);
      }
      this.updateSeedPanel();
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
        const zigzagAngle = clamp(t.evasiveZigzagAngleDeg || 30, 30, 30);
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
      boat.interceptPhase = 'closing-40kt';
      boat.zigzagClock = 0;
      boat.interceptFlareSide = 1;
      boat.flankSide = choice([-1, 1]);
      if (!Array.isArray(threat.assignedBoats)) threat.assignedBoats = [];
      if (!threat.assignedBoats.includes(boat.id)) threat.assignedBoats.push(boat.id);
      threat.assignedTo = threat.assignedBoats.join(', ');
      return true;
    }

    assignInterceptor(t) {
      const bs401Busy = this.blue.some(b => b.id === 'BS 401' && b.targetId && b.targetId !== t.id);
      const preferredIds = t.secondBranchThreat && bs401Busy ? ['BS 402', 'BS 403', 'BS 401'] : ['BS 401', 'BS 403'];
      const candidates = preferredIds
        .map(id => this.blue.find(b => b.id === id))
        .filter(b => b && !b.disabled && !b.targetId && (b.id !== 'BS 403' || this.reserveLaunched));
      const chosenBoat = candidates[0];
      if (this.assignBoatToThreat(chosenBoat, t)) {
        if (chosenBoat.id === 'BS 402' && t.secondBranchThreat && !t.bs402SupportLogged) {
          t.bs402SupportLogged = true;
          this.logTime(`TH-02 became the second suspicious target while BS 401 was already committed. BS 402 leaves the ${formatYd(this.activeScenario.staticPatrolRadiusYd)} static guard ring to handle it.`);
        }
        if (!t.lightsFlaresLogged) {
          t.lightsFlaresLogged = true;
          this.logTime(`${chosenBoat.id} assigned to intercept ${t.id}. The boat points its bow at the target, accelerates to 40 kt, and uses lights and flares while closing.`);
        }
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

      const insideProtected = active.find(t => dist(t.pos(), this.rig) <= CONFIG.protectedPolyYd);
      if (insideProtected && (!insideProtected.assignedBoats || insideProtected.assignedBoats.length === 0)) {
        if (!insideProtected.massInterceptLogged) {
          insideProtected.massInterceptLogged = true;
          this.logTime(`${insideProtected.id} is inside the 5000 yd protected area without an assigned interceptor. Emergency fallback releases any free blue boat, including BS 402 if required.`);
        }
        for (const boat of this.blue) {
          if (boat.id === 'BS 403' && !this.reserveLaunched) {
            this.requestReserve();
            continue;
          }
          if (!boat.targetId) this.assignBoatToThreat(boat, insideProtected, true);
        }
      }
    }

    computeInterceptZigzagAngleDeg(interceptor, target, range) {
      const targetSpeedFactor = clamp(target.speedKt / CONFIG.enemyAttackKt, 0, 1);
      const offAxisFactor = clamp(angleDiff(interceptor.heading, angleTo(interceptor.pos(), target.pos())) / (60 * DEG), 0, 1);
      return clamp(30 + targetSpeedFactor * 18 + offAxisFactor * 12, 30, 60);
    }

    projectedRangeAfterMove(boat, target, dt, desiredHeading, speedKt) {
      const next = {
        x: boat.x + Math.cos(desiredHeading) * ktToYdSec(speedKt) * dt,
        y: boat.y + Math.sin(desiredHeading) * ktToYdSec(speedKt) * dt
      };
      return dist(next, target.pos());
    }

    computeSafeFlankPoint(interceptor, target) {
      const base = angleTo(interceptor.pos(), target.pos());
      interceptor.flankSide = interceptor.flankSide || choice([-1, 1]);
      const offset = interceptor.flankSide * 90 * DEG;
      return {
        x: target.x + Math.cos(base + offset) * 700,
        y: target.y + Math.sin(base + offset) * 700
      };
    }

    updateInterceptors(dt) {
      this.currentFireSector = null;
      for (const b of this.blue) {
        if (!b.targetId || b.disabled) continue;
        const target = this.threats.find(t => t.id === b.targetId);
        if (!target || target.status === 'neutralized' || target.status === 'left-area') {
          this.releaseInterceptor(b, 'return');
          continue;
        }

        const range = dist(b.pos(), target.pos());
        let desired = angleTo(b.pos(), target.pos());
        let speed = CONFIG.interceptSpeedKt;

        if (b.magMissed && range <= 200) {
          b.status = 'ram';
          speed = CONFIG.maxSpeedKt;
          target.phase = 'ramming fallback';
          this.logTime(`${b.id} is within 200 yd of ${target.id}. MAG failed, so the boat switches to max-speed chase and ramming as a lower-quality last-resort outcome.`);
          target.status = 'neutralized';
          target.disabled = true;
          target.phase = 'neutralized';
          b.disabled = true;
          b.status = 'disabled';
          this.logTime(`${target.id} neutralized by physical collision. ${b.id} is lost in the ramming fallback.`);
          if (!this.hasActiveSuspiciousThreat()) UI.video.classList.add('hidden');
          this.releaseInterceptor(b, 'lost');
          continue;
        }

        if (range <= 1000) {
          speed = CONFIG.warningSpeedKt;
          if (target.approval !== 'approved') {
            b.status = 'await-approval';
            target.phase = 'awaiting approval';
            this.requestApproval(target, b);
          } else {
            b.status = 'engage-mag';
            target.phase = 'engaging';
            const sector = this.isFireSectorClear(b, target);
            if (!sector.clear) {
              const blockerName = sector.blocker?.id || 'protected object';
              if (target.lastSafetyBlocker !== blockerName) {
                target.lastSafetyBlocker = blockerName;
                this.logTime(`${b.id} holds MAG fire. ${blockerName} is inside the MAG 60° / 2100 yd safety sector, so the boat keeps maneuvering for a safe flank.`);
              }
              const flank = this.computeSafeFlankPoint(b, target);
              desired = angleTo(b.pos(), flank);
              speed = 24;
            } else {
              target.lastSafetyBlocker = null;
              this.engageMag(b, target, range);
            }
          }
        } else if (range <= 2000) {
          b.status = 'warning-fire';
          target.phase = 'warning';
          this.setLogic('approval', 'warning', false);
          desired = angleTo(b.pos(), target.pos());
          b.interceptFlareSide *= -1;
          speed = CONFIG.warningSpeedKt;
          if (!target.warningLogged) {
            target.warningLogged = true;
            this.logTime(`${b.id} reached 2000 yd from ${target.id}. Zigzag stops, the bow stays on target, warning flares alternate 30° left and right, and speed settles at 30 kt.`);
          }
        } else if (range <= 5000) {
          b.status = 'zigzag-warning';
          target.phase = 'zigzag intercept';
          this.setLogic('approval', 'warning', false);
          b.zigzagClock += dt;
          const wave = Math.sign(Math.sin(b.zigzagClock / 9)) || 1;
          const angleDeg = this.computeInterceptZigzagAngleDeg(b, target, range);
          const zigzagDesired = desired + wave * angleDeg * DEG;
          if (this.projectedRangeAfterMove(b, target, dt, zigzagDesired, CONFIG.zigzagSpeedKt) < 450) {
            desired = angleTo(b.pos(), target.pos());
          } else {
            desired = zigzagDesired;
          }
          speed = CONFIG.zigzagSpeedKt;
          if (!target.zigzagLogged) {
            target.zigzagLogged = true;
            this.logTime(`${b.id} reached 5000 yd from ${target.id}. It begins a 20 kt intercept zigzag with warning flares while preserving firing-entry geometry.`);
          }
        } else {
          b.status = 'intercept-approach';
          target.phase = 'suspicious';
          speed = CONFIG.interceptSpeedKt;
        }
        b.move(dt, desired, speed);
      }
    }
    requestApproval(target, interceptor) {
      if (target.approval === 'pending' || target.approval === 'approved') return;
      target.approval = 'pending';
      this.pendingApprovalThreatId = target.id;
      this.approvalPauseActive = true;
      this.setLogic('weapon', 'danger');
      this.logTime(`${interceptor.id} reached 1000 yd from ${target.id}. Operator/HQ violent-interception approval requested. Simulation paused for HQ response.`);
      this.showApproval(target);
      this.running = false;
      this.approvalTimer = setTimeout(() => {
        if (target.approval === 'pending') {
          UI.approvalCard.classList.remove('pending');
          UI.approvalCard.classList.add('approved');
          UI.approvalTitle.textContent = 'HQ approved violent interception';
          UI.approvalText.textContent = 'The approval screen is green. Confirm violent interception to continue with MAG fire under the 60° / 2100 yd safety-sector check.';
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
      UI.approvalText.textContent = 'HQ review in progress at the 1000 yd decision point. The simulation is paused; the screen will turn green after five seconds or continue when you cancel the display.';
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
      this.updateVideoSafetyText();
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
        target.phase = 'engaging';
        if (target.evasiveSeed) {
          target.evasiveZigzag = true;
          this.logTime(`${target.id} begins evasive zigzag at 20 kt with a fixed 30° weave after MAG fire starts.`);
        } else {
          this.logTime(`${target.id} keeps charging straight at max attack speed even after MAG fire begins.`);
        }
        this.setLogic('weapon', 'danger');
        this.logTime(`HQ approval confirmed for ${target.id}. MAG engagement authorized with 70% hit probability and a 60° / 2100 yd safety-sector check.`);
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
        target.phase = 'engaging';
        if (target.evasiveSeed) {
          target.evasiveZigzag = true;
          this.logTime(`${target.id} begins evasive zigzag at 20 kt with a fixed 30° weave after MAG fire starts.`);
        } else {
          this.logTime(`${target.id} keeps charging straight at max attack speed even after MAG fire begins.`);
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

    updateVideoSafetyText(message = 'MAG 60° / 2100 yd safety sector clear') {
      if (UI.videoSafetyText) UI.videoSafetyText.textContent = message;
    }

    getProtectedObjects() {
      return [
        { id: 'Rig', x: this.rig.x, y: this.rig.y },
        { id: 'Rig north structure', x: this.rig.x, y: this.rig.y - 90 },
        { id: 'Rig south structure', x: this.rig.x, y: this.rig.y + 90 },
        { id: 'Rig east structure', x: this.rig.x + 110, y: this.rig.y },
        { id: 'Rig west structure', x: this.rig.x - 110, y: this.rig.y }
      ];
    }

    isFireSectorClear(shooter, target) {
      const origin = shooter.pos();
      const fireHeading = angleTo(origin, target.pos());
      const halfAngle = CONFIG.magSafetySectorAngleRad / 2;
      const blockers = [];
      const registerBlocker = (obj, category) => {
        const objectPoint = typeof obj.pos === 'function' ? obj.pos() : obj;
        const range = dist(origin, objectPoint);
        if (range > CONFIG.magSafetySectorRangeYd || range < 1) return;
        const bearing = angleTo(origin, objectPoint);
        if (angleDiff(fireHeading, bearing) <= halfAngle) blockers.push({ id: obj.id, range, category, point: objectPoint });
      };

      for (const blue of this.blue) {
        if (blue.id === shooter.id || blue.disabled) continue;
        registerBlocker(blue, 'blue vessel');
      }
      for (const neutral of this.neutrals) {
        if (!neutral.visible || neutral.status === 'left-area') continue;
        registerBlocker(neutral, 'neutral vessel');
      }
      for (const object of this.getProtectedObjects()) registerBlocker(object, 'protected object');

      blockers.sort((a, b) => a.range - b.range);
      this.currentFireSector = {
        shooterId: shooter.id,
        targetId: target.id,
        origin,
        heading: fireHeading,
        halfAngle,
        rangeYd: CONFIG.magSafetySectorRangeYd,
        blockers
      };
      if (blockers.length) this.updateVideoSafetyText(`MAG 60° / 2100 yd sector blocked by ${blockers[0].id}`);
      else this.updateVideoSafetyText();
      return { clear: blockers.length === 0, blocker: blockers[0] || null, blockers };
    }

    safeToFire(b, target) {
      return this.isFireSectorClear(b, target).clear;
    }

    engageMag(b, target, range) {
      if (range > CONFIG.magRangeYd) return;
      if (!this.safeToFire(b, target)) return;
      if (this.time < b.nextShotAt) return;
      b.nextShotAt = this.time + 5;
      const hit = Math.random() < CONFIG.magHitProbability;
      if (hit) {
        target.status = 'neutralized';
        target.phase = 'neutralized';
        target.disabled = true;
        this.logTime(`${b.id} MAG burst hit ${target.id}. Target neutralized and ${b.id} returns to the computed dynamic/static patrol scheme.`);
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
        b.returnPoint = this.closestPointOnCircle(b.pos(), this.activeScenario.dynamicPatrolRadiusYd);
        b.patrolAngle = angleTo(this.rig, b.returnPoint);
      } else if (b.id === 'BS 402') {
        b.role = 'returning-static';
        b.status = 'returning-static';
        b.returnPoint = this.closestPointOnCircle(b.pos(), this.activeScenario.staticPatrolRadiusYd);
      } else if (b.id === 'BS 403') {
        b.role = 'interceptor';
        b.status = 'patrol';
        b.returnPoint = null;
      } else {
        b.role = 'static-guard';
        b.status = 'static-guard';
      }
      if (mode === 'return') {
        if (b.id === 'BS 401') this.logTime(`${b.id} released from ${oldTarget} and returning to the computed dynamic patrol radius at ${formatYd(this.activeScenario.dynamicPatrolRadiusYd)}.`);
        else if (b.id === 'BS 402') this.logTime(`${b.id} released from ${oldTarget} and returning to the static guard ring at ${formatYd(this.activeScenario.staticPatrolRadiusYd)}.`);
        else this.logTime(`${b.id} released from ${oldTarget} and returning to patrol.`);
      }
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
          if (dist(t.pos(), this.rig) <= CONFIG.rigSafetyRingYd) {
            this.outcome = `Mission failed: ${t.id} reached the rig safety ring`;
            this.logTime(this.outcome);
            this.running = false;
            return;
          }
          if (dist(t.pos(), this.rig) <= CONFIG.protectedPolyYd && !t.penetrationLogged) {
            t.penetrationLogged = true;
            this.logTime(`${t.id} entered the 5000 yd protected area. Mission continues; failure is only inside the 500 yd rig safety ring.`);
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
      if (!this.currentFireSector) this.updateVideoSafetyText();
      this.updateThreatTable();
    }

    getThreatPhaseLabel(t) {
      if (!t.detected) return t.phase || 'not detected';
      if (t.phase) return t.phase;
      if (t.status === 'compliant') return 'compliant';
      if (t.status === 'neutralized') return 'neutralized';
      return t.status;
    }

    updateThreatTable() {
      UI.table.innerHTML = '';
      for (const t of this.threats) {
        const tr = document.createElement('tr');
        const rangeRig = t.detected ? formatYd(dist(t.pos(), this.rig)) : 'Not seen';
        const assignedBoat = this.blue.find(b => Array.isArray(t.assignedBoats) && t.assignedBoats.includes(b.id));
        const interceptorRange = assignedBoat ? formatYd(dist(t.pos(), assignedBoat.pos())) : '-';
        tr.innerHTML = `
          <td>${t.id}</td>
          <td>${titleCase(t.targetClass || this.activeScenario.targetClass)}</td>
          <td><span class="status-pill"><span class="status-dot" style="background:${statusColor(t.status)}"></span>${this.getThreatPhaseLabel(t)}</span></td>
          <td>${t.assignedTo || '-'}</td>
          <td>${rangeRig}</td>
          <td>${interceptorRange}</td>
        `;
        UI.table.appendChild(tr);
      }
    }

    updateSeedPanel() {
      const lines = this.threats.map(t => {
        const activationText = Number.isFinite(t.activationTime) ? formatTime(t.activationTime) : 'branch trigger';
        const branchText = t.secondBranchThreat ? 'second-suspicious branch contact' : 'primary contact';
        return `${t.id}: ${branchText}, spawn ${formatYd(t.spawnRadiusYd || t.deferredSpawnRadiusYd || CONFIG.enemySpawnRadiusYd)} at ${activationText}, radio ${t.responds ? 'responds (30% path)' : 'no response (70% path)'}`;
      });
      const neutral = this.neutrals[0];
      const neutralLine = neutral ? `<br>CV-01 neutral path clearance: ${formatYd(neutral.pathClearanceYd)} from rig (outside ${CONFIG.outerMapRingYd.toLocaleString()} yd outer reference ring)` : '';
      UI.scenarioSeed.innerHTML = `<strong>Scenario</strong><br>Time of day: ${titleCase(this.activeScenario.timeOfDay)}<br>Target class: ${titleCase(this.activeScenario.targetClass)}<br>Optical ranges: ${formatOpticalRanges(this.activeScenario.opticalRanges)}<br>Dynamic patrol radius: ${formatYd(this.activeScenario.dynamicPatrolRadiusYd)}<br>Second suspicious branch rolled: ${this.secondSuspiciousDuringFirst ? 'Yes (40% branch active)' : 'No'}<br>${lines.join('<br>')}<br>MAG hit probability in code: 70%${neutralLine}`;
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
      this.drawVectors();
      this.drawFireSafetySector();
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
      const ranges = this.activeScenario.opticalRanges;
      this.drawCircle(ranges.detect, 'rgba(90, 188, 222, 0.32)', `Detect ${ranges.detect} yd`, 34 * DEG);
      this.drawCircle(ranges.recognize, 'rgba(126, 227, 255, 0.28)', `Recognize ${ranges.recognize} yd`, -18 * DEG);
      this.drawCircle(ranges.identify, 'rgba(255, 227, 129, 0.28)', `Identify ${ranges.identify} yd`, -120 * DEG);
      this.drawCircle(CONFIG.protectedPolyYd, 'rgba(255, 156, 61, 0.48)', '5000 yd', 140 * DEG);
      this.drawCircle(this.activeScenario.dynamicPatrolRadiusYd, 'rgba(232, 244, 255, 0.75)', `Dynamic patrol ${Math.round(this.activeScenario.dynamicPatrolRadiusYd)} yd`, -98 * DEG, 2);
      this.drawCircle(this.activeScenario.staticPatrolRadiusYd, 'rgba(130, 245, 195, 0.9)', `Static patrol ${Math.round(this.activeScenario.staticPatrolRadiusYd)} yd`, 58 * DEG, 2);
      this.drawCircle(CONFIG.rigSafetyRingYd, 'rgba(255, 89, 103, 0.48)', 'Rig safety 500 yd', 118 * DEG, 1.5);
    }

    drawCircle(radiusYd, stroke, label, labelAngle, lineWidth = 1) {
      const c = this.worldToScreen(this.rig);
      const s = c.scale;
      const labelStroke = stroke.replace(/,\s*[\d.]+\)$/, ', 0.95)');
      ctx.save();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.arc(c.x, c.y, radiusYd * s, 0, TWO_PI);
      ctx.stroke();
      const lp = { x: c.x + Math.cos(labelAngle) * radiusYd * s, y: c.y + Math.sin(labelAngle) * radiusYd * s };
      ctx.fillStyle = labelStroke;
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

    drawFireSafetySector() {
      if (!this.currentFireSector) return;
      const sector = this.currentFireSector;
      const origin = this.worldToScreen(sector.origin);
      const radius = sector.rangeYd * origin.scale;
      ctx.save();
      ctx.fillStyle = sector.blockers.length ? 'rgba(255, 89, 103, 0.14)' : 'rgba(130, 245, 195, 0.1)';
      ctx.strokeStyle = sector.blockers.length ? 'rgba(255, 89, 103, 0.6)' : 'rgba(130, 245, 195, 0.48)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(origin.x, origin.y);
      ctx.arc(origin.x, origin.y, radius, sector.heading - sector.halfAngle, sector.heading + sector.halfAngle);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      for (const blocker of sector.blockers) {
        const p = this.worldToScreen(blocker.point);
        ctx.fillStyle = 'rgba(255, 89, 103, 0.9)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, TWO_PI);
        ctx.fill();
        ctx.font = '700 11px Inter, system-ui, sans-serif';
        ctx.fillText(blocker.id, p.x, p.y - 9);
      }
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
      const scale = Math.min(rect.width, rect.height) / (this.getMiniMapRangeYd() * 2.2);
      const ranges = this.activeScenario.opticalRanges;
      mctx.strokeStyle = 'rgba(126, 227, 255, 0.35)';
      mctx.beginPath(); mctx.arc(center.x, center.y, ranges.detect * scale, 0, TWO_PI); mctx.stroke();
      mctx.strokeStyle = 'rgba(255, 156, 61, 0.45)';
      mctx.beginPath(); mctx.arc(center.x, center.y, CONFIG.protectedPolyYd * scale, 0, TWO_PI); mctx.stroke();
      mctx.strokeStyle = 'rgba(232, 244, 255, 0.55)';
      mctx.beginPath(); mctx.arc(center.x, center.y, this.activeScenario.dynamicPatrolRadiusYd * scale, 0, TWO_PI); mctx.stroke();
      mctx.strokeStyle = 'rgba(130, 245, 195, 0.68)';
      mctx.beginPath(); mctx.arc(center.x, center.y, this.activeScenario.staticPatrolRadiusYd * scale, 0, TWO_PI); mctx.stroke();
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

    getMiniMapRangeYd() {
      const assetRanges = [
        CONFIG.outerMapRingYd,
        CONFIG.protectedPolyYd,
        CONFIG.rigSafetyRingYd,
        this.activeScenario.dynamicPatrolRadiusYd,
        this.activeScenario.staticPatrolRadiusYd,
        this.activeScenario.opticalRanges.detect,
        this.activeScenario.opticalRanges.recognize,
        this.activeScenario.opticalRanges.identify
      ];
      for (const boat of [...this.blue, ...this.neutrals, ...this.threats]) {
        if (!boat || !boat.visible) continue;
        assetRanges.push(dist(boat.pos(), this.rig) + 600);
      }
      return Math.max(...assetRanges);
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
