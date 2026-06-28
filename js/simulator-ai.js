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
    missionClock: document.getElementById('missionClock'),
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
    dayNightIndicator: document.getElementById('dayNightIndicator'),
    dayNightIcon: document.getElementById('dayNightIcon'),
    dayNightLabel: document.getElementById('dayNightLabel'),
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
    interceptSpeedKt: 20,
    zigzagSpeedKt: 20,
    warningSpeedKt: 30,
    radioChallengeDurationSec: 30,
    enemySlowKt: 5,
    enemyAttackKt: 45,
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
    if (status === 'no-response' || status === 'approval-held' || status === 'suspicious' || status === 'intercepting') return COLORS.orange;
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
  function formatClockTime(totalSec) {
    const normalized = ((Math.floor(totalSec) % 86400) + 86400) % 86400;
    const h = Math.floor(normalized / 3600);
    const m = Math.floor((normalized % 3600) / 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  function getDayPartFromHour(hour24) {
    return hour24 >= 6 && hour24 <= 18 ? 'day' : 'night';
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
      this.startHour = this.readMissionStartHour();
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

    readMissionStartHour() {
      const params = new URLSearchParams(window.location.search);
      const raw = Number(params.get('startHour'));
      return Number.isFinite(raw) ? clamp(Math.round(raw), 0, 23) : 12;
    }

    readScenarioSettings() {
      const timeOfDay = getDayPartFromHour(this.startHour);
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
        engagementGateYd: CONFIG.protectedPolyYd
      };
    }

    buildOperationalProfile(timeOfDay, baseScenario = null) {
      const scenarioBase = baseScenario || this.activeScenario || this.readScenarioSettings();
      const targetClass = scenarioBase.targetClass;
      const staticPatrolRadiusYd = scenarioBase.staticPatrolRadiusYd;
      const opticalRanges = getOpticalRanges(targetClass, timeOfDay);
      const dynamicPatrolRadiusYd = computeDynamicPatrolRadiusYd(opticalRanges, staticPatrolRadiusYd);
      return {
        timeOfDay,
        targetClass,
        staticPatrolRadiusYd,
        opticalRanges,
        dynamicPatrolRadiusYd,
        engagementGateYd: CONFIG.protectedPolyYd
      };
    }

    refreshOperationalProfile() {
      const clockState = this.getMissionClockState();
      const nextProfile = this.buildOperationalProfile(clockState.dayPart, this.activeScenario);
      const previousTimeOfDay = this.activeScenario?.timeOfDay;
      const previousRadius = this.activeScenario?.dynamicPatrolRadiusYd;
      const profileChanged = !this.activeScenario
        || previousTimeOfDay !== nextProfile.timeOfDay
        || previousRadius !== nextProfile.dynamicPatrolRadiusYd
        || this.activeScenario.staticPatrolRadiusYd !== nextProfile.staticPatrolRadiusYd
        || this.activeScenario.targetClass !== nextProfile.targetClass;

      this.activeScenario = nextProfile;

      for (const threat of this.threats) {
        if (!threat || threat.disabled || threat.status === 'neutralized' || threat.status === 'left-area') continue;
        if (!threat.detected || !threat.radioResolved) {
          threat.timeOfDay = this.activeScenario.timeOfDay;
          threat.opticalRanges = { ...this.activeScenario.opticalRanges };
          threat.engagementGateYd = this.activeScenario.engagementGateYd;
        }
      }

      if (profileChanged && previousTimeOfDay && previousTimeOfDay !== nextProfile.timeOfDay) {
        this.logTime(`Mission clock crossed into ${nextProfile.timeOfDay}. Optical ranges and the dynamic patrol radius were recalculated to ${formatYd(nextProfile.dynamicPatrolRadiusYd)} for the current conditions.`);
      }
      if (profileChanged) this.updateSeedPanel();
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
      threat.complianceTurn = choice([-1, 1]);
      threat.assignedBoats = [];
      threat.bs402SupportLogged = false;
      threat.massInterceptLogged = false;
      threat.targetClass = this.activeScenario.targetClass;
      threat.timeOfDay = this.activeScenario.timeOfDay;
      threat.opticalRanges = { ...this.activeScenario.opticalRanges };
      threat.engagementGateYd = this.activeScenario.engagementGateYd;
      threat.radioChallengeStarted = false;
      threat.radioChallengeStartedAt = null;
      threat.radioResolved = false;
      threat.radioNoResponse = false;
      threat.gateEntryLogged = false;
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
          this.logTime('Simulation is paused until the operator approval popup receives a response.');
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
      [UI.targetClass, UI.staticPatrolRadius].forEach(control => {
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
      this.refreshOperationalProfile();
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
          t.radioChallengeStartedAt = this.time;
          this.setLogic('detect');
          this.setSpeedMultiplier(10);
          this.logTime(`${t.id} optical detection at ${Math.round(rangeRig)} yd. Rig optical sensors pass the contact to the patrol boat. Radio calls start while the target range is checked against the ${CONFIG.protectedPolyYd.toLocaleString()} yd gate.`);
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
          t.phase = rangeRig > CONFIG.protectedPolyYd ? 'radio calls outside 5000 yd' : 'radio calls inside 5000 yd';
          t.move(dt, angleTo(t.pos(), this.rig), CONFIG.enemySlowKt);
          const challengeElapsed = t.radioChallengeStartedAt !== null && this.time - t.radioChallengeStartedAt >= CONFIG.radioChallengeDurationSec;
          if (challengeElapsed || rangeRig <= CONFIG.protectedPolyYd) this.challengeThreat(t);
          continue;
        }

        if (t.status === 'no-response') {
          t.phase = rangeRig > CONFIG.protectedPolyYd ? 'no response - monitoring to 5000 yd' : 'inside 5000 yd - intercept';
          t.move(dt, angleTo(t.pos(), this.rig), CONFIG.enemySlowKt);
          if (rangeRig <= CONFIG.protectedPolyYd) {
            t.status = 'suspicious';
            t.phase = 'inside 5000 yd - intercept';
            t.speedKt = CONFIG.enemyAttackKt;
            this.setLogic('intercept', 'warning');
            if (!t.gateEntryLogged) {
              t.gateEntryLogged = true;
              this.logTime(`${t.id} reached the ${CONFIG.protectedPolyYd.toLocaleString()} yd target-to-rig gate with no radio response. Bullshark interception starts in the 20 kt zigzag profile.`);
              this.showMapNotice(`${t.id} is inside 5000 yd with no response. 20 kt zigzag interception is starting.`, 5000);
            }
            this.assignInterceptor(t);
          }
          continue;
        }

        if (t.status === 'unknown') {
          t.phase = 'optical detected';
          t.move(dt, angleTo(t.pos(), this.rig), CONFIG.enemySlowKt);
          continue;
        }

        if (t.status === 'suspicious' || t.status === 'hostile' || t.status === 'engaging' || t.status === 'approval-held') {
          this.moveHostileThreat(t, dt);
          if (dist(t.pos(), this.rig) <= CONFIG.protectedPolyYd && !t.penetrationLogged) {
            t.penetrationLogged = true;
            this.setLogic('intercept', 'danger');
            this.logTime(`${t.id} is inside the ${CONFIG.protectedPolyYd.toLocaleString()} yd target-to-rig gate. Interception continues; mission failure is only inside the 500 yd rig safety ring.`);
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
      const rangeFromRig = dist(t.pos(), this.rig);
      if (t.responds) {
        t.status = 'compliant';
        t.phase = 'compliant';
        t.speedKt = 10;
        this.prepareCompliantEscape(t);
        this.logTime(`${t.id} answered the radio calls at ${Math.round(rangeFromRig)} yd from the rig. It is treated as compliant, blue forces continue patrol, and the contact exits safely.`);
      } else if (rangeFromRig > CONFIG.protectedPolyYd) {
        t.status = 'no-response';
        t.radioNoResponse = true;
        t.phase = 'no response - monitoring to 5000 yd';
        t.speedKt = CONFIG.enemySlowKt;
        this.logTime(`${t.id} did not answer the radio calls at ${Math.round(rangeFromRig)} yd. The contact is monitored until it reaches the ${CONFIG.protectedPolyYd.toLocaleString()} yd target-to-rig gate.`);
      } else {
        t.status = 'suspicious';
        t.radioNoResponse = true;
        t.phase = 'inside 5000 yd - intercept';
        t.speedKt = CONFIG.enemyAttackKt;
        t.gateEntryLogged = true;
        this.setLogic('intercept', 'warning');
        this.logTime(`${t.id} did not answer inside the ${CONFIG.protectedPolyYd.toLocaleString()} yd target-to-rig gate. Bullshark interception starts with 20 kt zigzag and continued radio calls.`);
        this.showMapNotice(`${t.id} failed the radio calls inside 5000 yd. 20 kt zigzag interception is starting.`, 5000);
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
      const desired = angleTo(p, this.rig);
      const speed = t.speedKt || CONFIG.enemyAttackKt;
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
      boat.lastZigzagWave = 0;
      boat.zigzagPlanMode = null;
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
          this.logTime(`${chosenBoat.id} assigned to intercept ${t.id}. The boat keeps radio calls active and uses the 20 kt zigzag profile until the 2000 yd warning-flare gate.`);
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

    computeTargetRearPoint(target, offsetYd = 45) {
      return {
        x: target.x - Math.cos(target.heading) * offsetYd,
        y: target.y - Math.sin(target.heading) * offsetYd
      };
    }

    computeZigzagInterceptHeading(interceptor, target, dt) {
      const direct = angleTo(interceptor.pos(), target.pos());
      interceptor.zigzagClock += dt;
      const wave = Math.sign(Math.sin(interceptor.zigzagClock / 9)) || 1;
      const angleDeg = this.computeInterceptZigzagAngleDeg(interceptor, target, dist(interceptor.pos(), target.pos()));
      const zigzagDesired = direct + wave * angleDeg * DEG;
      if (this.projectedRangeAfterMove(interceptor, target, dt, zigzagDesired, CONFIG.zigzagSpeedKt) < 450) {
        return direct;
      }
      return zigzagDesired;
    }

    computeZigzagInterceptPlan(interceptor, target, dt) {
      const range = dist(interceptor.pos(), target.pos());
      const directHeading = angleTo(interceptor.pos(), target.pos());
      const nextClock = interceptor.zigzagClock + dt;
      const wave = Math.sign(Math.sin(nextClock / 9)) || 1;
      const angleDeg = this.computeInterceptZigzagAngleDeg(interceptor, target, range);
      const zigzagHeading = directHeading + wave * angleDeg * DEG;
      const directProjectedRange = this.projectedRangeAfterMove(interceptor, target, dt, directHeading, CONFIG.zigzagSpeedKt);
      const zigzagProjectedRange = this.projectedRangeAfterMove(interceptor, target, dt, zigzagHeading, CONFIG.zigzagSpeedKt);
      const targetAspectError = angleDiff(target.heading, directHeading);
      const waveChanged = interceptor.lastZigzagWave !== 0 && interceptor.lastZigzagWave !== wave;

      const overshootRisk = zigzagProjectedRange < 450;
      const directClosesMeaningfullyBetter = directProjectedRange + 120 < zigzagProjectedRange;
      const restoreFiringGeometry = targetAspectError > 115 * DEG && range < 3200;
      const shouldAbortCurrentLeg = overshootRisk || directClosesMeaningfullyBetter || restoreFiringGeometry;

      return {
        wave,
        waveChanged,
        mode: shouldAbortCurrentLeg ? 'direct-recover' : `zigzag-${wave > 0 ? 'starboard' : 'port'}`,
        heading: shouldAbortCurrentLeg ? directHeading : zigzagHeading,
        shouldAbortCurrentLeg,
        reason: overshootRisk
          ? 'overshoot-risk'
          : directClosesMeaningfullyBetter
            ? 'direct-closure-better'
            : restoreFiringGeometry
              ? 'restore-firing-geometry'
              : 'continue-zigzag'
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
        let speed = CONFIG.zigzagSpeedKt;

        if (b.magMissed && range <= 200) {
          b.status = 'ramming';
          target.phase = 'rear collision attempt';
          const rearPoint = this.computeTargetRearPoint(target, 45);
          desired = angleTo(b.pos(), rearPoint);
          speed = CONFIG.maxSpeedKt;
          if (!target.rammingLogged) {
            target.rammingLogged = true;
            this.logTime(`${b.id} is within 200 yd of ${target.id}. MAG failed, so it switches to max-speed pursuit and attempts rear-side collision.`);
          }
          if (dist(b.pos(), rearPoint) <= 35 || range <= 35) {
            target.status = 'neutralized';
            target.disabled = true;
            target.phase = 'neutralized';
            this.logTime(`${target.id} neutralized by rear-side collision attempt. ${b.id} remains under control and returns to patrol.`);
            if (!this.hasActiveSuspiciousThreat()) UI.video.classList.add('hidden');
            this.releaseInterceptor(b, 'return');
            continue;
          }
        } else if (range <= 1000) {
          speed = b.magMissed ? CONFIG.warningSpeedKt : CONFIG.warningSpeedKt;
          if (target.approval === 'held') {
            b.status = 'await-approval';
            target.status = 'approval-held';
            target.phase = 'approval held';
            desired = angleTo(b.pos(), target.pos());
            speed = 0;
          } else if (target.approval !== 'approved') {
            b.status = 'await-approval';
            target.phase = 'awaiting approval';
            this.requestApproval(target, b);
          } else if (b.magMissed) {
            b.status = 'closing-for-ram';
            target.phase = 'MAG missed - closing to 200 yd';
            desired = angleTo(b.pos(), target.pos());
            speed = CONFIG.warningSpeedKt;
          } else {
            b.status = 'engage-mag';
            target.status = 'engaging';
            target.phase = 'engaging';
            desired = angleTo(b.pos(), target.pos());
            const sector = this.isFireSectorClear(b, target);
            if (!sector.clear) {
              const blockerName = sector.blocker?.id || 'protected object';
              if (target.lastSafetyBlocker !== blockerName) {
                target.lastSafetyBlocker = blockerName;
                this.logTime(`${b.id} holds MAG fire. ${blockerName} intersects the MAG 60° / 2100 yd safety sector, so the boat keeps maneuvering for a safe flank.`);
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
          target.phase = 'warning flares';
          this.setLogic('approval', 'warning', false);
          desired = angleTo(b.pos(), target.pos());
          b.interceptFlareSide *= -1;
          speed = CONFIG.warningSpeedKt;
          if (!target.warningLogged) {
            target.warningLogged = true;
            this.logTime(`${b.id} reached 2000 yd from ${target.id}. Zigzag stops, the bow stays on target, warning flares alternate 30° left and right, and speed settles at 30 kt.`);
          }
        } else {
          b.status = 'zigzag-warning';
          target.phase = 'zigzag intercept';
          this.setLogic('approval', 'warning', false);
          const zigzagPlan = this.computeZigzagInterceptPlan(b, target, dt);
          b.zigzagClock += dt;
          desired = zigzagPlan.heading;
          speed = CONFIG.zigzagSpeedKt;
          if (!target.zigzagLogged) {
            target.zigzagLogged = true;
            this.logTime(`${b.id} starts the PDF zigzag approach toward ${target.id}: 20 kt, 30-60° zigzag based on target speed, radio calls continuing, and geometry preserved for MAG entry.`);
          }
          if (zigzagPlan.waveChanged && zigzagPlan.mode !== b.zigzagPlanMode) {
            const planText = zigzagPlan.mode === 'direct-recover'
              ? 'cuts the current zigzag leg short and re-centers directly on the target'
              : `switches to the ${zigzagPlan.wave > 0 ? 'starboard' : 'port'} zigzag leg`;
            this.logTime(`${b.id} re-evaluates the intercept as the zigzag angle changes and ${planText}. Reason: ${zigzagPlan.reason.replace(/-/g, ' ')}.`);
          } else if (zigzagPlan.shouldAbortCurrentLeg && b.zigzagPlanMode !== 'direct-recover') {
            this.logTime(`${b.id} stops the current zigzag leg early and goes direct to improve closure and preserve firing-entry geometry.`);
          }
          b.lastZigzagWave = zigzagPlan.wave;
          b.zigzagPlanMode = zigzagPlan.mode;
        }
        b.move(dt, desired, speed);
      }
    }

    getMissionClockState() {
      const missionClockSec = this.startHour * 3600 + this.time;
      const normalized = ((Math.floor(missionClockSec) % 86400) + 86400) % 86400;
      const hour24 = Math.floor(normalized / 3600);
      return {
        timeText: formatClockTime(missionClockSec),
        dayPart: getDayPartFromHour(hour24)
      };
    }

    updateDayNightIndicator(dayPart) {
      if (UI.dayNightIcon) UI.dayNightIcon.textContent = dayPart === 'day' ? '☀' : '☾';
      if (UI.dayNightLabel) UI.dayNightLabel.textContent = titleCase(dayPart);
      if (UI.dayNightIndicator) UI.dayNightIndicator.dataset.state = dayPart;
    }
    syncDayNightIndicator(dayPart) {
      if (UI.dayNightIcon) UI.dayNightIcon.textContent = dayPart === 'day' ? '\u2600' : '\u263E';
      if (UI.dayNightLabel) UI.dayNightLabel.textContent = titleCase(dayPart);
      if (UI.dayNightIndicator) UI.dayNightIndicator.dataset.state = dayPart;
    }

    requestApproval(target, interceptor) {
      if (target.approval === 'pending' || target.approval === 'approved') return;
      target.approval = 'pending';
      this.pendingApprovalThreatId = target.id;
      this.approvalPauseActive = true;
      this.setLogic('weapon', 'danger');
      this.logTime(`${interceptor.id} reached 1000 yd from ${target.id}. Operator approval for violent interception is requested. Simulation paused for the response.`);
      this.showApproval(target);
      this.running = false;
      this.approvalTimer = setTimeout(() => {
        if (target.approval === 'pending') {
          UI.approvalCard.classList.remove('pending');
          UI.approvalCard.classList.add('approved');
          UI.approvalTitle.textContent = 'Operator approval ready';
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
      UI.approvalTitle.textContent = `Waiting for operator approval for ${target.id}`;
      UI.approvalText.textContent = 'Operator review in progress at the 1000 yd decision point. The simulation is paused; the screen turns green after five seconds, but MAG fire starts only if you confirm.';
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
        this.setLogic('weapon', 'danger');
        this.logTime(`Operator approval confirmed for ${target.id}. MAG engagement is authorized with 70% hit probability and the 60° / 2100 yd safety-sector check.`);
      }
      this.hideApproval(false);
      this.showVideoFor(target);
      this.setSpeedMultiplier(1);
      this.running = true;
    }

    cancelApprovalDisplay() {
      const target = this.threats.find(t => t.id === this.pendingApprovalThreatId);
      if (target && target.approval === 'pending') {
        target.approval = 'held';
        target.status = 'approval-held';
        target.phase = 'approval held';
        this.setLogic('weapon', 'warning');
        this.logTime(`Approval display closed for ${target.id}. Violent interception is not authorized, so MAG fire remains blocked.`);
        this.showMapNotice(`${target.id}: approval held. MAG fire is not authorized.`, 5000);
      } else {
        this.logTime('Approval display closed.');
      }
      this.hideApproval(true);
      this.setSpeedMultiplier(1);
      this.running = true;
    }

    updateVideoSafetyText(message = 'MAG 60° / 2100 yd safety sector clear') {
      if (UI.videoSafetyText) UI.videoSafetyText.textContent = message;
    }

    getProtectedObjects() {
      return [
        { id: 'Rig', x: this.rig.x, y: this.rig.y, radiusYd: 150 },
        { id: 'Rig north structure', x: this.rig.x, y: this.rig.y - 90, radiusYd: 80 },
        { id: 'Rig south structure', x: this.rig.x, y: this.rig.y + 90, radiusYd: 80 },
        { id: 'Rig east structure', x: this.rig.x + 110, y: this.rig.y, radiusYd: 80 },
        { id: 'Rig west structure', x: this.rig.x - 110, y: this.rig.y, radiusYd: 80 }
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
        const radiusYd = obj.radiusYd || Math.max(obj.lengthYd || 0, obj.widthYd || 0, 20) / 2;
        const angularRadius = Math.asin(clamp(radiusYd / range, 0, 1));
        if (angleDiff(fireHeading, bearing) <= halfAngle + angularRadius) blockers.push({ id: obj.id, range, category, point: objectPoint, radiusYd });
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
      if (b.magMissed || target.magMissed) return;
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
        this.logTime(`${b.id} MAG burst missed ${target.id}. Continue closing; at 200 yd the boat switches to max-speed rear collision attempt.`);
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
      return this.threats.some(t => t.detected && !t.disabled && ['no-response', 'suspicious', 'hostile', 'engaging', 'approval-held'].includes(t.status));
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
        if (t.status === 'suspicious' || t.status === 'hostile' || t.status === 'engaging' || t.status === 'approval-held' || t.status === 'no-response') {
          if (dist(t.pos(), this.rig) <= CONFIG.rigSafetyRingYd) {
            this.outcome = `Mission failed: ${t.id} reached the rig safety ring`;
            this.logTime(this.outcome);
            this.running = false;
            return;
          }
        }
      }
    }

    updateUI() {
      UI.fps.textContent = String(this.fps);
      UI.time.textContent = formatTime(this.time);
      if (UI.dynamicPatrolRadius) UI.dynamicPatrolRadius.textContent = formatYd(this.activeScenario.dynamicPatrolRadiusYd);
      if (UI.opticalRanges) UI.opticalRanges.textContent = formatOpticalRanges(this.activeScenario.opticalRanges);
      const clockState = this.getMissionClockState();
      if (UI.missionClock) {
        UI.missionClock.textContent = `${clockState.timeText} ${clockState.dayPart}`;
      }
      this.syncDayNightIndicator(clockState.dayPart);
      const live = this.threats.filter(t => t.detected && !['neutralized', 'left-area', 'compliant'].includes(t.status)).length;
      const tracking = this.threats.filter(t => t.detected && t.status !== 'left-area').length;
      const hostile = this.threats.filter(t => ['suspicious', 'hostile', 'engaging', 'approval-held'].includes(t.status)).length;
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
        return `${t.id}: ${branchText}, spawn ${formatYd(t.spawnRadiusYd || t.deferredSpawnRadiusYd || CONFIG.enemySpawnRadiusYd)} at ${activationText}, radio ${t.responds ? 'responds (30% path)' : 'no response (70% path, monitor to 5000 yd)'}`;
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

  const AI_TRIANGLE_ANGLES = [-90 * DEG, 30 * DEG, 150 * DEG];
  const AI_PATROL_RADIUS_BY_DAY_PART = { day: 3200, night: 2400 };
  const expertBindEvents = OffshoreSimulator.prototype.bindEvents;

  function getAiPatrolRadiusYd(dayPart) {
    return AI_PATROL_RADIUS_BY_DAY_PART[dayPart] || AI_PATROL_RADIUS_BY_DAY_PART.day;
  }

  OffshoreSimulator.prototype.configureAiUi = function() {
    const scenario = this.previewScenario || this.activeScenario || this.readScenarioSettings();
    const patrolRadius = scenario.aiPatrolRadiusYd || getAiPatrolRadiusYd(scenario.timeOfDay);

    if (UI.logic.detect) UI.logic.detect.textContent = '1. AI detects inbound contact';
    if (UI.logic.challenge) UI.logic.challenge.textContent = '2. Closest free Bullshark is allocated';
    if (UI.logic.intercept) UI.logic.intercept.textContent = '3. Direct intercept to the predicted meeting point';
    if (UI.logic.approval) UI.logic.approval.textContent = '4. No zigzag; keep the bow on the threat';
    if (UI.logic.weapon) UI.logic.weapon.textContent = '5. Fire as soon as the MAG lane is clear';
    if (UI.logic.recover) UI.logic.recover.textContent = '6. All ships return to the triangle anchors';

    if (UI.staticPatrolRadius) {
      UI.staticPatrolRadius.disabled = true;
      UI.staticPatrolRadius.value = String(patrolRadius);
    }
    if (UI.dynamicPatrolRadius) UI.dynamicPatrolRadius.textContent = `${formatYd(patrolRadius)} triangle patrol`;
    if (UI.opticalRanges) UI.opticalRanges.textContent = formatOpticalRanges(scenario.opticalRanges);
    if (UI.scenarioSettingsHint) {
      UI.scenarioSettingsHint.textContent = 'AI-driven programma: all three Bullsharks hold a triangle anchor. The radius is fixed by day/night, while target class still changes optical ranges.';
    }
  };

  OffshoreSimulator.prototype.readScenarioSettings = function() {
    const timeOfDay = getDayPartFromHour(this.startHour);
    const targetClass = ['small', 'medium', 'large'].includes(UI.targetClass?.value) ? UI.targetClass.value : 'small';
    const opticalRanges = getOpticalRanges(targetClass, timeOfDay);
    const aiPatrolRadiusYd = getAiPatrolRadiusYd(timeOfDay);
    return {
      timeOfDay,
      targetClass,
      staticPatrolRadiusYd: aiPatrolRadiusYd,
      opticalRanges,
      dynamicPatrolRadiusYd: aiPatrolRadiusYd,
      aiPatrolRadiusYd,
      engagementGateYd: opticalRanges.detect
    };
  };

  OffshoreSimulator.prototype.buildOperationalProfile = function(timeOfDay, baseScenario = null) {
    const scenarioBase = baseScenario || this.activeScenario || this.readScenarioSettings();
    const targetClass = scenarioBase.targetClass;
    const opticalRanges = getOpticalRanges(targetClass, timeOfDay);
    const aiPatrolRadiusYd = getAiPatrolRadiusYd(timeOfDay);
    return {
      timeOfDay,
      targetClass,
      staticPatrolRadiusYd: aiPatrolRadiusYd,
      opticalRanges,
      dynamicPatrolRadiusYd: aiPatrolRadiusYd,
      aiPatrolRadiusYd,
      engagementGateYd: opticalRanges.detect
    };
  };

  OffshoreSimulator.prototype.refreshOperationalProfile = function() {
    const clockState = this.getMissionClockState();
    const nextProfile = this.buildOperationalProfile(clockState.dayPart, this.activeScenario);
    const previousTimeOfDay = this.activeScenario?.timeOfDay;
    const previousRadius = this.activeScenario?.aiPatrolRadiusYd;
    const profileChanged = !this.activeScenario
      || previousTimeOfDay !== nextProfile.timeOfDay
      || previousRadius !== nextProfile.aiPatrolRadiusYd
      || this.activeScenario.targetClass !== nextProfile.targetClass;

    this.activeScenario = nextProfile;

    for (const threat of this.threats) {
      if (!threat || threat.disabled || threat.status === 'neutralized' || threat.status === 'left-area') continue;
      threat.timeOfDay = this.activeScenario.timeOfDay;
      threat.opticalRanges = { ...this.activeScenario.opticalRanges };
      threat.engagementGateYd = this.activeScenario.engagementGateYd;
    }

    if (profileChanged && previousTimeOfDay && previousTimeOfDay !== nextProfile.timeOfDay) {
      this.logTime(`Mission clock crossed into ${nextProfile.timeOfDay}. The AI triangle patrol radius shifted to ${formatYd(nextProfile.aiPatrolRadiusYd)} for the new light conditions.`);
    }
    if (profileChanged) {
      this.previewScenario = { ...nextProfile, opticalRanges: { ...nextProfile.opticalRanges } };
      this.configureAiUi();
      this.updateSeedPanel();
    }
  };

  OffshoreSimulator.prototype.refreshScenarioPreview = function() {
    const timeOfDay = this.activeScenario?.timeOfDay || getDayPartFromHour(this.startHour);
    const targetClass = ['small', 'medium', 'large'].includes(UI.targetClass?.value) ? UI.targetClass.value : 'small';
    const opticalRanges = getOpticalRanges(targetClass, timeOfDay);
    const aiPatrolRadiusYd = getAiPatrolRadiusYd(timeOfDay);
    this.previewScenario = {
      timeOfDay,
      targetClass,
      staticPatrolRadiusYd: aiPatrolRadiusYd,
      opticalRanges,
      dynamicPatrolRadiusYd: aiPatrolRadiusYd,
      aiPatrolRadiusYd,
      engagementGateYd: opticalRanges.detect
    };
    this.configureAiUi();
  };

  OffshoreSimulator.prototype.reset = function() {
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
    this.reserveLaunched = true;
    this.initBoats();
    this.initThreatSchedule();
    this.initNeutralTraffic();
    this.hideApproval(true);
    this.refreshScenarioPreview(false);
    this.updateSeedPanel();
    this.log('00:00', `AI-driven programma loaded. ${titleCase(this.activeScenario.timeOfDay)} triangle patrol active at ${formatYd(this.activeScenario.aiPatrolRadiusYd)}. BS 401, BS 402, and BS 403 are all available from mission start.`);
    this.log('00:00', `Nearest free ship assignment is active. Intercepts go straight to the predicted meeting point, without zigzag, and every ship returns to its anchor after the contact is neutralized.`);
    this.updateUI();
  };

  OffshoreSimulator.prototype.bindEvents = function() {
    expertBindEvents.call(this);
    this.configureAiUi();
  };

  OffshoreSimulator.prototype.syncAiPatrolAnchors = function() {
    const radius = this.activeScenario.aiPatrolRadiusYd;
    for (const boat of this.blue) {
      if (typeof boat.homeAngle !== 'number') {
        boat.homeAngle = AI_TRIANGLE_ANGLES[this.blue.indexOf(boat)] || 0;
      }
      boat.homeRadiusYd = radius;
      boat.homePoint = polar(radius, boat.homeAngle);
    }
  };

  OffshoreSimulator.prototype.initBoats = function() {
    const ids = ['BS 401', 'BS 402', 'BS 403'];
    this.blue = ids.map((id, index) => {
      const angle = AI_TRIANGLE_ANGLES[index];
      const p = polar(this.activeScenario.aiPatrolRadiusYd, angle);
      const boat = new Boat(id, 'blue', p.x, p.y, angleTo(p, this.rig), {
        role: 'triangle-hold',
        speedKt: 0,
        status: 'triangle-hold',
        patrolAngle: angle
      });
      boat.homeAngle = angle;
      boat.homePoint = { ...p };
      boat.homeRadiusYd = this.activeScenario.aiPatrolRadiusYd;
      boat.anchorIndex = index;
      return boat;
    });
  };

  OffshoreSimulator.prototype.updatePatrols = function(dt) {
    this.syncAiPatrolAnchors();
    for (const boat of this.blue) {
      if (boat.disabled || boat.targetId) continue;
      const homePoint = boat.homePoint || polar(this.activeScenario.aiPatrolRadiusYd, boat.homeAngle || 0);
      const rangeToHome = dist(boat.pos(), homePoint);
      if (rangeToHome > 70) {
        boat.role = 'returning-home';
        boat.status = 'returning-home';
        boat.move(dt, angleTo(boat.pos(), homePoint), CONFIG.cruiseSpeedKt);
      } else {
        boat.setPos(homePoint);
        boat.role = 'triangle-hold';
        boat.status = 'triangle-hold';
        boat.speedKt = 0;
        boat.heading = angleTo(boat.pos(), this.rig);
        boat.threeDots = boat.computeDots();
      }
    }
  };

  OffshoreSimulator.prototype.updateReserve = function() {};
  OffshoreSimulator.prototype.requestReserve = function() {};

  OffshoreSimulator.prototype.maybeActivateSecondThreat = function() {
    if (!this.secondSuspiciousDuringFirst || this.secondThreatScheduled) return;
    const primaryThreat = this.threats.find(t => t.id === 'TH-01');
    const secondThreat = this.threats.find(t => t.secondBranchThreat);
    if (!primaryThreat || !secondThreat) return;
    if (!['hostile', 'engaging'].includes(primaryThreat.status)) return;
    if (!Array.isArray(primaryThreat.assignedBoats) || primaryThreat.assignedBoats.length === 0) return;
    secondThreat.deferredActivation = false;
    secondThreat.activationTime = this.time + rand(60, 180);
    secondThreat.spawnRadiusYd = secondThreat.deferredSpawnRadiusYd;
    secondThreat.phase = 'queued for AI branch';
    this.secondThreatScheduled = true;
    this.logTime('40% second-hostile branch triggered. TH-02 is entering while TH-01 is already being handled, so the next closest free Bullshark will be allocated.');
    this.updateSeedPanel();
  };

  OffshoreSimulator.prototype.updateThreats = function(dt) {
    this.maybeActivateSecondThreat();
    for (const t of this.threats) {
      if (t.status === 'neutralized' || t.status === 'left-area') continue;
      if (t.deferredActivation || this.time < t.activationTime) continue;
      if (!t.enteredMapLogged) {
        t.enteredMapLogged = true;
        this.setSpeedMultiplier(10);
        this.logTime(`${t.id} entered the 15 x 15 NM map from ${Math.round(t.spawnRadiusYd || CONFIG.enemySpawnRadiusYd).toLocaleString()} yd. The AI screen stepped up to x10 for the intercept run.`);
      }

      const rangeRig = dist(t.pos(), this.rig);
      if (!t.detected && rangeRig <= t.opticalRanges.detect) {
        t.detected = true;
        t.visible = true;
        t.status = 'hostile';
        t.phase = 'AI hostile track';
        t.speedKt = CONFIG.enemyAttackKt;
        this.setLogic('detect');
        this.logTime(`${t.id} was detected at ${Math.round(rangeRig)} yd. The AI marked it hostile immediately and is sending the nearest free Bullshark to the predicted intercept point.`);
        this.assignInterceptor(t);
      }

      if (!t.detected) {
        t.phase = 'not detected';
        t.move(dt, angleTo(t.pos(), this.rig), CONFIG.enemySlowKt);
        continue;
      }

      t.status = t.status === 'engaging' ? 'engaging' : 'hostile';
      t.phase = Array.isArray(t.assignedBoats) && t.assignedBoats.length ? 'AI direct intercept' : 'awaiting AI allocation';
      t.move(dt, angleTo(t.pos(), this.rig), t.speedKt || CONFIG.enemyAttackKt);

      if ((!Array.isArray(t.assignedBoats) || t.assignedBoats.length === 0) && !t.disabled) {
        this.assignInterceptor(t);
      }

      if (rangeRig <= CONFIG.protectedPolyYd && !t.penetrationLogged) {
        t.penetrationLogged = true;
        this.setLogic('intercept', 'danger', false);
        this.logTime(`${t.id} crossed inside ${CONFIG.protectedPolyYd.toLocaleString()} yd. The direct AI intercept continues and the next closest free ship will be allocated if another contact appears.`);
      }
    }
  };

  OffshoreSimulator.prototype.assignUncoveredThreats = function() {
    for (const threat of this.threats) {
      if (threat.detected && !threat.disabled && ['hostile', 'engaging'].includes(threat.status) && (!Array.isArray(threat.assignedBoats) || threat.assignedBoats.length === 0)) {
        this.assignInterceptor(threat);
      }
    }
  };

  OffshoreSimulator.prototype.assignBoatToThreat = function(boat, threat) {
    if (!boat || !threat || boat.disabled || boat.targetId) return false;
    boat.targetId = threat.id;
    boat.role = 'ai-interceptor';
    boat.status = 'direct-intercept';
    boat.interceptPhase = 'direct-intercept';
    boat.aiMissCount = 0;
    boat.zigzagClock = 0;
    boat.lastZigzagWave = 0;
    boat.zigzagPlanMode = null;
    boat.returnPoint = null;
    boat.flankSide = choice([-1, 1]);
    if (!Array.isArray(threat.assignedBoats)) threat.assignedBoats = [];
    if (!threat.assignedBoats.includes(boat.id)) threat.assignedBoats.push(boat.id);
    threat.assignedTo = threat.assignedBoats.join(', ');
    return true;
  };

  OffshoreSimulator.prototype.assignInterceptor = function(threat, allowSupport = false) {
    if (!threat || threat.disabled) return false;
    const activeAssignedBoats = Array.isArray(threat.assignedBoats)
      ? this.blue.filter(boat => threat.assignedBoats.includes(boat.id) && boat.targetId === threat.id)
      : [];
    if (activeAssignedBoats.length > 0 && !allowSupport) {
      return true;
    }

    const candidates = this.blue
      .filter(boat => boat && !boat.disabled && !boat.targetId && !activeAssignedBoats.some(assigned => assigned.id === boat.id))
      .sort((a, b) => dist(a.pos(), threat.pos()) - dist(b.pos(), threat.pos()));
    const chosenBoat = candidates[0];
    if (!this.assignBoatToThreat(chosenBoat, threat)) {
      if (!threat.waitingForInterceptorLogged) {
        threat.waitingForInterceptorLogged = true;
        this.logTime(`${threat.id} has no free Bullshark yet. The next ship released from its current target will be allocated automatically.`);
      }
      return false;
    }

    threat.waitingForInterceptorLogged = false;
    this.setLogic('challenge', 'warning', false);
    if (allowSupport && activeAssignedBoats.length > 0) {
      this.logTime(`${chosenBoat.id} is the next free Bullshark for ${threat.id} and is joining the direct intercept as support.`);
    } else {
      this.logTime(`${chosenBoat.id} is the closest free Bullshark to ${threat.id} and is now running a direct intercept toward the predicted meeting point.`);
    }
    return true;
  };

  OffshoreSimulator.prototype.enforceInterceptionAssignments = function() {
    this.assignUncoveredThreats();
  };

  OffshoreSimulator.prototype.computeAiInterceptPoint = function(interceptor, target) {
    const interceptorSpeed = ktToYdSec(CONFIG.maxSpeedKt);
    const targetSpeed = ktToYdSec(target.speedKt || CONFIG.enemyAttackKt);
    const relX = target.x - interceptor.x;
    const relY = target.y - interceptor.y;
    const targetVx = Math.cos(target.heading) * targetSpeed;
    const targetVy = Math.sin(target.heading) * targetSpeed;
    const a = targetVx * targetVx + targetVy * targetVy - interceptorSpeed * interceptorSpeed;
    const b = 2 * (relX * targetVx + relY * targetVy);
    const c = relX * relX + relY * relY;
    let timeToIntercept = 0;

    if (Math.abs(a) < 1e-6) {
      timeToIntercept = Math.abs(b) < 1e-6 ? 0 : -c / b;
    } else {
      const discriminant = b * b - 4 * a * c;
      if (discriminant >= 0) {
        const root = Math.sqrt(discriminant);
        const t1 = (-b - root) / (2 * a);
        const t2 = (-b + root) / (2 * a);
        const positives = [t1, t2].filter(value => Number.isFinite(value) && value > 0);
        if (positives.length) timeToIntercept = Math.min(...positives);
      }
    }

    if (!Number.isFinite(timeToIntercept) || timeToIntercept <= 0) {
      timeToIntercept = dist(interceptor.pos(), target.pos()) / Math.max(interceptorSpeed, 1e-6);
    }
    timeToIntercept = clamp(timeToIntercept, 0, 240);

    return {
      x: target.x + targetVx * timeToIntercept,
      y: target.y + targetVy * timeToIntercept
    };
  };

  OffshoreSimulator.prototype.updateInterceptors = function(dt) {
    this.currentFireSector = null;
    for (const boat of this.blue) {
      if (!boat.targetId || boat.disabled) continue;
      const target = this.threats.find(threat => threat.id === boat.targetId);
      if (!target || target.status === 'neutralized' || target.status === 'left-area') {
        this.releaseInterceptor(boat, 'return');
        continue;
      }

      const range = dist(boat.pos(), target.pos());
      let desired = angleTo(boat.pos(), this.computeAiInterceptPoint(boat, target));
      let speed = CONFIG.maxSpeedKt;

      if (range <= CONFIG.magRangeYd) {
        boat.status = 'engage-mag';
        target.status = 'engaging';
        target.phase = 'AI firing solution';
        this.setLogic('weapon', 'danger', false);
        const sector = this.isFireSectorClear(boat, target);
        if (!sector.clear) {
          const blockerName = sector.blocker?.id || 'protected object';
          if (target.lastSafetyBlocker !== blockerName) {
            target.lastSafetyBlocker = blockerName;
            this.logTime(`${boat.id} is holding fire on ${target.id} because ${blockerName} blocks the MAG lane. The boat is shifting for a clean shot without breaking the direct intercept.`);
          }
          desired = angleTo(boat.pos(), this.computeSafeFlankPoint(boat, target));
          speed = 24;
          target.phase = 'AI clearing fire lane';
        } else {
          target.lastSafetyBlocker = null;
          desired = angleTo(boat.pos(), target.pos());
          speed = 24;
          this.engageMag(boat, target, range);
          if (!boat.targetId || target.status === 'neutralized') continue;
        }
      } else {
        boat.status = 'direct-intercept';
        target.status = 'hostile';
        target.phase = 'AI direct intercept';
        this.setLogic('intercept', 'warning', false);
      }

      boat.move(dt, desired, speed);
    }
  };

  OffshoreSimulator.prototype.engageMag = function(boat, target, range) {
    if (range > CONFIG.magRangeYd) return;
    if (!this.safeToFire(boat, target)) return;
    if (this.time < boat.nextShotAt) return;
    boat.nextShotAt = this.time + 5;
    const hit = Math.random() < CONFIG.magHitProbability;
    if (hit) {
      target.status = 'neutralized';
      target.phase = 'neutralized';
      target.disabled = true;
      this.logTime(`${boat.id} MAG burst hit ${target.id}. The target is neutralized and ${boat.id} is returning to its triangle anchor.`);
      if (!this.hasActiveSuspiciousThreat()) UI.video.classList.add('hidden');
      this.releaseInterceptor(boat, 'return');
      if (this.hasActiveSuspiciousThreat()) this.setLogic('intercept', 'danger', false);
      else this.setLogic('recover');
    } else {
      boat.aiMissCount = (boat.aiMissCount || 0) + 1;
      this.logTime(`${boat.id} MAG burst missed ${target.id}. The boat stays on the direct firing line and will shoot again as soon as the MAG lane is clear.`);
      this.assignInterceptor(target, true);
    }
  };

  OffshoreSimulator.prototype.releaseInterceptor = function(boat, mode) {
    const oldTarget = boat.targetId;
    const previousTarget = this.threats.find(threat => threat.id === oldTarget);
    if (previousTarget && Array.isArray(previousTarget.assignedBoats)) {
      previousTarget.assignedBoats = previousTarget.assignedBoats.filter(id => id !== boat.id);
      previousTarget.assignedTo = previousTarget.assignedBoats.join(', ') || null;
    }
    boat.targetId = null;
    boat.interceptPhase = null;
    boat.magMissed = false;
    boat.aiMissCount = 0;
    boat.nextShotAt = 0;
    if (boat.disabled) return;
    this.syncAiPatrolAnchors();
    boat.role = 'returning-home';
    boat.status = 'returning-home';
    boat.returnPoint = boat.homePoint ? { ...boat.homePoint } : polar(this.activeScenario.aiPatrolRadiusYd, boat.homeAngle || 0);
    if (mode === 'return') {
      this.logTime(`${boat.id} was released from ${oldTarget} and is returning to its triangle anchor at ${formatYd(this.activeScenario.aiPatrolRadiusYd)}.`);
    }
  };

  OffshoreSimulator.prototype.hasActiveSuspiciousThreat = function() {
    return this.threats.some(threat => threat.detected && !threat.disabled && ['hostile', 'engaging'].includes(threat.status));
  };

  OffshoreSimulator.prototype.refreshMissionLogicState = function() {
    if (this.hasActiveSuspiciousThreat()) return;
    if (this.blue.every(boat => !boat.targetId)) this.setLogic('recover');
  };

  OffshoreSimulator.prototype.updateSeedPanel = function() {
    const lines = this.threats.map(threat => {
      const activationText = Number.isFinite(threat.activationTime) ? formatTime(threat.activationTime) : 'branch trigger';
      const branchText = threat.secondBranchThreat ? 'second-hostile branch contact' : 'primary contact';
      return `${threat.id}: ${branchText}, spawn ${formatYd(threat.spawnRadiusYd || threat.deferredSpawnRadiusYd || CONFIG.enemySpawnRadiusYd)} at ${activationText}`;
    });
    const neutral = this.neutrals[0];
    const neutralLine = neutral ? `<br>CV-01 neutral path clearance: ${formatYd(neutral.pathClearanceYd)} from rig (outside ${CONFIG.outerMapRingYd.toLocaleString()} yd outer reference ring)` : '';
    UI.scenarioSeed.innerHTML = `<strong>AI-driven programma</strong><br>Time of day: ${titleCase(this.activeScenario.timeOfDay)}<br>Target class: ${titleCase(this.activeScenario.targetClass)}<br>Optical ranges: ${formatOpticalRanges(this.activeScenario.opticalRanges)}<br>Triangle patrol radius: ${formatYd(this.activeScenario.aiPatrolRadiusYd)}<br>All three Bullsharks launch on the triangle anchors and the nearest free ship takes each hostile track.<br>Second hostile branch rolled: ${this.secondSuspiciousDuringFirst ? 'Yes (40% branch active)' : 'No'}<br>${lines.join('<br>')}<br>MAG hit probability in code: 70%${neutralLine}`;
  };

  OffshoreSimulator.prototype.drawRangeElements = function() {
    const ranges = this.activeScenario.opticalRanges;
    this.drawCircle(ranges.detect, 'rgba(90, 188, 222, 0.32)', `Detect ${ranges.detect} yd`, 34 * DEG);
    this.drawCircle(ranges.recognize, 'rgba(126, 227, 255, 0.28)', `Recognize ${ranges.recognize} yd`, -18 * DEG);
    this.drawCircle(ranges.identify, 'rgba(255, 227, 129, 0.28)', `Identify ${ranges.identify} yd`, -120 * DEG);
    this.drawCircle(CONFIG.protectedPolyYd, 'rgba(255, 156, 61, 0.48)', '5000 yd', 140 * DEG);
    this.drawCircle(this.activeScenario.aiPatrolRadiusYd, 'rgba(232, 244, 255, 0.82)', `AI triangle ${Math.round(this.activeScenario.aiPatrolRadiusYd)} yd`, -98 * DEG, 2);
    this.drawCircle(CONFIG.rigSafetyRingYd, 'rgba(255, 89, 103, 0.48)', 'Rig safety 500 yd', 118 * DEG, 1.5);
  };

  new OffshoreSimulator();
})();
