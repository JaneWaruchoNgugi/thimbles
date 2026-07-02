import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { GamePhase } from './types';
import { mulberry32 } from './rng';

interface Props {
    phase: GamePhase;
    shellCount: number;
    gemShellId: number;
    pickedSlot: number | null;
    seed?: number;
    onPick: (slot: number, isGem: boolean) => void;
}

interface Cup3D {
    id: number;
    slot: number;
    group: THREE.Group;
    body: THREE.Mesh;      // pickable
    cap: THREE.Mesh;
    x: number;
    ax: number; bx: number; t: number; dur: number; // slide tween
    lift: number; liftTarget: number;
}

const LIFT_Y = 1.9;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function LiveArena3D(props: Props) {
    const mountRef = useRef<HTMLDivElement>(null);
    const propsRef = useRef(props);
    propsRef.current = props;

    useEffect(() => {
        const mount = mountRef.current;
        if (!mount) return;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        mount.appendChild(renderer.domElement);
        renderer.domElement.style.width = '100%';
        renderer.domElement.style.height = '100%';
        renderer.domElement.style.display = 'block';

        const scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x03120a, 0.028);

        const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
        camera.position.set(0, 5.4, 8.2);
        camera.lookAt(0, 0.7, 0);

        // ---- lighting (casino spotlights) ----
        scene.add(new THREE.HemisphereLight(0x335544, 0x05120a, 0.7));
        scene.add(new THREE.AmbientLight(0x224433, 0.5));
        const key = new THREE.SpotLight(0xffffff, 320, 40, Math.PI / 5, 0.5, 1.4);
        key.position.set(0, 12, 5);
        key.target.position.set(0, 0, 0);
        scene.add(key); scene.add(key.target);
        const glow1 = new THREE.PointLight(0x3fff6a, 60, 30, 2);
        glow1.position.set(-6, 4, 3);
        scene.add(glow1);
        const glow2 = new THREE.PointLight(0x18d0a0, 40, 30, 2);
        glow2.position.set(6, 3.5, -2);
        scene.add(glow2);
        const gemLight = new THREE.PointLight(0x8dff5a, 0, 12, 2);
        gemLight.position.set(0, 0.6, 0);
        scene.add(gemLight);

        // ---- floor (reflective-ish dark casino floor) ----
        const floor = new THREE.Mesh(
            new THREE.CircleGeometry(40, 64),
            new THREE.MeshStandardMaterial({ color: 0x061a0e, roughness: 0.55, metalness: 0.35 }),
        );
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -0.62;
        scene.add(floor);

        // distant bokeh light orbs for a "casino hall" backdrop
        const orbGeo = new THREE.SphereGeometry(0.5, 12, 12);
        const orbColors = [0x39e06a, 0x18d0a0, 0x2f9e2a, 0x8ef23c, 0x39e08a];
        for (let i = 0; i < 26; i++) {
            const m = new THREE.Mesh(orbGeo, new THREE.MeshBasicMaterial({
                color: orbColors[i % orbColors.length], transparent: true, opacity: 0.35,
            }));
            const ang = (i / 26) * Math.PI * 2;
            const rad = 14 + (i % 4) * 3;
            m.position.set(Math.cos(ang) * rad, 1 + (i % 5) * 1.6, Math.sin(ang) * rad - 6);
            const s = 0.4 + (i % 3) * 0.4;
            m.scale.setScalar(s);
            scene.add(m);
        }

        // ---- moving light rays (casino searchlights sweeping the backdrop) ----
        const rayGroup = new THREE.Group();
        rayGroup.position.set(0, 0.2, -8.5);
        rayGroup.rotation.x = -0.42;
        scene.add(rayGroup);
        const rayColors = [0x62ff6e, 0x18e0a8, 0xa2f23c, 0x39e08a, 0x2fd18a];
        const rays: THREE.Object3D[] = [];
        const NRAY = 7;
        for (let i = 0; i < NRAY; i++) {
            const mat = new THREE.MeshBasicMaterial({
                color: rayColors[i % rayColors.length],
                transparent: true, opacity: 0.085, blending: THREE.AdditiveBlending,
                depthWrite: false, side: THREE.DoubleSide,
            });
            const beam = new THREE.Mesh(new THREE.ConeGeometry(1.05, 26, 22, 1, true), mat);
            beam.rotation.x = Math.PI;   // narrow tip at the source, widening upward
            beam.position.y = 13;
            const pivot = new THREE.Object3D();
            pivot.add(beam);
            pivot.rotation.z = (i / (NRAY - 1) - 0.5) * 0.95;
            rayGroup.add(pivot);
            rays.push(pivot);
        }

        // ---- table ----
        const table = new THREE.Group();
        const feltMat = new THREE.MeshStandardMaterial({ color: 0x0f5a2c, roughness: 0.92, metalness: 0.02 });
        const top = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 0.5, 80), feltMat);
        top.position.y = -0.25;
        table.add(top);
        // felt centre glow ring
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x39ff6a, transparent: true, opacity: 0.5 });
        for (let i = 0; i < 3; i++) {
            const ring = new THREE.Mesh(new THREE.TorusGeometry(2.2 + i * 1.1, 0.035, 12, 90), ringMat);
            ring.rotation.x = -Math.PI / 2;
            ring.position.y = 0.01;
            table.add(ring);
        }
        // wooden / dark gold rim
        const rim = new THREE.Mesh(
            new THREE.TorusGeometry(6, 0.34, 20, 90),
            new THREE.MeshStandardMaterial({ color: 0x1c140a, roughness: 0.35, metalness: 0.8 }),
        );
        rim.rotation.x = -Math.PI / 2;
        rim.position.y = 0.02;
        table.add(rim);
        const rimGold = new THREE.Mesh(
            new THREE.TorusGeometry(6, 0.08, 16, 90),
            new THREE.MeshStandardMaterial({ color: 0xc9a24b, roughness: 0.3, metalness: 0.95 }),
        );
        rimGold.rotation.x = -Math.PI / 2;
        rimGold.position.y = 0.16;
        table.add(rimGold);
        // pedestal
        const ped = new THREE.Mesh(
            new THREE.CylinderGeometry(2.4, 3.2, 1.2, 48),
            new THREE.MeshStandardMaterial({ color: 0x120c06, roughness: 0.5, metalness: 0.6 }),
        );
        ped.position.y = -1.1;
        table.add(ped);
        scene.add(table);

        // ---- materials for cups ----
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x0d130f, roughness: 0.5, metalness: 0.4 });
        const capMat = () => new THREE.MeshStandardMaterial({ color: 0x8ee01e, emissive: 0x5fd11e, emissiveIntensity: 0.7, roughness: 0.35, metalness: 0.1 });
        const bandMat = new THREE.MeshStandardMaterial({ color: 0xd2d8e4, roughness: 0.3, metalness: 0.95 });

        function makeCup(): { group: THREE.Group; body: THREE.Mesh; cap: THREE.Mesh } {
            const group = new THREE.Group();
            const body = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.86, 1.7, 56), bodyMat);
            body.position.y = 0.85;
            group.add(body);
            const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.54, 0.26, 56), capMat());
            cap.position.y = 1.72;
            group.add(cap);
            const dome = new THREE.Mesh(new THREE.SphereGeometry(0.5, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), capMat());
            dome.position.y = 1.84;
            group.add(dome);
            const band = new THREE.Mesh(new THREE.TorusGeometry(0.84, 0.14, 18, 56), bandMat);
            band.rotation.x = Math.PI / 2;
            band.position.y = 0.22;
            group.add(band);
            return { group, body, cap };
        }

        // ---- gem ----
        const gem = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.42, 0),
            new THREE.MeshStandardMaterial({ color: 0xaaff66, emissive: 0x7bff45, emissiveIntensity: 1.3, roughness: 0.15, metalness: 0.4 }),
        );
        gem.position.set(0, 0.5, 0);
        gem.visible = false;
        scene.add(gem);

        // ---- pick marker (floating cone + ring) ----
        const marker = new THREE.Group();
        const cone = new THREE.Mesh(
            new THREE.ConeGeometry(0.28, 0.5, 4),
            new THREE.MeshStandardMaterial({ color: 0x9dff5a, emissive: 0x6cff3a, emissiveIntensity: 1.2 }),
        );
        cone.rotation.z = Math.PI; // point down
        marker.add(cone);
        marker.visible = false;
        scene.add(marker);

        // ---- cups state ----
        let cups: Cup3D[] = [];
        let spacing = 2.3;
        let camDist = 8.2;
        let camHeight = 5.4;
        const slotX = (slot: number, n: number) => (slot - (n - 1) / 2) * spacing;

        // Frame the table for the current viewport — pull back on narrow/portrait screens.
        function applyCamera() {
            const w = mount!.clientWidth || 1;
            const h = mount!.clientHeight || 1;
            const aspect = w / h;
            const f = aspect < 1.4 ? Math.min(2.2, 1.4 / Math.max(0.42, aspect)) : 1;
            camera.position.set(0, camHeight * (1 + (f - 1) * 0.35), camDist * f);
            camera.lookAt(0, 0.7, 0);
        }

        function buildCups(n: number) {
            cups.forEach((c) => scene.remove(c.group));
            cups = [];
            // fit 3–6 cups on the table: tighter spacing + camera pulled back as count grows
            spacing = Math.max(1.9, Math.min(2.45, 12 / (n + 1.5)));
            camDist = 8.2 + (n - 3) * 0.75;
            camHeight = 5.4 + (n - 3) * 0.25;
            applyCamera();
            for (let i = 0; i < n; i++) {
                const { group, body, cap } = makeCup();
                const x = slotX(i, n);
                group.position.set(x, 0, 0);
                body.userData.cup = i;
                scene.add(group);
                cups.push({ id: i, slot: i, group, body, cap, x, ax: x, bx: x, t: 0, dur: 0, lift: 0, liftTarget: 0 });
            }
        }

        function cupAtSlot(slot: number) { return cups.find((c) => c.slot === slot); }

        // deterministic shuffle plan
        let swapPlan: { a: number; b: number }[] = [];
        let swapAt: number[] = [];
        let swapIdx = 0;
        let shuffleStart = 0;

        function buildPlan(seed: number, n: number) {
            const rng = mulberry32(seed >>> 0);
            const count = 6 + Math.floor(rng() * 3);
            swapPlan = []; swapAt = [];
            for (let i = 0; i < count; i++) {
                const a = Math.floor(rng() * n);
                let b = Math.floor(rng() * n); let g = 0;
                while (b === a && g++ < 10) b = Math.floor(rng() * n);
                if (b === a) b = (a + 1) % n;
                swapPlan.push({ a, b });
                swapAt.push(500 + i * 470);
            }
            swapIdx = 0;
        }

        function doSwap(ca: Cup3D, cb: Cup3D) {
            const n = cups.length;
            const sa = ca.slot; ca.slot = cb.slot; cb.slot = sa;
            for (const c of [ca, cb]) { c.ax = c.x; c.bx = slotX(c.slot, n); c.t = 0; c.dur = 430; }
        }

        let phaseLocal: GamePhase = 'idle';
        function onPhaseChange(to: GamePhase) {
            const P = propsRef.current;
            const n = cups.length;
            if (to === 'peek') {
                cups.forEach((c) => { c.slot = c.id; c.x = slotX(c.id, n); c.ax = c.x; c.bx = c.x; c.dur = 0; c.group.position.x = c.x; c.liftTarget = 1; });
            } else if (to === 'shuffling') {
                cups.forEach((c) => { c.liftTarget = 0; });
                shuffleStart = performance.now();
                if (P.seed != null) buildPlan(P.seed, n); else swapPlan = [];
            } else if (to === 'idle') {
                cups.forEach((c) => { c.liftTarget = 0; });
            }
        }

        // ---- pointer picking ----
        const raycaster = new THREE.Raycaster();
        const ndc = new THREE.Vector2();
        function onPointerDown(e: PointerEvent) {
            if (propsRef.current.phase !== 'picking') return;
            const rect = renderer.domElement.getBoundingClientRect();
            ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(ndc, camera);
            const hits = raycaster.intersectObjects(cups.map((c) => c.body), false);
            if (hits.length) {
                const cupId = hits[0].object.userData.cup as number;
                const cup = cups.find((c) => c.id === cupId);
                if (cup) propsRef.current.onPick(cup.slot, cup.id === propsRef.current.gemShellId);
            }
        }
        renderer.domElement.addEventListener('pointerdown', onPointerDown);

        // ---- resize ----
        function resize() {
            const w = mount!.clientWidth || 1;
            const h = mount!.clientHeight || 1;
            renderer.setSize(w, h, false);
            camera.aspect = w / h;
            applyCamera();
            camera.updateProjectionMatrix();
        }
        const ro = new ResizeObserver(resize);
        ro.observe(mount);
        resize();

        buildCups(propsRef.current.shellCount);

        // ---- animation loop ----
        let last = performance.now();
        let raf = 0;
        let clock = 0;
        function frame(now: number) {
            const dt = Math.min(50, now - last); last = now;
            clock += dt / 1000;
            const P = propsRef.current;

            if (cups.length !== P.shellCount && (P.phase === 'idle' || P.phase === 'peek')) buildCups(P.shellCount);
            if (P.phase !== phaseLocal) { phaseLocal = P.phase; onPhaseChange(P.phase); }

            // deterministic swaps
            if (P.phase === 'shuffling' && P.seed != null) {
                while (swapIdx < swapPlan.length && now >= shuffleStart + swapAt[swapIdx]) {
                    const { a, b } = swapPlan[swapIdx];
                    const ca = cupAtSlot(a); const cb = cupAtSlot(b);
                    if (ca && cb && ca !== cb) doSwap(ca, cb);
                    swapIdx++;
                }
            }

            // lift targets for reveal
            const gemCup = cups.find((c) => c.id === P.gemShellId);
            if (P.phase === 'revealing' || P.phase === 'result') {
                const picked = P.pickedSlot != null ? cupAtSlot(P.pickedSlot) : undefined;
                cups.forEach((c) => { c.liftTarget = 0; });
                if (picked) picked.liftTarget = 1;
                const pickedIsGem = !!picked && picked.id === P.gemShellId;
                if (gemCup && (!picked || !pickedIsGem)) gemCup.liftTarget = 1;
            }

            // update cups
            for (const c of cups) {
                if (c.dur > 0) {
                    c.t += dt;
                    const t = Math.min(1, c.t / c.dur);
                    const e = easeInOut(t);
                    c.x = lerp(c.ax, c.bx, e);
                    c.group.position.z = -Math.sin(Math.PI * t) * 0.9; // arc forward
                    c.group.position.y = Math.sin(Math.PI * t) * 0.35 + c.lift * LIFT_Y;
                    if (t >= 1) { c.dur = 0; c.x = c.bx; c.group.position.z = 0; }
                } else {
                    c.group.position.z = lerp(c.group.position.z, 0, 0.2);
                }
                c.lift += (c.liftTarget - c.lift) * Math.min(1, dt / 150);
                c.group.position.x = c.x;
                if (c.dur === 0) c.group.position.y = c.lift * LIFT_Y;
                c.group.rotation.y = Math.sin(clock * 0.6 + c.id) * 0.02;
            }

            // gem
            const gemVisible = P.phase === 'peek' || ((P.phase === 'revealing' || P.phase === 'result') && !!gemCup && gemCup.lift > 0.45);
            gem.visible = gemVisible;
            if (gemCup) { gem.position.x = gemCup.x; gem.position.z = 0; }
            gem.position.y = 0.5 + Math.sin(clock * 3) * 0.06;
            gem.rotation.y = clock * 1.6;
            gemLight.intensity = gemVisible ? 26 : 0;
            gemLight.position.set(gem.position.x, 0.7, 0);

            // pick marker
            const showMarker = (P.phase === 'picking' || P.phase === 'revealing') && P.pickedSlot != null;
            marker.visible = showMarker;
            if (showMarker) {
                const pc = cupAtSlot(P.pickedSlot!);
                if (pc) { marker.position.set(pc.x, 2.9 + pc.lift * LIFT_Y + Math.sin(clock * 5) * 0.12, 0); }
                cone.rotation.y = clock * 2;
            }

            // gently drift the casino glow lights
            glow1.position.x = Math.sin(clock * 0.5) * 6;
            glow2.position.x = Math.cos(clock * 0.4) * 6;

            // sweep the light rays
            rayGroup.rotation.y = Math.sin(clock * 0.22) * 0.55;
            for (let i = 0; i < rays.length; i++) {
                rays[i].rotation.z = (i / (NRAY - 1) - 0.5) * 0.95 + Math.sin(clock * 0.6 + i * 0.8) * 0.13;
            }

            renderer.render(scene, camera);
            raf = requestAnimationFrame(frame);
        }
        raf = requestAnimationFrame(frame);

        return () => {
            cancelAnimationFrame(raf);
            ro.disconnect();
            renderer.domElement.removeEventListener('pointerdown', onPointerDown);
            renderer.dispose();
            if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
        };
    }, []);

    return <div className="lg3d" ref={mountRef} />;
}
