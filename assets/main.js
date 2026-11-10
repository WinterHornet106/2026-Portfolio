/* ============================================================
   Portfolio 2026 — interactions
   Keep it lean: reveal, nav state, cursor, magnetic, copy, VT.
   Respects prefers-reduced-motion throughout.
   ============================================================ */
(function () {
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarse = window.matchMedia("(pointer: coarse)").matches;

  /* ---------- Sky backdrop: a flowing fluid in Jay's palette ----------
     A WebGL shader paints one continuous field of colour (white, pale aqua
     #CBF9FF, cyan #7FE3FF, sky #00BBFF) that flows like liquid, using warped
     noise, so there are no shapes or edges to see. With a mouse, the cursor
     moves through the water like a finger through dye: the water ahead is
     shoved aside, the strip just behind the finger is left clear, and further
     back the water pushed aside flows back in from both sides and closes the
     trail, curling into a pair of small swirls. Then it all slowly dissolves
     back into the flow. Nothing springs back.
     How: a small velocity field (the water under the finger moves with it, it
     carries itself and calms down) kept incompressible by a pressure step, as
     real water is: water can't be squashed, so what the finger pushes away
     has to go round it and come back in behind it. A colour field is carried
     by that velocity, cleared where the finger is, and eased towards the
     flowing noise each frame. Both live in half-float textures so
     tiny changes don't round away. Rendered at half screen resolution
     (lightly blurred), paused when off-screen or in a background tab. Runs
     even under reduced motion, at Jay's request. If WebGL or half-float
     textures are missing, the layer falls back to a still CSS wash. */
  let skyFinger = () => {};                           // set by sky(): push the liquid from code
  const sky = () => {
    const layer = document.createElement("div");
    layer.className = "sky";
    layer.setAttribute("aria-hidden", "true");
    document.body.prepend(layer);
    const canvas = document.createElement("canvas");
    canvas.className = "sky__canvas";
    layer.appendChild(canvas);
    const fallback = () => { layer.classList.add("sky--static"); canvas.remove(); };
    const gl = canvas.getContext("webgl", { antialias: false, premultipliedAlpha: true, preserveDrawingBuffer: false });
    if (!gl) return fallback();
    const half = gl.getExtension("OES_texture_half_float");
    gl.getExtension("EXT_color_buffer_half_float");
    const smooth = gl.getExtension("OES_texture_half_float_linear");
    if (!half) return fallback();

    const vert = "attribute vec2 p; varying vec2 uv; void main(){ uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }";
    const head = "precision mediump float; varying vec2 uv;\n";
    // The ambient flow, as premultiplied colour over the page.
    const flow = `
      uniform float uTime, uAspect;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
                   mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
      }
      float fbm(vec2 p){
        float v = 0.0, a = 0.5;
        for (int k = 0; k < 3; k++) { v += a * noise(p); p = p * 2.02 + 17.0; a *= 0.5; }
        return v;
      }
      vec4 flowColour(vec2 st){
        vec2 p = vec2(st.x * uAspect, 1.0 - st.y) * 0.9;
        float t = uTime * 0.18;
        vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, -t * 0.8)));
        vec2 r = vec2(fbm(p + 3.0 * q + vec2(1.7, 9.2) + t * 0.6), fbm(p + 3.0 * q + vec2(8.3, 2.8) - t * 0.5));
        float f = fbm(p + 2.5 * r);
        // Ramune blue, the soda bottle's glass (8 Nov 2026, Jay; navy before:
        // #97A8C8, #465F90, #132652; the hojicha browns #EBD6B4, #D6AE83, #9A6A3C)
        // lighter (Jay, 8 Nov 2026; was #CDEFFA, #7FD3EE, #2FA8D8)
        vec3 sky1 = vec3(0.871, 0.961, 0.988);   // #DEF5FC glassy pale aqua
        vec3 cyan = vec3(0.663, 0.890, 0.961);   // #A9E3F5 light Ramune blue
        vec3 sky2 = vec3(0.388, 0.769, 0.906);   // #63C4E7 Ramune blue
        vec4 o = vec4(0.0);
        float a = smoothstep(0.45, 0.85, f) * 0.85;
        o = vec4(sky1 * a + o.rgb * (1.0 - a), a + o.a * (1.0 - a));
        a = smoothstep(0.42, 0.78, r.x) * 0.4;
        o = vec4(cyan * a + o.rgb * (1.0 - a), a + o.a * (1.0 - a));
        a = smoothstep(0.45, 0.85, f * r.y * 1.6) * 0.22;
        o = vec4(sky2 * a + o.rgb * (1.0 - a), a + o.a * (1.0 - a));
        return o;
      }`;
    // Velocity: carried along by itself, calming every frame, plus the
    // cursor's push along its last stretch of path (forward, and a little
    // outward on each side, so the water parts around it). At the edges of the
    // screen the water bounces back instead of flowing off it.
    const velFrag = head + `
      uniform sampler2D uV; uniform float uAspect, uOn, uR, uDisc, uClr; uniform vec4 uSeg; uniform vec2 uVel; uniform vec2 uPad;
      void main(){
        vec2 v = texture2D(uV, uv).xy;
        vec2 nv = texture2D(uV, uv - v).xy * 0.97;
        vec2 k = vec2(uAspect, 1.0);
        vec2 pa = (uv - uSeg.xy) * k, ba = (uSeg.zw - uSeg.xy) * k;
        float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
        vec2 d = pa - ba * h;
        // The finger: the water where it is moves with it. The pressure step
        // then makes the water ahead go round it and refill the trail behind.
        // the cursor: a soft round blur (3/4 of its old radius since 8 Nov
        // 2026: 3200 was 1800, and 4980 was 2800 below); the flying glass (uDisc): a disc of
        // radius uR with a short soft edge, so it stays inside the cup
        float g = uOn * (uDisc > 0.5 ? 1.0 - smoothstep(uR * 0.7, uR, length(d)) : exp(-dot(d, d) * 3200.0));
        // uClr: the glass only takes hold once it's really moving, and more
        // loosely than the cursor, or it stamps its launch spot and the water
        // it drags curls into two lobes there (starting vortices)
        nv = mix(nv, uVel, g * uClr * (uDisc > 0.5 ? 0.3 : 1.0));
        // Walls at the visible edges (the canvas overhangs them by uPad):
        // water moving into a wall turns round, losing a little speed.
        vec2 lo = uPad + 0.012, hi = 1.0 - uPad - 0.012;
        if (uv.x < lo.x && nv.x < 0.0) nv.x = -nv.x * 0.8;
        if (uv.x > hi.x && nv.x > 0.0) nv.x = -nv.x * 0.8;
        if (uv.y < lo.y && nv.y < 0.0) nv.y = -nv.y * 0.8;
        if (uv.y > hi.y && nv.y > 0.0) nv.y = -nv.y * 0.8;
        gl_FragColor = vec4(nv, 0.0, 1.0);
      }`;
    // Incompressibility, in three steps (the standard pressure projection):
    // measure where water is piling up or thinning out (divergence), solve
    // for the pressure that would undo it (a few relaxation passes, starting
    // from last frame's answer), then take that pressure's slope off the
    // velocity. What's left only swirls and flows round, never squashes.
    const hp = "precision highp float; varying vec2 uv;\n";
    const divFrag = hp + `
      uniform sampler2D uV; uniform vec2 uTx;
      void main(){
        float L = texture2D(uV, uv - vec2(uTx.x, 0.0)).x, R = texture2D(uV, uv + vec2(uTx.x, 0.0)).x;
        float B = texture2D(uV, uv - vec2(0.0, uTx.y)).y, T = texture2D(uV, uv + vec2(0.0, uTx.y)).y;
        gl_FragColor = vec4(0.5 * ((R - L) / uTx.x + (T - B) / uTx.y), 0.0, 0.0, 1.0);
      }`;
    const jacFrag = hp + `
      uniform sampler2D uP, uD; uniform vec2 uTx;
      void main(){
        float L = texture2D(uP, uv - vec2(uTx.x, 0.0)).x, R = texture2D(uP, uv + vec2(uTx.x, 0.0)).x;
        float B = texture2D(uP, uv - vec2(0.0, uTx.y)).x, T = texture2D(uP, uv + vec2(0.0, uTx.y)).x;
        gl_FragColor = vec4((L + R + B + T - texture2D(uD, uv).x) * 0.25, 0.0, 0.0, 1.0);
      }`;
    const gradFrag = hp + `
      uniform sampler2D uV, uP; uniform vec2 uTx;
      void main(){
        float L = texture2D(uP, uv - vec2(uTx.x, 0.0)).x, R = texture2D(uP, uv + vec2(uTx.x, 0.0)).x;
        float B = texture2D(uP, uv - vec2(0.0, uTx.y)).x, T = texture2D(uP, uv + vec2(0.0, uTx.y)).x;
        vec2 v = texture2D(uV, uv).xy - 0.5 * vec2((R - L) * uTx.x, (T - B) * uTx.y);
        gl_FragColor = vec4(v, 0.0, 1.0);
      }`;
    // Colour: carried by the velocity, cleared where the finger is (the dye
    // is pushed out of its way), then eased a little towards the flow.
    const colFrag = head + flow + `
      uniform sampler2D uC, uV; uniform float uK, uOn, uR, uDisc, uClr; uniform vec4 uSeg;
      void main(){
        vec2 v = texture2D(uV, uv).xy;
        vec2 k = vec2(uAspect, 1.0);
        vec2 pa = (uv - uSeg.xy) * k, ba = (uSeg.zw - uSeg.xy) * k;
        float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
        vec2 d = pa - ba * h;
        float g = uOn * (uDisc > 0.5 ? 1.0 - smoothstep(uR * 0.7, uR, length(d)) : exp(-dot(d, d) * 4980.0));
        vec4 c = texture2D(uC, uv - v) * (1.0 - 0.8 * g * uClr);
        gl_FragColor = mix(c, flowColour(uv), uK);
      }`;
    // Milk, as in a latte that's already mixed: no pours or blobs, just
    // streaks of milk marbled through the tea. The milk is still a dye the
    // water carries (a slow current that can only swirl, never squash, plus
    // the cursor's push), so the streaks stretch and fold like real liquid;
    // it's gently kept topped up towards a marbled pattern (long swirling
    // bands, bent by layered noise) that itself drifts very slowly, so the
    // swirls never run out or smear into one flat colour.
    const milkFrag = head + flow + `
      uniform sampler2D uM, uV; uniform float uDt, uFresh;
      vec2 current(vec2 st){
        vec2 p = vec2(st.x * uAspect, st.y) * 5.0;               // small eddies: lots of shear, little drift
        float t = uTime * 0.04, e = 0.02;
        float n = fbm(p + vec2(0.0, e) + t), s2 = fbm(p - vec2(0.0, e) + t);
        float ea = fbm(p + vec2(e, 0.0) - t), we = fbm(p - vec2(e, 0.0) - t);
        return vec2(n - s2, we - ea) / (2.0 * e) * 0.012;   // curl: swirls, never squashes
      }
      float marble(vec2 st){
        vec2 p = vec2(st.x * uAspect, st.y) * 1.6;
        float t = uTime * 0.02;
        vec2 q = vec2(fbm(p + vec2(t, 0.0)), fbm(p + vec2(4.1, -t)));      // bend the bands into swirls
        float w = fbm(p + 2.2 * q) * 3.0;
        float band = 0.5 + 0.5 * sin((p.x * 0.6 + p.y) * 7.0 + w * 6.0);
        return smoothstep(0.62, 0.95, band);                     // thin streaks of milk
      }
      void main(){
        vec2 v = texture2D(uV, uv).xy + current(uv) * uDt;
        float m = texture2D(uM, uv - v).x;
        m = mix(m, marble(uv), max(uFresh, 0.25 * uDt));   // topped up very gently
        gl_FragColor = vec4(m, 0.0, 0.0, 1.0);
      }`;
    // Shown over the white page: the tea, then the milk in it (a soft
    // cream, partly see-through, so it reads as lighter, milkier tea).
    // Where the liquid gets darker than MAX_DARK (how far below white it may
    // go, 0 to 1), the whole pixel is thinned out to that limit, keeping its
    // colour, so it never goes muddy.
    // MILK: how much the milk swirls show (0.5 on; 0 off, Jay, 8 Nov 2026,
    // hardly visible on Ramune). At 0 the milk isn't simulated at all.
    const MILK = 0;
    const MAX_DARK = "0.2";   // 0.2 with the browns, 0.35 for navy; Ramune is light, so a touch over the browns keeps it bright
    const showFrag = head + `uniform sampler2D uC, uM; void main(){
      vec4 c = clamp(texture2D(uC, uv), 0.0, 1.0);
      float a = smoothstep(0.15, 0.85, texture2D(uM, uv).x) * ${MILK.toFixed(2)};    // cream, mixed in, not white
      c = vec4(vec3(0.95, 0.97, 1.0) * a + c.rgb * (1.0 - a), a + c.a * (1.0 - a));   // cool milk on navy (warm cream with the browns)
      float dark = dot(vec3(c.a) - c.rgb, vec3(0.2126, 0.7152, 0.0722));
      gl_FragColor = c * min(1.0, ${MAX_DARK} / max(dark, 1e-4));
    }`;

    const sh = (type, src) => { const o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); return o; };
    const program = (frag) => {
      const pr = gl.createProgram();
      gl.attachShader(pr, sh(gl.VERTEX_SHADER, vert));
      gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, frag));
      gl.bindAttribLocation(pr, 0, "p");
      gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
      const u = {};
      for (let i = 0, n = gl.getProgramParameter(pr, gl.ACTIVE_UNIFORMS); i < n; i++) {
        const name = gl.getActiveUniform(pr, i).name;
        u[name] = gl.getUniformLocation(pr, name);
      }
      return { pr, u };
    };
    const velP = program(velFrag), colP = program(colFrag), showP = program(showFrag), milkP = program(milkFrag);
    const divP = program(divFrag), jacP = program(jacFrag), gradP = program(gradFrag);
    if (!velP || !colP || !showP || !milkP || !divP || !jacP || !gradP) return fallback();
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    // A render target: a half-float texture with its framebuffer.
    const target = (w, h) => {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      const f = smooth ? gl.LINEAR : gl.NEAREST;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, half.HALF_FLOAT_OES, null);
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      return ok ? { tex, fb } : null;
    };
    const free = (t) => { if (t) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); } };

    const SCALE = 1 / 2;   // half resolution: sharp enough to see the water move
    let vel = [], col = [], prs = [], milk = [], div = null, fresh = true, milkFresh = true;
    const resize = () => {
      const w = Math.max(2, Math.round(canvas.clientWidth * SCALE));
      const h = Math.max(2, Math.round(canvas.clientHeight * SCALE));
      if (canvas.width === w && canvas.height === h && vel.length) return true;
      canvas.width = w; canvas.height = h;
      [...vel, ...col, ...prs, ...milk, div].forEach(free);
      vel = [target(w, h), target(w, h)];
      col = [target(w, h), target(w, h)];
      prs = [target(w, h), target(w, h)];
      milk = [target(w, h), target(w, h)];
      milkFresh = true;
      div = target(w, h);
      fresh = true;                                   // fill the colour straight from the flow
      return [...vel, ...col, ...prs, ...milk, div].every(Boolean);
    };
    if (!resize()) return fallback();
    window.addEventListener("resize", resize, { passive: true });

    // The cursor, in texture units (y up). Each frame takes the stretch of
    // path since the last frame and pushes the water along it.
    let px = null, py = null, cx = null, cy = null;
    // The intro's flying glass is a finger too: skyFinger(x, y, diameter)
    // in page pixels pushes the liquid with a disc that size; while it holds
    // on the cursor is ignored, and taking hold starts fresh where it is (no
    // jump from the cursor's last spot). skyFinger(null) lets go.
    let fingerR = 1, held = false, disc = 0;
    skyFinger = (x, y, size) => {
      if (x === null) { cx = cy = px = py = null; fingerR = 1; held = false; disc = 0; return; }
      const r = canvas.getBoundingClientRect();
      disc = 1; fingerR = size / 2 / canvas.clientHeight;
      cx = (x - r.left) / r.width;
      cy = 1 - (y - r.top) / r.height;
      if (!held) { px = cx; py = cy; held = true; }
    };
    if (!coarse) {
      window.addEventListener("pointermove", (e) => {
        if (e.pointerType === "touch" || held) return;
        const r = canvas.getBoundingClientRect();
        cx = (e.clientX - r.left) / r.width;
        cy = 1 - (e.clientY - r.top) / r.height;
      }, { passive: true });
    }

    const pass = (p, out, bind) => {
      gl.useProgram(p.pr);
      gl.bindFramebuffer(gl.FRAMEBUFFER, out ? out.fb : null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      bind(p.u);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    const tex = (unit, t, loc) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t.tex); gl.uniform1i(loc, unit); };

    const clear = (t) => { gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); };
    let visible = true, raf = 0, lastPush = -1e9, shown = false;
    const start = performance.now();
    let prevNow = null;
    const frame = (now) => {
      raf = 0;
      if (!visible || document.hidden) return;
      if (!resize()) return fallback();
      const aspect = canvas.width / canvas.height;
      // This frame's push, capped so a flick doesn't tear the water.
      let on = 0, vx = 0, vy = 0, clr = 1;
      if (cx !== null && px !== null) {
        vx = cx - px; vy = cy - py;
        const sp = Math.hypot(vx * aspect, vy), cap = 0.03;
        if (sp > cap) { vx *= cap / sp; vy *= cap / sp; }
        on = sp > 0.0004 ? 1 : 0;
        // the glass clears the liquid only as fast as it moves through it
        // (cubed: crawling off the start it barely touches it)
        if (held) { const f = Math.min(1, sp / (0.1 * fingerR)); clr = f * f * f; }
      }
      pass(velP, vel[1], (u) => {
        tex(0, vel[0], u.uV);
        gl.uniform1f(u.uAspect, aspect);
        gl.uniform1f(u.uOn, on);
        gl.uniform1f(u.uR, fingerR); gl.uniform1f(u.uDisc, disc); gl.uniform1f(u.uClr, clr);
        gl.uniform4f(u.uSeg, px ?? 0, py ?? 0, cx ?? 0, cy ?? 0);
        gl.uniform2f(u.uVel, vx, vy);
        gl.uniform2f(u.uPad, 48 / canvas.clientWidth, 48 / canvas.clientHeight);   // the CSS overhang
      });
      vel.reverse();
      // The pressure step, only while the water is still moving from the
      // cursor (it calms to nothing within a few seconds).
      if (on) lastPush = now;
      if (now - lastPush < 5000) {
        const tw = 1 / canvas.width, th = 1 / canvas.height;
        pass(divP, div, (u) => { tex(0, vel[0], u.uV); gl.uniform2f(u.uTx, tw, th); });
        for (let i = 0; i < 24; i++) {
          pass(jacP, prs[1], (u) => { tex(0, prs[0], u.uP); tex(1, div, u.uD); gl.uniform2f(u.uTx, tw, th); });
          prs.reverse();
        }
        pass(gradP, vel[1], (u) => { tex(0, vel[0], u.uV); tex(1, prs[0], u.uP); gl.uniform2f(u.uTx, tw, th); });
        vel.reverse();
      } else if (lastPush > 0) { prs.forEach(clear); lastPush = -1e9; }
      pass(colP, col[1], (u) => {
        tex(0, col[0], u.uC);
        tex(1, vel[0], u.uV);
        gl.uniform1f(u.uAspect, aspect);
        gl.uniform1f(u.uTime, (now - start) / 1000);
        gl.uniform1f(u.uK, fresh ? 1 : 0.012);       // dissolves back over a few seconds
        gl.uniform1f(u.uOn, on);
        gl.uniform1f(u.uR, fingerR); gl.uniform1f(u.uDisc, disc); gl.uniform1f(u.uClr, clr);
        gl.uniform4f(u.uSeg, px ?? 0, py ?? 0, cx ?? 0, cy ?? 0);
      });
      const ts = (now - start) / 1000, dt = prevNow === null ? 1 / 60 : Math.min(0.05, Math.max(0, (now - prevNow) / 1000));
      prevNow = now;
      if (MILK > 0) pass(milkP, milk[1], (u) => {
        tex(0, milk[0], u.uM);
        tex(1, vel[0], u.uV);
        gl.uniform1f(u.uAspect, aspect);
        gl.uniform1f(u.uTime, ts);
        gl.uniform1f(u.uDt, dt);
        gl.uniform1f(u.uFresh, milkFresh ? 1 : 0);
      });
      if (MILK > 0) { milkFresh = false; milk.reverse(); }
      px = cx; py = cy;
      col.reverse();
      fresh = false;
      pass(showP, null, (u) => { tex(0, col[0], u.uC); tex(1, milk[0], u.uM); });
      if (!shown) { shown = true; requestAnimationFrame(() => layer.classList.add("is-on")); }   // fade in once there's a picture
      raf = requestAnimationFrame(frame);
    };
    const kick = () => { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame); };
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((es) => { visible = es[0].isIntersecting; kick(); }).observe(layer);
    }
    document.addEventListener("visibilitychange", kick);
    kick();
  };
  // Started straight away, even under the logo intro: its shader is set up
  // before the intro starts moving, and it's already flowing behind the
  // white cover, so it's there with everything else when the site fades in.
  // Not on the case studies (Jay, 8 Nov 2026): they open straight onto the
  // work, on plain white.
  if (!/\bcs--/.test(document.body.className)) sky();

  /* Draft mode shows .todo-shot placeholders: local previews (and file://),
     or any URL with ?draft. On jayho.fyi they stay hidden. */
  const local = ["localhost", "127.0.0.1", "::1", ""].includes(window.location.hostname);
  if (local || /[?&]draft\b/.test(window.location.search)) {
    document.documentElement.classList.add("is-draft");
  }

  /* ---------- Reveal on scroll ---------- */
  const revealEls = document.querySelectorAll(".reveal");
  if (revealEls.length && "IntersectionObserver" in window && !prefersReduced) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -8% 0px" }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("is-in"));
  }

  /* ---------- Nav border on scroll ---------- */
  const nav = document.querySelector(".nav");
  if (nav) {
    const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    /* Case studies below 1200px stack the nav and the section tabs (113px on
       a phone). Scrolling down tucks the nav away and the tabs slide up to
       the top; any scroll up brings it back (polish, 10 Nov 2026). */
    if (document.body.classList.contains("has-toc")) {
      const narrow = window.matchMedia("(max-width: 1199px)");
      const root = document.documentElement;
      let lastY = window.scrollY;
      window.addEventListener("scroll", () => {
        const y = window.scrollY, dy = y - lastY;
        if (Math.abs(dy) < 6) return;                     // ignore jitter
        lastY = y;
        const tuck = narrow.matches && dy > 0 && y > 160 && !nav.classList.contains("is-open");
        root.classList.toggle("nav-tucked", tuck);
      }, { passive: true });
      narrow.addEventListener("change", (e) => { if (!e.matches) root.classList.remove("nav-tucked"); });
    }
  }

  /* ---------- Logo animation ----------
     The logo is one posable figure (logo-src/rig.py draws the same figure as
     still frames). makeFigure() builds it inline and animates it live. It
     acts through facial expression, blocked out in key poses (anticipation,
     action, overshoot, settle), with physics doing the secondary motion:
       - the pupils hang on springs inside the eyes, so when the body jolts,
         hops or leans they lag behind and wobble back into place
       - the drink is a small shallow-water simulation (see "Liquid" below)
       - squash and stretch on the cup
     Mood: chill. Relaxed half-lidded eyes with a hint of a smile, a slow
     lazy blink, an easy sway, and an unhurried glance over.
     Frames only run while something is moving, so at rest it costs nothing.
     Where it plays:
       - a short intro the first time the site opens in a visit (or with
         ?intro): a big figure in the middle of a blank screen blasts off
         into the nav logo's corner, does a little hop there, and the site
         fades in around it (about 1.8s)
       - hovering or focusing the nav logo: one of five moves, at random
     The plain logo <img> stays as the fallback; under reduced motion only
     the ?intro link plays anything. */
  const NS = "http://www.w3.org/2000/svg";
  const SCLERA = "M33.3336 460.225C75.3699 494.384 143.013 478.455 184.42 424.648C225.826 370.841 225.315 299.53 183.279 265.372C141.243 231.213 73.5994 247.141 32.1931 300.949C31.9697 301.239 31.7475 301.53 31.5265 301.821C4.89342 336.935 -4.01336 379.326 4.6985 413.963C9.3107 432.3 18.8611 448.465 33.3336 460.225Z";
  const EYE_DX = 155.758;
  const EYE_C = [115.2, 366];                               // centre of an eye
  // Each eye is one group: the white and pupil (blended into each other, as
  // Jay drew them), then that eye's own lids on top, so lids always move and
  // stack with their eye.
  const eyeMarkup = (i) => `<g data-eye="${i}" transform="translate(${EYE_DX * i} 0)"><g data-eyescale>
    <clipPath id="lg-sclera${i}"><path d="${SCLERA}"/></clipPath>
    <g style="mix-blend-mode:hard-light">
      <path d="${SCLERA}" fill="#FFFCFF"/>
      <g clip-path="url(#lg-sclera${i})"><path data-pupil fill="#0B091E"/></g>
    </g>
    <g clip-path="url(#lg-sclera${i})">
      <path data-lid fill="url(#lg-lid)"/><path data-lash stroke="#4C2D0E" stroke-width="7" stroke-linecap="round"/>
    </g></g></g>`;

  const E = {
    inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    out: (t) => 1 - Math.pow(1 - t, 3),
    in: (t) => t * t * t,
    back: (t) => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },   // overshoots, settles
    spring: (t) => 1 - Math.exp(-6.5 * t) * Math.cos(13 * t),                                          // wobbles in
  };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // Build one figure. `id` keeps its gradients and clips apart from any
  // other figure on the page.
  const makeFigure = (id, className) => {
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", className);
    svg.setAttribute("viewBox", "0 0 540 639");
    svg.setAttribute("width", "540");                    // gives it the logo's proportions
    svg.setAttribute("height", "639");
    svg.setAttribute("fill", "none");                    // outlines (the rim) stay hollow
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.innerHTML = `<defs>
      <linearGradient id="lg-glass" x1="34" y1="0" x2="530" y2="0" gradientUnits="userSpaceOnUse"><stop stop-color="#C9DADD"/><stop offset=".22" stop-color="#D8E6E8"/><stop offset=".78" stop-color="#D1DFE1"/><stop offset="1" stop-color="#C4D5D8"/></linearGradient>
      <linearGradient id="lg-latte" x1="152.196" y1="323.496" x2="281.227" y2="546.984" gradientUnits="userSpaceOnUse"><stop stop-color="#DFC9A6"/><stop offset="0.72959" stop-color="#E7C39E"/></linearGradient>
      <linearGradient id="lg-coffee" x1="411.5" y1="291.504" x2="281" y2="618.004" gradientUnits="userSpaceOnUse"><stop stop-color="#E6C39E"/><stop offset="1" stop-color="#4C2D0E"/></linearGradient>
      <linearGradient id="lg-straw" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#FFFFFF"/><stop offset=".55" stop-color="#F7F7F7"/><stop offset="1" stop-color="#E4E6E7"/></linearGradient>
      <linearGradient id="lg-lid" x1="0" y1="245" x2="0" y2="487" gradientUnits="userSpaceOnUse"><stop stop-color="#9A6A3C"/><stop offset="1" stop-color="#7A5230"/></linearGradient>
      <linearGradient id="lg-shine" x1="0" y1="150" x2="0" y2="560" gradientUnits="userSpaceOnUse"><stop stop-color="#FFFFFF" stop-opacity=".7"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>
      <clipPath id="lg-inside"><path d="M50.7266 0H511.727V550.294C511.727 587.581 408.469 617.808 281.228 617.808C153.988 617.808 50.8393 587.581 50.8393 550.294Z"/></clipPath>
      <clipPath id="lg-below"><path d="M0 193H540V953H0Z"/></clipPath>
      <clipPath id="lg-above"><path d="M-60 -60H600V193H-60Z"/></clipPath>
      <mask id="lg-rimfront" maskUnits="userSpaceOnUse" x="0" y="0" width="540" height="639"><rect x="0" y="116.963" width="540" height="40" fill="#fff"/></mask>
    </defs>
    <g data-ground><ellipse data-cast cx="332" cy="590" rx="262" ry="50" fill="#1B3A5C" fill-opacity=".14"/><ellipse data-contact cx="291" cy="592" rx="252" ry="58" fill="#1B3A5C" fill-opacity=".34"/></g>
    <g data-body>
      <path d="M529.466 576.294C529.466 610.586 418.575 638.385 281.784 638.385C144.993 638.385 34.1016 610.586 34.1016 576.294V133.448C34.1016 122.112 44.0917 112.922 56.4153 112.922H507.152C519.476 112.922 529.466 122.112 529.466 133.448Z" fill="url(#lg-glass)"/>
      <ellipse cx="281.782" cy="116.963" rx="237.641" ry="17.447" fill="#D0DFE1"/>
      <ellipse cx="281.782" cy="116.963" rx="232" ry="14.6" stroke="#DAF9FC" stroke-width="5.6"/>
      <!-- the glass's thick base, the floor inside, and the last drop: drawn under
           the drink, so they only show as it's drunk (flat shapes, no outlines) -->
      <path d="M34.1 576.3C34.1 610.6 145 638.4 281.8 638.4C418.6 638.4 529.5 610.6 529.5 576.3V556H34.1Z" fill="#BCCFD3"/>
      <g clip-path="url(#lg-inside)">
      <ellipse cx="281.5" cy="566" rx="228" ry="47" fill="#BFD2D6"/>
      <ellipse cx="281.5" cy="561" rx="212" ry="37" fill="#CADBDE"/>
      <g data-drop opacity="0"><ellipse cx="300" cy="572" rx="64" ry="12" fill="#D9BE98"/>
      <ellipse cx="304" cy="574" rx="44" ry="7" fill="#C49E74"/>
      <ellipse cx="284" cy="569" rx="16" ry="2.6" fill="#FFFFFF" fill-opacity=".8"/></g>
      </g>
      <g clip-path="url(#lg-inside)"><g data-drink clip-path="url(#lg-below)">
        <rect x="40" y="-60" width="480" height="709" fill="url(#lg-latte)"/>
        <path data-wave d="M166.032 408.512C188.626 408.512 191.991 434.804 223.631 434.804C255.271 434.804 273.949 419.516 281.226 408.512C294.749 377.025 307.185 434.804 338.825 434.804C370.465 434.804 369.923 405.824 396.421 408.512C406.157 411.018 431.035 461.063 454.02 434.804C477.005 408.546 495.998 416.122 506.208 411.315L511.617 408.512H560V680H0V408.512H50.8393C59.2069 419.919 87.9358 442.818 108.437 434.804C128.937 426.791 112.493 408.512 166.032 408.512Z" fill="url(#lg-coffee)"/>
      </g>
      <path data-surface fill="#EBD6B4"/></g>
      <g clip-path="url(#lg-above)"><g data-straw>
        <path d="M538.279 18.9721L345.4 560L287.4 560L485.867 3.1615Z" fill="url(#lg-straw)"/>
        <ellipse cx="3.35588" cy="27.3723" rx="3.35588" ry="27.3723" transform="matrix(0.335799 -0.941934 0.957387 0.288808 484.75 6.32812)" fill="#9F9999"/>
        <ellipse cx="2.91432" cy="23.8686" rx="2.91432" ry="23.8686" transform="matrix(0.335799 -0.941934 0.957387 0.288808 488.227 7.00781)" fill="#767676"/>
      </g></g>
      <rect x="40" y="150" width="7" height="400" rx="3.5" fill="url(#lg-shine)"/>
      <ellipse cx="281.782" cy="116.963" rx="232" ry="14.6" stroke="#DAF9FC" stroke-width="5.6" mask="url(#lg-rimfront)"/>
      <g data-eyes>${eyeMarkup(0)}${eyeMarkup(1)}</g>
    </g>`.replace(/\blg-/g, `${id}-`);
    const $ = (sel) => svg.querySelector(sel);
    const $$ = (sel) => [...svg.querySelectorAll(sel)];
    const el = {
      body: $("[data-body]"), ground: $("[data-ground]"), cast: $("[data-cast]"), contact: $("[data-contact]"), straws: $$("[data-straw]"), wave: $("[data-wave]"), surface: $("[data-surface]"), drop: $("[data-drop]"), drink: $("[data-drink]"),
      eyes: $("[data-eyes]"), eye: [$('[data-eye="0"]'), $('[data-eye="1"]')],
      scale: $$("[data-eyescale]"), pupils: $$("[data-pupil]"),
      lids: $$("[data-lid]"), lashes: $$("[data-lash]"),
      below: $(`#${id}-below path`), above: $(`#${id}-above path`),
    };

    // The pose, as numbers. Everything on screen is drawn from these.
    const P = {
      look: 0,      // 0 pupils left (as drawn), 1 pupils right
      lid: 0,       // top lids: 0 open, 1 closed
      wide: 0,      // eyes pop bigger (surprise)
      perk: 0,      // pupils lift (alert, interested)
      tilt: 0,      // cup lean in degrees (+ leans right)
      lift: 0,      // cup hop (negative is up)
      squash: 0,    // + squashes (shorter, wider), - stretches
      straw: 0,     // straw swing in degrees, pivoting where it meets the drink (+ leans right)
      sip: 0,       // straw slides along itself (+ pokes up out of the drink)
      drain: 0,     // how much has been drunk: 0 full, 1 empty
    };
    // Physics: the pupils sit on springs and get flung by the body's
    // movement; the drink sloshes the same way.
    const pupil = { x: 0, y: 0, vx: 0, vy: 0 };
    const sway = { a: 0, va: 0, s: 0, vs: 0 };            // the straw lags and wobbles loose in the cup

    // Liquid: the drink is simulated with the 1D shallow-water equations on
    // a staggered grid (the "virtual pipes" heightfield used for real-time
    // water): N columns across the cup, eta = how far each column's surface
    // sits above the mean level, u = flow between neighbouring columns.
    //   du/dt   = -g_eff * d(eta)/dx + f_x - damping   (pressure + inertia)
    //   deta/dt = -H * du/dx                           (mass is conserved)
    // It runs in the cup's own frame, so leaning the cup shows up as a
    // sideways pull (g sin(tilt)), swinging it as the inertia of the water
    // (angular acceleration x height above the pivot), and hopping as a
    // change in effective gravity (lighter going up, heavier landing).
    // H is capped at 1/k for the cup's first mode, so waves move at the
    // real dispersion speed sqrt(g tanh(kH)/k): a full glass sloshes
    // faster than a nearly empty one. Walls reflect (no flow through them).
    const LQ = { N: 24, x0: 50.7, W: 461, G: 26000 };
    LQ.dx = LQ.W / LQ.N;
    const eta = new Float64Array(LQ.N), flow = new Float64Array(LQ.N + 1);
    let prevDrain = 0, sAl = 0, sAt = 0;                 // smoothed accelerations the water feels
    const etaAt = (x) => {                                // surface height at x, between column centres
      const f = clamp((x - LQ.x0) / LQ.dx - 0.5, 0, LQ.N - 1), i = Math.floor(f), t = f - i;
      return i >= LQ.N - 1 ? eta[LQ.N - 1] : eta[i] * (1 - t) + eta[i + 1] * t;
    };
    let prevLift = 0, prevTilt = 0, velLift = 0, velTilt = 0;

    let leftInFront = false;
    const render = () => {
      const sq = P.squash;
      el.body.setAttribute("transform",
        `translate(281 630) translate(0 ${P.lift}) rotate(${P.tilt}) scale(${1 + sq * 0.6} ${1 - sq}) translate(-281 -630)`);
      // Ground shadows, the way a resting object casts them (light from the
      // top left), in two flat tones and no gap, so it sits on the ground
      // rather than hovering:
      //  - contact: dark and tight, the glass's own base footprint, a hair
      //    larger, right where it touches; it's what grounds it
      //  - cast: lighter and broader, pushed back and to the right, away from
      //    the light
      // Both stay on the ground. As the glass hops up the contact shadow
      // goes first (it's no longer touching) and the cast shadow shrinks and
      // fades more slowly; squashing spreads them, leaning slides the
      // contact towards the lean. Hidden while the glass is in flight.
      {
        const up = Math.max(0, -P.lift), wide = 1 + sq * 0.6;
        const kc = Math.max(0, 1 - up / 40), ks = 1 - Math.min(0.6, up / 200);
        el.contact.setAttribute("cx", (291 + P.tilt * 4).toFixed(1));
        el.contact.setAttribute("rx", (252 * wide * (0.85 + 0.15 * kc)).toFixed(1));
        el.contact.setAttribute("fill-opacity", (0.34 * kc).toFixed(3));
        el.cast.setAttribute("cx", (332 + P.tilt * 2 + up * 0.15).toFixed(1));
        el.cast.setAttribute("rx", (262 * wide * ks).toFixed(1));
        el.cast.setAttribute("ry", (50 * ks).toFixed(1));
        el.cast.setAttribute("fill-opacity", (0.14 * ks).toFixed(3));
      }
      // the dark layer below follows the surface's overall slope (a
      // least-squares line through the columns), more gently
      let sxy = 0, sxx = 0;
      for (let i = 0; i < LQ.N; i++) { const xc = i - (LQ.N - 1) / 2; sxy += xc * eta[i]; sxx += xc * xc; }
      const slope = sxy / sxx / LQ.dx;
      const tip = Math.atan(-slope) * 57.3 * 0.6;
      el.wave.setAttribute("transform", `rotate(${tip} 281 430)`);
      // drink level: the surface sits at L (193 full, 622 is past the bottom),
      // and turns coffee-coloured once it drops into the dark layer
      const L = 193 + 429 * P.drain;
      // the body of the drink starts at the simulated surface line
      let bd = `M0 ${(L - etaAt(0)).toFixed(1)}`;
      for (let x = 40; x <= 520; x += 20) bd += `L${x} ${(L - etaAt(x)).toFixed(1)}`;
      el.below.setAttribute("d", `${bd}L540 ${(L - etaAt(540)).toFixed(1)}V953H0Z`);
      // the straw is cut along the same surface line, so wherever the
      // surface tilts or waves, the straw goes under it exactly there
      let ad = `M-60 -60H600V${(L - etaAt(540)).toFixed(1)}`;
      for (let x = 520; x >= 40; x -= 20) ad += `L${x} ${(L - etaAt(x)).toFixed(1)}`;
      el.above.setAttribute("d", `${ad}L-60 ${(L - etaAt(0)).toFixed(1)}Z`);
      // the surface: the ellipse of the glass's opening at that height,
      // lifted and dropped along its width by the simulated waves
      // The last of it: once the level reaches the floor (556) the drink's
      // body thins to a film (fading out by 566) and the surface itself
      // becomes the last drop, in one motion: it narrows from the glass's
      // width to the drop's, drifts to where the drop sits (300, 572),
      // calms its waves and lightens to the drop's colour. When it is
      // exactly the drop's size the drawn drop (with its glint) takes over.
      const fin = clamp((L - 556) / 66, 0, 1), e = fin * fin * (3 - 2 * fin);
      const pcx = 281.2 + (300 - 281.2) * e, pcy = L < 556 ? L : 556 + (572 - 556) * e;
      const prx = 230.5 + (64 - 230.5) * e, pry = 17 + (12 - 17) * e;
      let d = "";
      for (let i = 0; i <= 48; i++) {
        const th = (i / 48) * Math.PI * 2, x = pcx + prx * Math.cos(th);
        const y = pcy - etaAt(x) * (1 - e) + pry * Math.sin(th);
        d += `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
      }
      el.surface.setAttribute("d", d + "Z");
      const c = clamp((L - 395) / 40, 0, 1), mix = (a, b) => Math.round(a + (b - a) * c);
      const toDrop = (v, w) => Math.round(v + (w - v) * e);
      el.surface.setAttribute("fill", `rgb(${toDrop(mix(235, 107), 217)} ${toDrop(mix(214, 72), 190)} ${toDrop(mix(180, 38), 152)})`);
      el.drink.style.opacity = clamp((566 - L) / 20, 0, 1);
      const swap = clamp((fin - 0.9) / 0.1, 0, 1);
      el.surface.style.opacity = 1 - swap;
      el.drop.setAttribute("opacity", swap.toFixed(3));
      // straw: swings about where it enters the drink (447, 193) and slides
      // along its own length (up the straw is 0.336, -0.942)
      const sl = P.sip + sway.s;
      // it leans on the rim: swinging right, its edge meets the inside of the
      // rim at about 4.4 degrees, so it eases to a stop there instead of
      // passing through the glass (a soft stop, no hard corner in the motion)
      const a0 = P.straw + sway.a, A = 4.4;
      const ang = a0 > A - 1 ? A - Math.exp(-(a0 - (A - 1))) : a0;
      const stf = `translate(${0.336 * sl} ${-0.942 * sl}) rotate(${ang} 447 193)`;
      el.straws.forEach((g) => g.setAttribute("transform", stf));   // above and under the drink move as one
      // eyes: size, then pupils (pose + spring), then lids
      const s = 1 + 0.14 * P.wide;
      el.scale.forEach((g) => g.setAttribute("transform", `translate(${EYE_C[0]} ${EYE_C[1]}) scale(${s}) translate(${-EYE_C[0]} ${-EYE_C[1]})`));
      const k = clamp(P.look, 0, 1);
      const px = 96 * P.look + pupil.x, py = 16 * k - 34 * P.perk + pupil.y;
      // At rest the pupil's left side is tucked past the edge of the white;
      // as it slides right that edge tightens so it doesn't look wider.
      const pd = `M${-19 + 50.4 * k} 301.83H129.375L103.977 396.208C101.156 406.689 91.6527 413.972 80.7989 413.971H${-44.6 + 27.4 * k}Z`;
      el.pupils.forEach((p) => { p.setAttribute("transform", `translate(${px} ${py})`); p.setAttribute("d", pd); });
      const front = P.look > 0.5;                          // looking right, the left eye comes forward
      if (front !== leftInFront) { leftInFront = front; el.eyes.appendChild(el.eye[front ? 0 : 1]); }
      const top = P.lid, y = 245 + 250 * top;
      const lid = top > 0.005 ? `M-10 235H235V${y - 10}Q112 ${y + 14} -10 ${y - 10}Z` : "";
      const lash = top > 0.005 && top < 0.97 ? `M-10 ${y - 10}Q112 ${y + 14} 235 ${y - 10}` : "";
      for (let i = 0; i < 2; i++) { el.lids[i].setAttribute("d", lid); el.lashes[i].setAttribute("d", lash); }
    };

    const tweens = new Set();
    let raf = 0, last = 0;
    const tick = () => {
      const now = performance.now();                     // one clock for tweens and frames
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000)); last = now;
      for (const tw of [...tweens]) {
        const t = clamp((now - tw.t0) / tw.ms, 0, 1), e = tw.ease(t);
        for (const key in tw.props) P[key] = tw.from[key] + (tw.props[key] - tw.from[key]) * e;
        if (t >= 1) { Object.assign(P, tw.props); tweens.delete(tw); tw.done(); }   // land exactly on the pose
      }
      // body acceleration flings the pupils (they lag, then spring back)
      const vl = (P.lift - prevLift) / dt, vt = (P.tilt - prevTilt) / dt;
      const al = (vl - velLift) / dt, at = (vt - velTilt) / dt;
      prevLift = P.lift; prevTilt = P.tilt; velLift = vl; velTilt = vt;
      pupil.vy += (-320 * pupil.y - 16 * pupil.vy - al * 0.55) * dt;
      pupil.vx += (-320 * pupil.x - 16 * pupil.vx - at * 6) * dt;
      pupil.y = clamp(pupil.y + pupil.vy * dt, -28, 28);
      pupil.x = clamp(pupil.x + pupil.vx * dt, -24, 24);
      // straw: loose in the cup, it swings against the lean and jumps a
      // little against hops, then springs back to where it was
      sway.va += (-110 * sway.a - 7 * sway.va - at * 0.9) * dt;
      sway.vs += (-260 * sway.s - 12 * sway.vs + al * 0.12) * dt;
      sway.a = clamp(sway.a + sway.va * dt, -14, 14);
      sway.s = clamp(sway.s + sway.vs * dt, -30, 30);
      // liquid: forces in the cup's frame, then the shallow-water steps
      {
        const { N, dx, G } = LQ;
        const L = 193 + 429 * P.drain, depth = Math.max(6, 618 - L);
        const H = Math.min(depth, LQ.W / Math.PI);       // deep water: waves feel about 1/k of depth
        // keyframed motion can turn on a dime, which no real hand does: the
        // water feels the accelerations smoothed over ~60ms, and capped
        const a60 = 1 - Math.exp(-dt / 0.06);
        sAl += (clamp(al, -60000, 60000) - sAl) * a60;
        sAt += (clamp(at, -3000, 3000) - sAt) * a60;
        const th = P.tilt / 57.3, alpha = sAt / 57.3;
        const gEff = clamp(G * Math.cos(th) - sAl, G * 0.3, G * 2.5);   // hops change the felt gravity
        // lean + the water's inertia when the cup swings (at the middle of the water's depth)
        const fx = clamp(G * Math.sin(th) - alpha * (630 - (L + 618) / 2), -G * 0.3, G * 0.3);
        // drinking pulls water from the straw's end; a refill pours in left of centre
        const vd = (P.drain - prevDrain) / dt; prevDrain = P.drain;
        const q = 429 * vd, src = q > 0 ? 14 : 8;
        const steps = Math.ceil(dt / (1 / 240)), h = dt / steps;   // small steps keep it stable (CFL)
        for (let n = 0; n < steps; n++) {
          for (let i = 1; i < N; i++) {
            flow[i] += h * (-gEff * (eta[i] - eta[i - 1]) / dx + fx);
          }
          for (let i = 1; i < N; i++) {                   // viscosity: smooth the flow, and damp it
            flow[i] += h * 3 * (flow[i + 1] - 2 * flow[i] + flow[i - 1]) * (i < N - 1 && i > 1 ? 1 : 0.5);
            flow[i] *= 1 - 2.2 * h;
          }
          flow[0] = flow[N] = 0;                          // walls
          for (let i = 0; i < N; i++) eta[i] -= h * H * (flow[i + 1] - flow[i]) / dx;
          if (q) {                                        // the level change itself, minus where it's drawn
            eta[src] -= h * q * 0.5;
            for (let i = 0; i < N; i++) eta[i] += h * q * 0.5 / N;
          }
          for (let i = 0; i < N; i++) eta[i] = clamp(eta[i], -depth * 0.9, 60);
        }
      }
      render();
      const still = (v) => Math.abs(v) < 0.02;
      let wet = 0;
      for (let i = 0; i < LQ.N; i++) wet = Math.max(wet, Math.abs(eta[i]), Math.abs(flow[i]) * 0.05);
      const moving = tweens.size || wet > 0.04 ||
        !still(pupil.x) || !still(pupil.y) || !still(pupil.vx) || !still(pupil.vy) ||
        !still(sway.a) || !still(sway.va) || !still(sway.s) || !still(sway.vs);
      if (!moving) {                                       // at rest: settle exactly on the original pose
        sway.a = sway.va = sway.s = sway.vs = 0;
        eta.fill(0); flow.fill(0); pupil.x = pupil.y = pupil.vx = pupil.vy = 0;
        render();
      }
      raf = moving ? requestAnimationFrame(tick) : 0;
    };
    const wake = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } };
    // a shove to the water: sets it flowing sideways (v < 0 to the left)
    const kick = (v) => { for (let i = 1; i < LQ.N; i++) flow[i] += v * 90; wake(); };
    // Move to a key pose: which numbers, how long, what easing. A newer move
    // takes over any part an older one was still driving.
    // halt() stops any move still playing from issuing new poses (its later
    // steps become no-ops); only go() can pose the figure after that.
    let halted = false;
    const halt = () => { halted = true; };
    const key = (props, ms, ease = E.inOut, force) => new Promise((done) => {
      if (halted && !force) return done();
      for (const tw of tweens) {
        for (const k in props) delete tw.props[k];
        if (!Object.keys(tw.props).length) { tweens.delete(tw); tw.done(); }
      }
      const from = {};
      for (const k in props) from[k] = P[k];
      tweens.add({ from, props, ms, ease, t0: performance.now(), done });
      wake();
    });
    const set = (props) => { Object.assign(P, props); render(); };

    // The moves, built around a key() so that run() can hand them one that
    // goes quiet when stop() is called: a stopped move's remaining steps do
    // nothing, so something else (a sip) can take over cleanly.
    const moveset = (key) => {
    // Blink: lids drop fast, hold a frame, lift slower.
    const blink = async () => {
      key({ squash: 0.015 }, 60, E.out);
      await key({ lid: 1 }, 60, E.in);
      await wait(30);
      key({ squash: 0 }, 300, E.spring);
      await key({ lid: 0 }, 130, E.out);
    };
    // Curious: an easy glance over and back.
    const curious = async () => {
      await key({ look: -0.08 }, 120, E.inOut);                // anticipation
      key({ tilt: 1.6, straw: 5 }, 420, E.inOut);             // the straw tips the way it looks
      await key({ look: 0.9 }, 420, E.inOut);
      await wait(450);
      key({ tilt: 0, straw: 0 }, 460, E.inOut);
      await key({ look: 0 }, 460, E.inOut);
    };
    // Chill: relaxed half-lidded eyes with a hint of a smile, a slow lazy
    // blink, and an easy sway like he's nodding along to something.
    const chill = async () => {
      key({ lid: 0.32, perk: 0, wide: 0, look: 0 }, 450, E.inOut);
      for (const [tilt, ms] of [[2.4, 520], [-2.2, 560], [0, 520]]) {
        kick(tilt > 0 ? -0.4 : 0.4);
        key({ lift: -5, squash: -0.012 }, ms / 2, E.inOut).then(() => key({ lift: 0, squash: 0.006 }, ms / 2, E.inOut));
        if (tilt < 0) {                                        // a slow, lazy blink mid-sway
          key({ lid: 1 }, 160, E.inOut).then(() => wait(90)).then(() => key({ lid: 0.32 }, 300, E.inOut));
        }
        key({ straw: tilt * 2.2 }, ms * 1.15, E.inOut);         // the straw sways a beat behind
        await key({ tilt }, ms, E.inOut);
      }
      key({ squash: 0 }, 300, E.inOut);
      await key({ straw: 0 }, 360, E.inOut);
    };
    // Back to the resting face.
    const relax = () => key({ lid: 0, perk: 0 }, 420, E.inOut);
    // A little hop on the spot: crouch, spring up, land with a squash.
    const hop = async () => {
      await key({ squash: 0.08, lift: 6 }, 130, E.inOut);           // crouch
      kick(-1.6);
      await key({ squash: -0.07, lift: -120, wide: 0.3 }, 200, E.out);   // up
      await key({ squash: 0, lift: 0 }, 180, E.in);                 // down
      kick(1.2);
      key({ squash: 0.07 }, 70, E.out).then(() => key({ squash: 0, wide: 0 }, 320, E.spring));   // land
    };

    // Bounce: two small, easy hops on the spot, the drink sloshing along.
    const bounce = async () => {
      for (const [h, ms] of [[-48, 170], [-26, 140]]) {
        await key({ squash: 0.06, lift: 4 }, 110, E.inOut);           // crouch
        kick(-1.1);
        await key({ squash: -0.05, lift: h }, ms, E.out);             // up
        key({ sip: 14 }, ms, E.out);                                  // the straw floats up in the drink
        await key({ squash: 0, lift: 0 }, ms, E.in);                  // down
        key({ sip: 0 }, 160, E.in);
        kick(0.9);
      }
      key({ squash: 0.05 }, 70, E.out).then(() => key({ squash: 0, sip: 0 }, 300, E.spring));
    };
    // Shimmy: a quick little side-to-side wiggle, eyes half-closed, enjoying it.
    const shimmy = async () => {
      key({ lid: 0.3 }, 200, E.inOut);
      for (const tilt of [4, -4, 3.5, -3, 0]) {
        kick(tilt > 0 ? -0.7 : 0.7);
        key({ straw: -tilt * 1.8 }, 150, E.inOut);              // the straw wags the other way
        await key({ tilt, lift: tilt ? -3 : 0 }, 150, E.inOut);
      }
      key({ straw: 0 }, 300, E.inOut);
      await relax();
    };
    // Doze: the lids slowly droop and the cup sags into a nod, then an easy
    // blink and it's back.
    const doze = async () => {
      key({ squash: 0.025, lift: 3, tilt: 1.8, straw: 7, sip: -8 }, 900, E.inOut);   // the straw slumps too
      await key({ lid: 0.78, perk: -0.3 }, 900, E.inOut);
      await wait(380);
      key({ squash: 0, lift: 0, tilt: 0 }, 380, E.out);
      key({ straw: 0, sip: 0 }, 520, E.spring);
      await key({ lid: 0, perk: 0 }, 260, E.out);
      await blink();
    };
      const chillOut = async () => { await chill(); await relax(); };
      return { blink, curious, chill, relax, hop, bounce, shimmy, doze, chillOut };
    };
    const base = moveset(key);
    let epoch = 0;
    const stop = () => { epoch++; };
    const run = (name) => {
      const me = ++epoch;
      return moveset((p, ms, ease) => (me === epoch ? key(p, ms, ease) : Promise.resolve()))[name]();
    };

    render();
    const go = (props, ms, ease) => key(props, ms, ease, true);
    // the ground shadow off while the glass flies (it has no ground), back on after
    const ground = (on, instant) => { el.ground.style.transition = instant ? "none" : "opacity .25s ease"; el.ground.style.opacity = on ? 1 : 0; };
    return { svg, ...base, key, go, halt, kick, run, stop, ground };
  };

  // His name: hovering or focusing the nav logo shows a little handwritten
  // "Hojicha" beside him, in the same pen as the intro's "click to enter".
  // Decorative only (the link keeps its own label for screen readers).
  const brandLink = document.querySelector(".nav__brand");
  if (brandLink) {
    const tag = document.createElement("span");
    tag.className = "nav__name";
    tag.setAttribute("aria-hidden", "true");
    tag.textContent = "Hojicha";
    brandLink.append(tag);
  }

  // Hover: the nav logo is the live figure, at rest until it's hovered.
  if (!prefersReduced) {
    const logoImg = document.querySelector("img.nav__logo");
    if (logoImg) {
      const fig = makeFigure("lg", "nav__logo logo-live");
      logoImg.replaceWith(fig.svg);
      const brand = fig.svg.closest(".nav__brand");
      // Five moves, picked at random, never the same one twice in a row.
      const moves = [
        async () => { await fig.chill(); await fig.relax(); },
        fig.curious, fig.bounce, fig.shimmy, fig.doze,
      ];
      let busy = false, prev = -1;
      const play = async () => {
        if (busy) return;
        busy = true;
        let i;
        do i = Math.floor(Math.random() * moves.length); while (i === prev);
        prev = i;
        await moves[i]();
        busy = false;
      };
      if (brand && !coarse) {
        brand.addEventListener("mouseenter", play);
        brand.addEventListener("focus", play);
      }
    }
  }

  // Intro: the first page of a visit, or any page opened with ?intro. The
  // <head> of each page adds .has-intro (which hides the page) only when the
  // intro should play, so this follows that decision, reduced motion included.
  // A big figure in the middle of a blank screen waits, blinking now and
  // then; the figure is the button, and hovering it draws on a hand-drawn
  // hand pointer that keeps nudging and tapping it. It moves the way Apple's
  // interfaces do (WWDC "Designing Fluid Interfaces" and "Animate with
  // springs"): everything runs on real springs set by duration and bounce,
  // with no keyframed easing; it responds to the press at once (it shrinks
  // under your finger and springs back); one continuous motion carries it
  // from where it is to where it ends up (a matched move into the nav logo,
  // no cartoon jump); and the page follows it in with Apple's staggered
  // fade-in: nav first, then the blocks on screen in reading order. No props.
  const root = document.documentElement;
  if (root.classList.contains("has-intro")) {
    try { sessionStorage.setItem("introSeen", "1"); } catch (e) {}
    const intro = document.createElement("div");
    intro.className = "intro";
    const fig = makeFigure("li", "intro__logo logo-live");
    fig.svg.setAttribute("aria-hidden", "true");
    // The figure itself is the button: it only jumps once you click it.
    const enter = document.createElement("button");
    enter.type = "button";
    enter.className = "intro__hit";
    enter.setAttribute("aria-label", "Enter the site");
    enter.append(fig.svg);
    // A hand pointer beside the cup (no words): it comes in after a moment
    // and keeps nudging towards the cup, tapping it, with a little ripple
    // where the fingertip lands, so it's clear the cup is the thing to
    // press. It
    // steps aside while the cup is hovered and goes once it's pressed.
    const hand = document.createElement("span");
    hand.className = "intro__hand";
    hand.setAttribute("aria-hidden", "true");
    // Flat 2D and white: no outlines and no gradients. Depth comes from
    // flat shapes only: a cast shadow (the same shape, offset), a pale grey
    // shade underneath and down the fingers' right sides, and slim creases.
    hand.innerHTML = `<span class="intro__ripple"></span><svg viewBox="0 0 48 48">
      <defs><clipPath id="ih-clip"><path d="M18 30V8a4 4 0 0 1 8 0V20a3.5 3.5 0 0 1 7 0v2a3.5 3.5 0 0 1 7 0v2a3 3 0 0 1 6 0V32c0 7-4 13-12 13h-4c-5 0-8-3-10-7l-7-9a2.8 2.8 0 0 1 4.5-3.3L18 30Z"/></clipPath></defs>
      <path d="M18 30V8a4 4 0 0 1 8 0V20a3.5 3.5 0 0 1 7 0v2a3.5 3.5 0 0 1 7 0v2a3 3 0 0 1 6 0V32c0 7-4 13-12 13h-4c-5 0-8-3-10-7l-7-9a2.8 2.8 0 0 1 4.5-3.3L18 30Z" fill="#1B3A5C" fill-opacity=".38" transform="translate(2 2.8)"/>
      <path d="M18 30V8a4 4 0 0 1 8 0V20a3.5 3.5 0 0 1 7 0v2a3.5 3.5 0 0 1 7 0v2a3 3 0 0 1 6 0V32c0 7-4 13-12 13h-4c-5 0-8-3-10-7l-7-9a2.8 2.8 0 0 1 4.5-3.3L18 30Z" fill="#FFFFFF"/>
      <g clip-path="url(#ih-clip)">
        <ellipse cx="33" cy="47" rx="17" ry="9.5" fill="#DDE4EC"/>
        <rect x="23.6" y="3" width="3" height="26" fill="#DDE4EC"/>
        <rect x="30.4" y="18" width="3" height="10" fill="#DDE4EC"/>
        <rect x="37.4" y="20" width="3" height="10" fill="#DDE4EC"/>
        <rect x="43.4" y="22" width="3" height="12" fill="#DDE4EC"/>
        <rect x="25.3" y="20.5" width="1.5" height="7" rx=".75" fill="#BCC7D3"/>
        <rect x="32.3" y="22.5" width="1.5" height="6" rx=".75" fill="#BCC7D3"/>
        <rect x="39.3" y="24.5" width="1.5" height="5" rx=".75" fill="#BCC7D3"/>
      </g></svg>`;
    enter.append(hand);
    // Cartoon timing: it pops in with an overshoot, winds up (pulls back,
    // stretching a touch), jabs at the cup (squashing against it, with a
    // splash at the fingertip), gives a second smaller jab, holds a beat,
    // then pops away. If the cup still hasn't been pressed it comes back a
    // few seconds later; it never plays while the cup is hovered.
    {
      const hsvg = hand.querySelector("svg"), ripple = hand.querySelector(".intro__ripple");
      const T = (y, sy, sx = sy) => ({ transform: `rotate(-35deg) translateY(${y}px) scale(${sx}, ${sy})` });
      const CYCLE = 2200;
      const point = () => {
        [hsvg, ripple].forEach((el) => el.getAnimations().forEach((x) => x.cancel()));   // last time's, held at its end
        const go = hsvg.animate([
          { ...T(18, 0), offset: 0 },
          { ...T(4, 1.15), offset: 0.12, easing: "ease-in-out" },      // pops in, overshooting
          { ...T(8, 0.95), offset: 0.2 },
          { ...T(8, 1), offset: 0.27, easing: "ease-in" },
          { ...T(15, 1.05, 0.95), offset: 0.38, easing: "ease-in" },   // winds up
          { ...T(-3, 0.92, 1.08), offset: 0.44, easing: "ease-out" },  // jab: squashes on the cup
          { ...T(6, 1), offset: 0.53, easing: "ease-in-out" },
          { ...T(11, 1), offset: 0.59, easing: "ease-in" },
          { ...T(-1, 0.96, 1.04), offset: 0.64, easing: "ease-out" },  // a smaller second jab
          { ...T(6, 1), offset: 0.72 },
          { ...T(6, 1), offset: 0.84, easing: "ease-in-out" },        // holds a beat
          { ...T(3, 1.12), offset: 0.9, easing: "ease-in" },
          { ...T(10, 0), offset: 1 },                                   // pops away
        ], { duration: CYCLE, fill: "both" });
        for (const [at, k] of [[0.44, 1], [0.64, 0.7]]) {
          ripple.animate([
            { opacity: 0, transform: "scale(.3)" },
            { opacity: 0.6 * k, transform: `scale(${0.6 * k})`, offset: 0.15 },
            { opacity: 0, transform: `scale(${1.5 * k})` },
          ], { duration: 520, delay: CYCLE * at, easing: "ease-out", fill: "both" });
        }
        return go.finished.catch(() => {});
      };
      (async () => {
        await wait(1000);
        hand.classList.add("is-shown");
        while (waiting && !sipping) {
          if (!hovered) await point();
          await wait(1400);                               // a short pause, then it tries again
        }
      })();
    }
    if (coarse) intro.classList.add("intro--touch");
    intro.append(enter);
    let waiting = true;
    root.classList.add("intro-wait");                   // keeps the page hidden past the <head> failsafe
    document.body.appendChild(intro);
    const home = document.querySelector(".nav__logo");    // where it ends up
    if (home) home.style.visibility = "hidden";

    // Apple-style springs (SwiftUI's spring(duration:bounce:)): a spring is
    // set by its perceived duration and how much it bounces (0 = settles
    // with no overshoot). This steps the real spring equation and returns
    // its progress every frame (60 a second), used as WAAPI keyframes and as
    // CSS linear() easing, so nothing uses a hand-drawn curve.
    const spring = (dur, bounce = 0) => {
      const w = (2 * Math.PI) / dur, z = 1 - bounce, h = 1 / 600, pts = [0];
      let x = 0, v = 0, t = 0;
      while (t < dur * 3) {
        for (let i = 0; i < 10; i++) { v += (w * w * (1 - x) - 2 * z * w * v) * h; x += v * h; t += h; }
        pts.push(x);
        if (Math.abs(1 - x) < 0.002 && Math.abs(v) < 0.03) break;
      }
      pts[pts.length - 1] = 1;
      return { pts, ms: Math.round(t * 1000), css: `linear(${pts.map((q) => q.toFixed(4)).join(", ")})` };
    };
    // Press feedback: the figure shrinks a little the moment it's pressed
    // and springs back with a touch of bounce when let go; it lifts slightly
    // under the pointer (styles.css sets the scales, this sets the spring).
    const pressSpring = spring(0.45, 0.3);
    enter.style.transition = "transform .4s cubic-bezier(.2, .8, .2, 1)";   // fallback where linear() is missing
    enter.style.transition = `transform ${pressSpring.ms}ms ${pressSpring.css}`;

    // The handoff to the page: the glass flies home over a clean stage
    // (the page is still hidden, so it never crosses the text); as it
    // settles, the page fades in using Apple's own staggered fade-in, with
    // the values read from apple.com's StaggeredFadeIn (7 Nov 2026): each
    // block rises 30px over 0.7s and fades in over 0.9s, both easeInOutQuad,
    // each starting 0.15s after the one before, in reading order. The rest
    // of the nav comes first, fading only; anything else on screen with no
    // block of its own fades with the first block. Nothing scales or blurs.
    const cascade = () => {
      const vh = innerHeight;
      const inView = (el) => { const rc = el.getBoundingClientRect(); return rc.height > 0 && rc.bottom > 0 && rc.top < vh; };
      const items = [...document.querySelectorAll("main .reveal")]
        .filter((el) => inView(el) && !el.parentElement.closest(".reveal"));
      const rest = [...document.body.children].filter((el) =>
        !el.matches(".intro, .cursor, .sky, script, .nav") && inView(el) && !items.some((it) => el.contains(it)));
      const navBits = nav ? [...nav.children].filter((el) => !(home && el.contains(home))) : [];
      const QUAD = "cubic-bezier(.455, .03, .515, .955)";   // easeInOutQuad
      const STEP = 150, FADE = 900, RISE = 700, Y = 30;
      root.classList.remove("has-intro", "intro-wait");   // same frame as the animations below, so nothing flashes
      const anims = [];
      const fadeUp = (el, i, y) => {
        const delay = i * STEP;
        anims.push(el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE, delay, easing: QUAD, fill: "backwards" }));
        if (y) anims.push(el.animate([{ transform: `translateY(${y}px)` }, { transform: "none" }], { duration: RISE, delay, easing: QUAD, fill: "backwards" }));
      };
      navBits.forEach((el) => fadeUp(el, 0, 0));
      rest.forEach((el) => fadeUp(el, 1, 0));
      items.forEach((el, i) => fadeUp(el, i + 1, Y));
      return Promise.all(anims.map((x) => x.finished.catch(() => {})));
    };

    let ended = false;
    const end = () => {
      if (ended) return;
      ended = true;
      root.classList.remove("has-intro", "intro-wait", "intro-fade");
      if (home) home.style.visibility = "";
      intro.remove();
      window.dispatchEvent(new Event("intro:done"));
    };
    const fadeIn = (ms) => {                              // the site appears around the figure
      root.style.setProperty("--intro-fade", `${ms}ms`);   // even in-out, so the site comes up gradually
      root.classList.add("intro-fade");
      root.classList.remove("has-intro", "intro-wait");
    };
    // start once the first frame is up, so nothing loading competes with it
    // Wait for a click or tap on the figure, or Enter/Space on it. Meanwhile the
    // figure blinks now and then, so it doesn't look frozen.
    // One click: a single long sip drains the glass, then it flies off.
    const SIPS = 1;
    let sips = 0, sipping = false, sipTok = 0, emptied;
    const clicked = new Promise((go) => { emptied = go; });
    // While it waits it keeps itself busy: every few seconds a blink or one
    // of the moves, at random and never the same twice in a row. While the
    // cursor is on it, it plays move after move, each one different from the
    // last, perking up between them. One move at a time.
    const moves = ["curious", "bounce", "shimmy", "doze", "chillOut"];
    const perked = { perk: 0.5, wide: 0.25, lift: -8 }, rest = { perk: 0, wide: 0, lift: 0 };
    let hovered = false, busy = false, prev = -1, looping = false;
    const play = async (fn) => {
      busy = true;
      await fn();
      busy = false;
      if (waiting && !sipping) fig.key(hovered ? perked : rest, 260, E.out);   // back to watching you, or to rest
    };
    const pick = () => {
      let i;
      do i = Math.floor(Math.random() * moves.length); while (i === prev);
      prev = i;
      return () => fig.run(moves[i]);
    };
    const hoverLoop = async () => {
      if (looping) return;
      looping = true;
      while (hovered && waiting) {
        if (busy || sipping) { await wait(80); continue; } // let a move or a sip finish
        fig.key(perked, 220, E.out);                       // a little perk-up between moves
        await play(async () => { await wait(240); if (hovered && waiting && !sipping) await pick()(); });
      }
      looping = false;
    };
    enter.addEventListener("mouseenter", () => { hovered = true; if (waiting) hoverLoop(); });
    enter.addEventListener("mouseleave", () => {
      hovered = false;
      if (waiting && !busy && !sipping) fig.key(rest, 300, E.inOut);
    });
    (async () => {
      while (waiting) {
        await wait(2200 + 1600 * Math.random());
        if (!waiting || busy || hovered || sipping) continue;   // while hovered, the hover loop runs it
        await play(Math.random() < 0.3 ? () => fig.run("blink") : pick());
      }
    })();
    // The sip: one long, smooth slurp that drains the glass, the straw
    // rattles round the bottom, then a content sigh. (Earlier it took four
    // clicks with a different feeling each; kept in
    // .verbose-backup/main-before-one-click.js.)
    const feelings = {
      last: async (k, from, to) => {
        await k({ lid: 0.6, perk: -0.45, sip: -22, squash: 0.06 }, 160, E.out);
        // one long steady draw: the level falls in a single smooth motion
        // while the body slowly sinks into the sip, no gulps or steps
        fig.kick(-0.5);
        k({ drain: to }, 950, E.inOut);
        await k({ squash: 0.09, lift: 3, lid: 0.7 }, 950, E.inOut);
        k({ wide: 0.3, lid: 0, perk: -0.5 }, 160, E.out);  // looks down: all gone?
        for (const straw of [4, -4, 3, -3, 0]) await k({ straw, sip: -26 }, 60, E.inOut);   // straw rattles round the bottom
        await k({ squash: -0.03, lift: -6, lid: 0.5, perk: 0, wide: 0, sip: 0 }, 180, E.inOut);   // content sigh
        await k({ lid: 1 }, 70, E.in);
        await k({ lid: 0 }, 120, E.out);                  // straight into the crouch from here
      },
    };
    const order = ["last"];
    enter.addEventListener("click", async () => {
      if (!waiting || sips >= SIPS) return;
      fig.stop();
      const from = sips / SIPS, feel = order[sips];
      sips++;
      sipping = true;
      intro.classList.add("is-sipping");                  // the hint has done its job
      const me = ++sipTok;
      const k = (p, ms, ease) => (me === sipTok ? fig.go(p, ms, ease) : Promise.resolve());
      // ease out of whatever he was doing (mid-hop, mid-lean, eyes shut)
      // rather than snapping, then the sip starts from a calm pose
      await k({ tilt: 0, look: 0, wide: 0, perk: 0, straw: 0, lift: 0, squash: 0, lid: 0, sip: 0 }, 260, E.inOut);
      await feelings[feel](k, from, sips / SIPS);
      if (me !== sipTok) return;                          // a newer click took over
      fig.go({ drain: sips / SIPS }, 200, E.out);        // in case a cut-short sip left it between steps
      if (sips >= SIPS) { emptied(); return; }
      await k({ lid: 0, wide: hovered ? 0.25 : 0, perk: hovered ? 0.5 : 0, look: 0, tilt: 0, squash: 0, lift: hovered ? -8 : 0, sip: 0, straw: 0 }, 320, E.spring);
      if (me === sipTok) sipping = false;
    });
    // No click needed (audit, 10 Nov 2026: a gate in front of the work cost
    // recruiters their first seconds): after a short beat he takes the sip on
    // his own. A click or tap before then just starts it sooner. The intro now
    // plays only on the home page; before: .verbose-backup/main-before-p0.js.
    setTimeout(() => { if (waiting && !sipping) enter.click(); }, 600);
    clicked.then(async () => {
      if (!waiting) return;
      waiting = false;
      fig.stop(); fig.halt();                             // whatever idle move was playing stops here
      setTimeout(end, 5500);                              // failsafe if animation stalls
      intro.classList.add("is-going");
      enter.dispatchEvent(new MouseEvent("mouseleave"));   // the cursor drops its label                    // the prompt fades away
      const a = fig.svg.getBoundingClientRect(), b = home && home.getBoundingClientRect();
      if (!b || !b.width) { fadeIn(450); await wait(450); return end(); }
      // It swoops home: one smooth arc that dips slightly, then rises into
      // the slot like a bird to a perch, on a gentle even in-out over 1.5s
      // (Jay picked it from the path study, 8 Nov 2026; straight before), shrinking evenly (log scale) and leaning a little into
      // the direction it travels: the lean follows its speed, so it tips as
      // it gets going and straightens as it docks. Over the bare sky, still
      // empty; the page follows (cascade), and once it has landed in its
      // spot it refills (Jay, 8 Nov 2026; it used to refill mid-flight).
      const dx = b.left + b.width / 2 - (a.left + a.width / 2);
      const dy = b.top + b.height / 2 - (a.top + a.height / 2);
      const s = b.height / a.height, DUR = 1500, N = 90;
      // cubic-bezier(x1, y1, x2, y2) as a function of time 0..1
      const bez = (x1, y1, x2, y2) => (t) => {
        let u = t;
        for (let i = 0; i < 10; i++) {
          const x = 3 * (1 - u) * (1 - u) * u * x1 + 3 * (1 - u) * u * u * x2 + u * u * u - t;
          const d = 3 * (1 - u) * (1 - u) * x1 + 6 * (1 - u) * u * (x2 - x1) + 3 * u * u * (1 - x2);
          if (Math.abs(d) < 1e-6) break;
          u = clamp(u - x / d, 0, 1);
        }
        return 3 * (1 - u) * (1 - u) * u * y1 + 3 * (1 - u) * u * u * y2 + u * u * u;
      };
      const std = bez(0.4, 0, 0.2, 1), lead = bez(0.25, 0.1, 0.1, 1), lag = bez(0.6, 0, 0.2, 1);
      const lazy = bez(0.65, 0, 0.35, 1), emph = bez(0.2, 0, 0, 1);
      // Paths to try, from the path study (add ?path=name to the URL with
      // ?intro): each gives how far along x and y it is (0..1) and a bulge
      // off the straight line (share of the distance, + is to the left).
      let SW = 0.05;                                       // the swoop's bulge (share of the distance), capped below to stay on screen
      const PATHS = {
        straight: (t) => { const q = std(t); return [q, q, 0]; },        // the default until 8 Nov 2026
        rise: (t) => [lag(t), lead(t), 0],                               // up first, then over
        glide: (t) => [lead(t), lag(t), 0],                              // over first, then up
        // round without dipping: across first, then up (x leads, y lags), so
        // it never drops below where it set off; a small bow softens it
        swoop: (t) => { const q = lazy(t); return [1 - Math.pow(1 - q, 1.35), Math.pow(q, 1.35), -Math.sin(Math.PI * q) * SW]; },   // 1.35 (1.7 climbed too abruptly at the end)    // dips, then arcs up: Jay's pick, 8 Nov 2026 (bulge 0.18, then 0.3 for a rounder curve)
        magnet: (t) => { const q = emph(t); return [q, Math.pow(q, 0.85), 0]; },             // quick, then drawn in
      };
      const pick = new URLSearchParams(location.search).get("path");
      const path = PATHS[pick] || PATHS.swoop;
      const len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
      {
        // keep the glass fully on screen at the widest point of the arc (on
        // a tall phone a 0.3 bulge swung it off the left edge)
        const cx0 = a.left + a.width / 2 + dx / 2, cy0 = a.top + a.height / 2 + dy / 2;
        const ox = -nx * len, oy = -ny * len, m = a.width * 0.45 + 8;   // offset per unit of bulge, and the margin
        const room = (o, c, lo, hi) => (o > 0 ? (hi - c) / o : o < 0 ? (lo - c) / o : Infinity);
        SW = Math.max(0, Math.min(SW, room(ox, cx0, m, innerWidth - m), room(oy, cy0, m, innerHeight - m)));
      }
      const pts = Array.from({ length: N + 1 }, (_, i) => {
        const [px, py, bl] = path(i / N);
        return [dx * px + nx * bl * len, dy * py + ny * bl * len, (px + py) / 2];
      });
      const vx = pts.map((p, i) => (i ? p[0] - pts[i - 1][0] : 0)), vmax = Math.max(...vx.map(Math.abs)) || 1;
      const lean = 16;                                    // degrees at full sideways speed (7 until Jay asked for it to tilt into its direction, 8 Nov 2026)
      const frames = pts.map(([x, y, q], i) => ({
        transform: `translate(${x}px, ${y}px) rotate(${(lean * vx[i] / vmax).toFixed(2)}deg) scale(${Math.exp(Math.log(s) * q)})`,
      }));
      fig.svg.style.transformOrigin = "50% 50%";
      fig.go({ look: dx < 0 ? -0.5 : 0.5, wide: 0.2, perk: 0.3, lid: 0, straw: 0, sip: 0, squash: 0, lift: 0, tilt: 0 }, 260, E.inOut);
      fig.kick(dx < 0 ? 0.6 : -0.6);                      // the drink feels the start
      // Its shadow stays on the floor. The figure's own ground shadows are
      // swapped (same frame, same place) for two on an invisible floor in the
      // page: a dark contact shadow and a lighter cast one, as at rest. The
      // floor stays where he took off (receding only slightly), the shadow
      // follows him across it and shrinks with distance; as he climbs off it the contact shadow goes
      // first, the cast one spreads thinner, slides right (light from the top
      // left) and fades, and both have dissipated well before he lands.
      const u = a.width / 540;                            // figure units to screen pixels at the start
      const floorShadow = (cx, cy, rx, ry, op) => {
        const d = document.createElement("span");
        d.className = "intro__floor";
        d.style.cssText = `left:${a.left + cx * u}px;top:${a.top + cy * u}px;width:${2 * rx * u}px;height:${2 * ry * u}px;opacity:${op}`;
        intro.prepend(d);
        return d;
      };
      const castEl = floorShadow(332, 590, 262, 50, 0.14), contactEl = floorShadow(291, 592, 252, 58, 0.34);
      fig.ground(false, true);                           // the figure's own ones, swapped out in the same frame
      const floor0 = a.top + 592 * u, floor1 = b.top + 592 * (b.width / 540);
      const flight = fig.svg.animate(frames, { duration: DUR, easing: "linear", fill: "forwards" });
      // It moves the liquid as it goes, the same way a cursor dragged
      // through it does: the glass is the finger, so it leaves a wake in the
      // hojicha that refills behind it and dissolves back into the flow.
      (async () => {
        while (flight.playState === "running") {
          const r = fig.svg.getBoundingClientRect();
          skyFinger(r.left + r.width / 2, r.top + r.height / 2, r.width * 0.8);   // it cuts through the liquid like the cursor, a disc inside the cup
          {
            const sc = r.height / a.height;                       // how far away he is (1 at the start)
            const q = Math.log(sc) / Math.log(s);                 // 0 at the start, 1 home
            const floorY = floor0 + (floor1 - floor0) * q * 0.2;  // the floor stays put, receding only a little
            const h = Math.max(0, floorY - (r.top + r.height * (592 / 639)));   // his height off it
            const t = clamp((flight.currentTime || 0) / DUR, 0, 1);
            const fade = clamp(1 - t / 0.55, 0, 1);               // gone a little past halfway
            const kc = Math.max(0, 1 - h / (0.12 * a.height)), ks = Math.exp(-h / (0.8 * a.height));
            const ux = r.width / 540;
            const place = (el, cx, rx, ry, op) => {
              el.style.left = `${r.left + cx * ux - rx * ux}px`;
              el.style.top = `${floorY - ry * ux}px`;
              el.style.width = `${2 * rx * ux}px`; el.style.height = `${2 * ry * ux}px`;
              el.style.opacity = op.toFixed(3);
            };
            place(contactEl, 291, 252 * (0.85 + 0.15 * kc), 58, 0.34 * kc * fade);
            place(castEl, 332 + h / ux * 0.25, 262 * (0.7 + 0.3 * ks), 50 * (0.7 + 0.3 * ks), 0.14 * ks * fade);
          }
          await new Promise((res) => requestAnimationFrame(res));
        }
        skyFinger(null);
        contactEl.remove(); castEl.remove();
      })();
      await wait(DUR * 0.6);
      fig.kick(dx < 0 ? -0.5 : 0.5);                      // slowing down: the drink runs on a little
      fig.go({ look: 0, wide: 0, perk: 0 }, 400, E.inOut);   // eyes come home
      // the page starts following now, 0.6 of the way (0.75 until Jay asked
      // for it a bit earlier, 8 Nov 2026), so it's appearing as the cup settles
      const shown = cascade();
      await flight.finished;
      // landed: its own shadows come back under it, and it fills back up,
      // the pour sloshing the drink (the drop spreads back out into it)
      fig.ground(true);
      fig.kick(0.5);
      await fig.go({ drain: 0 }, 900, E.inOut);
      await shown;
      end();
    });
  }

  /* ---------- Expanding project panels (home page) ----------
     Hovering or focusing a panel opens it wide (.is-on). A tap on a closed
     panel only opens it; tapping the open one goes to the case study. With a
     mouse the hover has already opened it, so a click goes straight through. */
  document.querySelectorAll(".panels").forEach((list) => {
    const panels = [...list.querySelectorAll(".panel")];
    const open = (p) => panels.forEach((x) => x.classList.toggle("is-on", x === p));
    panels.forEach((p) => {
      const link = p.querySelector(".panel__link");
      p.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") open(p); });
      link.addEventListener("focus", () => open(p));
      link.addEventListener("click", (e) => {
        if (!p.classList.contains("is-on")) { e.preventDefault(); open(p); }
      });
    });
  });

  /* ---------- Work link: an unhurried glide to Selected work ----------
     The browser's own smooth scroll is quick and fixed; this one takes
     longer the further it goes (0.8 to 1.4s), eases in and out, and lets go
     the moment you scroll yourself. Reduced motion: it jumps. */
  const workLink = document.querySelector('.nav__link[href="#work"]');
  const workSec = document.getElementById("work");
  // Every page arrives with the intro's staggered fade-in (Jay, 8 Nov 2026;
  // first just for Work, now all pages): instead of the browser's quick
  // cross-fade, the content on screen comes up block by block in reading
  // order, apple.com's values: each rises 30px over 0.7s and fades in over
  // 0.9s, easeInOutQuad, 0.15s apart. Blocks are the .reveal elements, and
  // any on-screen content without one counts as its own block, so nothing
  // pops in unanimated. The nav stays put. Arriving at index.html#work, it
  // settles on the section first. Not under reduced motion, and not while
  // the intro is up (the intro's handoff does this itself).
  const html = document.documentElement;
  if (!prefersReduced && !html.classList.contains("has-intro") && !html.classList.contains("intro-wait")) {
    window.addEventListener("pagereveal", (e) => { if (e.viewTransition) e.viewTransition.skipTransition(); }, { once: true });
    if (workSec && location.hash === "#work") {
      const margin = parseFloat(getComputedStyle(workSec).scrollMarginTop) || 0;
      window.scrollTo(0, workSec.getBoundingClientRect().top + window.scrollY - margin);
    }
    const vh = window.innerHeight;
    const shown = (el) => { const rc = el.getBoundingClientRect(); return rc.height > 0 && rc.width > 0 && rc.bottom > 0 && rc.top < vh; };
    const blocks = [];
    const walk = (el) => {                                // reading order: a .reveal is a block; otherwise look inside
      for (const c of el.children) {
        if (c.matches("script, style, template") || !shown(c)) continue;
        if (c.classList.contains("reveal") || !c.querySelector(".reveal")) blocks.push(c);
        else walk(c);
      }
    };
    const main = document.querySelector("main");
    if (main) walk(main);
    // anything else on screen outside main (the footer on a short page) joins the first block
    const rest = [...document.body.children].filter((el) =>
      !el.matches("main, .nav, .sky, .cursor, .intro, .cs-toc, .pdf-modal, script") && getComputedStyle(el).position !== "fixed" && shown(el));
    const QUAD = "cubic-bezier(.455, .03, .515, .955)";   // easeInOutQuad
    const fadeUp = (el, i, y) => {
      el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 900, delay: i * 150, easing: QUAD, fill: "backwards" });
      if (y) el.animate([{ transform: `translateY(${y}px)` }, { transform: "none" }], { duration: 700, delay: i * 150, easing: QUAD, fill: "backwards" });
    };
    blocks.forEach((el, i) => fadeUp(el, i, 30));
    rest.forEach((el) => fadeUp(el, 0, 0));
  }
  if (workLink && workSec) {
    let gliding = 0;
    const stopGlide = () => { cancelAnimationFrame(gliding); gliding = 0; };
    ["wheel", "touchstart", "keydown"].forEach((ev) => window.addEventListener(ev, stopGlide, { passive: true }));
    workLink.addEventListener("click", (e) => {
      e.preventDefault();
      history.replaceState(null, "", "#work");
      const margin = parseFloat(getComputedStyle(workSec).scrollMarginTop) || 0;
      const from = window.scrollY, to = workSec.getBoundingClientRect().top + from - margin, d = to - from;
      if (prefersReduced || Math.abs(d) < 2) { window.scrollTo(0, to); return; }
      const T = clamp(800 + Math.abs(d) * 0.4, 800, 1400), t0 = performance.now();
      const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
      stopGlide();
      const step = (now) => {
        const k = Math.min(1, (now - t0) / T);
        window.scrollTo(0, from + d * ease(k));
        gliding = k < 1 ? requestAnimationFrame(step) : 0;
      };
      gliding = requestAnimationFrame(step);
    });
  }

  /* ---------- Menu button on narrow screens ----------
     Below 720px the nav links fold into a three-line button that opens them
     as a panel under the nav. The button is added here, so without JS the
     links simply stay visible. Closes on a link tap, Escape, a tap outside,
     or when the window widens again. */
  const links = nav && nav.querySelector(".nav__links");
  if (links) {
    links.id = "nav-menu";
    const btn = document.createElement("button");
    btn.className = "nav__toggle";
    btn.type = "button";
    btn.setAttribute("aria-controls", "nav-menu");
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-label", "Menu");
    btn.innerHTML = "<span></span><span></span><span></span>";
    nav.insertBefore(btn, links);
    const setOpen = (open) => {
      nav.classList.toggle("is-open", open);
      btn.setAttribute("aria-expanded", String(open));
      btn.setAttribute("aria-label", open ? "Close menu" : "Menu");
    };
    btn.addEventListener("click", () => setOpen(!nav.classList.contains("is-open")));
    links.addEventListener("click", (e) => { if (e.target.closest("a")) setOpen(false); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && nav.classList.contains("is-open")) { setOpen(false); btn.focus(); }
    });
    document.addEventListener("click", (e) => {
      if (nav.classList.contains("is-open") && !nav.contains(e.target)) setOpen(false);
    });
    window.matchMedia("(min-width: 721px)").addEventListener("change", (e) => { if (e.matches) setOpen(false); });
  }

  /* ---------- Cursor indicator (fine pointer only) ---------- */
  /* Elements carrying data-cursor-label swap the ring for a labelled pill.
     Dispatch a "cursor-label" event to change that text while hovering. */
  if (!coarse && !prefersReduced) {
    const dot = document.createElement("div");
    dot.className = "cursor";
    const dotLabel = document.createElement("span");
    dotLabel.className = "cursor__label";
    dot.appendChild(dotLabel);
    document.body.appendChild(dot);
    /* Tells the stylesheet the pointer is carrying labels, so elements can
       drop their own static hover hints. */
    document.documentElement.classList.add("has-cursor");

    const label = (text) => {
      dot.classList.toggle("has-label", Boolean(text));
      if (!text) return;
      dotLabel.textContent = text;
      // Width has to be a number for the pill to animate out of the dot;
      // 11px mono advances ~7.3px per character, plus the pill's padding.
      dot.style.setProperty("--cursor-label-w", `${Math.round(text.length * 7.3 + 30)}px`);
    };
    document.addEventListener("cursor-label", (e) => label(e.detail));

    // A high-Hz mouse fires many move events per frame, and a real mouse fires
    // pointermove *and* mousemove — so writing transform per event meant
    // several style invalidations for a single painted frame. Record the
    // position on every event but write it once, in rAF, right before paint.
    let px = 0;
    let py = 0;
    let queued = false;
    const paint = () => {
      queued = false;
      dot.style.transform =
        `translate3d(${px}px, ${py}px, 0) translate(-50%, -50%)`;
    };
    // The dot shows only once the pointer has moved on this page, and hides
    // again when the pointer leaves the window, the tab is hidden, or Back
    // restores the page from the back/forward cache. Otherwise a stale dot
    // sits next to the system arrow the browser shows until the first move.
    const hide = () => dot.classList.remove("is-active");
    document.documentElement.addEventListener("mouseleave", hide);
    document.addEventListener("visibilitychange", () => { if (document.hidden) hide(); });
    window.addEventListener("pageshow", (e) => { if (e.persisted) hide(); });

    const apply = (e) => {
      px = e.clientX;
      py = e.clientY;
      if (!dot.classList.contains("is-active")) {
        // Jump to the pointer before fading in, so it doesn't fade in elsewhere.
        dot.style.transform = `translate3d(${px}px, ${py}px, 0) translate(-50%, -50%)`;
        dot.classList.add("is-active");
      }
      if (queued) return;
      queued = true;
      requestAnimationFrame(paint);
    };
    // One source of truth: pointermove covers mice everywhere it exists.
    if (window.PointerEvent) {
      document.addEventListener("pointermove", apply, { passive: true });
    } else {
      document.addEventListener("mousemove", apply, { passive: true });
    }

    const enter = (e) => {
      dot.classList.add("is-link");
      label(e.currentTarget.dataset.cursorLabel);
    };
    const leave = () => {
      dot.classList.remove("is-link");
      label("");
    };
    document
      .querySelectorAll('a, button, [role="button"], .panel__link, .work__item, .cs-next')
      .forEach((el) => {
        el.addEventListener("mouseenter", enter);
        el.addEventListener("mouseleave", leave);
      });

    // Over a video the system pointer takes over (see styles.css).
    document.querySelectorAll("video[controls]").forEach((el) => {
      el.addEventListener("mouseenter", () => dot.classList.add("is-off"));
      el.addEventListener("mouseleave", () => dot.classList.remove("is-off"));
    });
  }

  /* ---------- Looping hover clips ----------
     Muted autoplay loops stand in for GIFs. With reduced motion they hold
     on their poster (the still of the same screen) instead. */
  if (prefersReduced) {
    document.querySelectorAll("video[autoplay][loop]").forEach((v) => {
      v.removeAttribute("autoplay");
      v.pause();
    });
  }

  /* ---------- Magnetic effect on primary CTAs ---------- */
  if (!coarse && !prefersReduced) {
    const magnets = document.querySelectorAll("[data-magnet]");
    magnets.forEach((el) => {
      const strength = parseFloat(el.dataset.magnet || "0.2");
      let rect = null;
      let mx = 0;
      let my = 0;
      let queued = false;
      const paint = () => {
        queued = false;
        el.style.transform = `translate(${mx}px, ${my}px)`;
      };
      // Measured once per hover. Reading it on every move forced a synchronous
      // reflow in the middle of the frame, and read-back the element's own
      // translation, so the pull damped itself as it moved.
      el.addEventListener("mouseenter", () => {
        rect = el.getBoundingClientRect();
      });
      el.addEventListener("mousemove", (e) => {
        if (!rect) rect = el.getBoundingClientRect();
        mx = (e.clientX - (rect.left + rect.width / 2)) * strength;
        my = (e.clientY - (rect.top + rect.height / 2)) * strength;
        if (queued) return;
        queued = true;
        requestAnimationFrame(paint);
      });
      el.addEventListener("mouseleave", () => {
        rect = null;
        el.style.transform = "translate(0,0)";
      });
    });
  }

  /* Page-to-page transitions are native now (`@view-transition` in styles.css). */

  /* ---------- Copy-to-clipboard buttons ---------- */
  /* Only meaningful while the pointer is still on the button — otherwise the
     cursor has moved on and its label belongs to whatever it is over now. */
  const tellCursor = (btn, text) => {
    if (btn.dataset.cursorLabel && btn.matches(":hover")) {
      document.dispatchEvent(new CustomEvent("cursor-label", { detail: text }));
    }
  };

  document.querySelectorAll("[data-copy]").forEach((btn) => {
    const original = btn.querySelector("[data-copy-label]")?.textContent ?? btn.textContent;
    /* In-app browsers (LinkedIn, Instagram) can block the Clipboard API. Fall
       back to the legacy copy command, and if that fails too, open a mail draft
       so the click never does nothing. */
    const legacyCopy = (text) => {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;opacity:0;pointer-events:none";
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch { ok = false; }
      ta.remove();
      return ok;
    };
    btn.addEventListener("click", async () => {
      try {
        try {
          await navigator.clipboard.writeText(btn.dataset.copy);
        } catch {
          if (!legacyCopy(btn.dataset.copy)) throw new Error("copy blocked");
        }
        btn.setAttribute("data-state", "copied");
        const label = btn.querySelector("[data-copy-label]");
        if (label) label.textContent = "Copied";
        tellCursor(btn, "Copied");
        setTimeout(() => {
          btn.removeAttribute("data-state");
          if (label) label.textContent = original;
          tellCursor(btn, btn.dataset.cursorLabel);
        }, 1400);
      } catch {
        window.location.href = `mailto:${btn.dataset.copy}`;
      }
    });
  });

  /* ---------- Role swap (hero headline, typewriter) ---------- */
  const roleSwap = document.querySelector(".role-swap");
  if (roleSwap && !prefersReduced) {
    const roles = (roleSwap.dataset.roles || "").split("|").map((s) => s.trim()).filter(Boolean);
    const textEl = roleSwap.querySelector(".role-swap__text");
    if (roles.length > 1 && textEl) {
      const HOLD_MS = 1200;
      const TYPE_MS = 42;
      const DELETE_MS = 26;
      const RETYPE_MS = 500;
      let i = 0;

      // Reserve width for the widest role so the rest of the headline
      // doesn't follow the caret as the text types/erases. The probe is
      // appended inside the actual heading so it inherits the real
      // cascade (font-size clamp, letter-spacing, etc.) instead of
      // relying on a copied `font` shorthand, which Safari can return empty.
      const reserveWidth = () => {
        const probe = document.createElement("span");
        probe.className = textEl.className;
        probe.style.position = "absolute";
        probe.style.visibility = "hidden";
        probe.style.whiteSpace = "pre";
        roleSwap.parentElement.appendChild(probe);
        let widest = 0;
        roles.forEach((r) => {
          probe.textContent = r;
          widest = Math.max(widest, probe.offsetWidth);
        });
        probe.remove();
        roleSwap.style.minWidth = `${widest}px`;
      };
      reserveWidth();
      window.addEventListener("resize", reserveWidth);

      const type = (str, pos, done) => {
        textEl.textContent = str.slice(0, pos);
        if (pos < str.length) {
          setTimeout(() => type(str, pos + 1, done), TYPE_MS);
        } else {
          done();
        }
      };

      const erase = (str, pos, done) => {
        textEl.textContent = str.slice(0, pos);
        if (pos > 0) {
          setTimeout(() => erase(str, pos - 1, done), DELETE_MS);
        } else {
          done();
        }
      };

      const advance = () => {
        setTimeout(() => {
          erase(roles[i], roles[i].length, () => {
            i = (i + 1) % roles.length;
            // Beat on the empty line before the next title starts typing.
            setTimeout(() => type(roles[i], 0, advance), RETYPE_MS);
          });
        }, HOLD_MS);
      };

      // under the intro, start once the page is in, so it begins on its first title
      if (document.documentElement.classList.contains("has-intro")) window.addEventListener("intro:done", advance, { once: true });
      else advance();
    }
  }

  /* ---------- Deferred-source modals (in-page, no new tab) ----------
     The heavy asset inside carries data-src and only loads on first open, so
     a page that merely links to a PDF or a poster doesn't pay for it upfront.
     Used by the resume PDF and the MEC ethnography poster. */
  const bindModal = (modalId, openSel, closeSel) => {
    const modal = document.getElementById(modalId);
    const opener = document.querySelector(openSel);
    if (!modal || !opener) return;
    const media = modal.querySelector("[data-src]");
    const scroller = modal.querySelector(".pdf-modal__scroll");
    let lastFocused = null;

    /* The modal stays laid out but invisible and inert while closed (rather
       than display:none), so the PDF viewer or poster can render ahead of time
       and the open is a pure opacity/transform transition. `hidden` in the
       markup is only the no-JS fallback. */
    modal.hidden = false;
    modal.inert = true;

    /* Load the heavy asset before it's needed. Chrome's PDF viewer spinning up
       at click time was the visible stall, so the resume loads once the page
       is idle; anything marked otherwise warms up on hover or focus. */
    const load = () => {
      if (media && !media.src) media.src = media.dataset.src;
    };
    if (modal.dataset.preload === "idle" && !(modalId === "pdf-modal" && window.matchMedia("(max-width: 720px)").matches)) {
      (window.requestIdleCallback || ((fn) => setTimeout(fn, 1200)))(load, { timeout: 2500 });
    } else {
      opener.addEventListener("pointerenter", load, { once: true });
      opener.addEventListener("focus", load, { once: true });
    }

    const open = () => {
      load();
      lastFocused = document.activeElement;
      modal.inert = false;
      modal.classList.add("is-open");
      document.body.style.overflow = "hidden";
      document.documentElement.classList.add("has-modal");
      // The backdrop also carries closeSel but can't take focus; aim for the button.
      modal.querySelector(`button${closeSel}`)?.focus({ preventScroll: true });
    };
    const close = () => {
      modal.classList.remove("is-open");
      modal.inert = true;
      document.body.style.overflow = "";
      document.documentElement.classList.remove("has-modal");
      media?.classList.remove("is-zoomed");
      if (scroller) scroller.scrollTo(0, 0);
      lastFocused?.focus({ preventScroll: true });
    };

    /* Click-to-zoom and drag-to-pan. A dense poster or a resume fitted to a
       laptop viewport is hard to read, and browser zoom scales the whole page
       instead. Clicking toggles the image to its own pixel width inside the
       scroller, keeping the clicked point under the pointer; dragging moves the
       page around like a sheet on a desk. The zoom is an instant swap, not a
       width transition: animating the width of a ~2000px image relayouts every
       frame, which is what made it feel heavy. */
    if (scroller && media && media.tagName === "IMG") {
      let drag = null;
      let dragged = false;

      scroller.addEventListener("pointerdown", (e) => {
        if (e.pointerType !== "mouse" || e.button !== 0) return;
        drag = { x: e.clientX, y: e.clientY, left: scroller.scrollLeft, top: scroller.scrollTop };
        dragged = false;
      });
      scroller.addEventListener("pointermove", (e) => {
        if (!drag) return;
        const dx = e.clientX - drag.x;
        const dy = e.clientY - drag.y;
        if (!dragged && Math.hypot(dx, dy) < 4) return;
        if (!dragged) {
          dragged = true;
          scroller.setPointerCapture(e.pointerId);
          scroller.classList.add("is-dragging");
        }
        scroller.scrollLeft = drag.left - dx;
        scroller.scrollTop = drag.top - dy;
      });
      const endDrag = () => {
        drag = null;
        scroller.classList.remove("is-dragging");
      };
      scroller.addEventListener("pointerup", endDrag);
      scroller.addEventListener("pointercancel", endDrag);

      media.addEventListener("click", (e) => {
        // The click that ends a drag is a pan, not a zoom.
        if (dragged) { dragged = false; return; }
        const rect = media.getBoundingClientRect();
        const fx = (e.clientX - rect.left) / rect.width;
        const fy = (e.clientY - rect.top) / rect.height;
        // Where the pointer sits within the scroller's visible area.
        const box = scroller.getBoundingClientRect();
        const px = e.clientX - box.left;
        const py = e.clientY - box.top;
        media.classList.toggle("is-zoomed");
        // One layout read after the swap; no transition, so these are final.
        scroller.scrollLeft = media.offsetLeft + fx * media.offsetWidth - px;
        scroller.scrollTop = media.offsetTop + fy * media.offsetHeight - py;
      });
    }

    opener.addEventListener("click", open);
    modal.querySelectorAll(closeSel).forEach((el) => el.addEventListener("click", close));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.classList.contains("is-open")) close();
    });
  };
  /* Phones open the résumé PDF itself instead of the image viewer: the
     viewer shrank the page to the screen width (about 4px text), while the
     phone's own PDF viewer pinch-zooms (mobile audit, 10 Nov 2026). This
     listener runs first (capture) and stops the viewer from opening. */
  const phonePdf = window.matchMedia("(max-width: 720px)");
  document.addEventListener("click", (e) => {
    const opener = e.target.closest && e.target.closest("[data-pdf-open]");
    if (!opener || !phonePdf.matches) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    window.location.href = opener.dataset.pdfHref || "assets/resume.pdf";
  }, true);
  bindModal("pdf-modal", "[data-pdf-open]", "[data-pdf-close]");
  bindModal("poster-modal", "[data-poster-open]", "[data-poster-close]");

  /* ---------- Enlarge an image (mobile audit, 10 Nov 2026) ----------
     Research visuals and before/after screens shrank to a fifth of their size
     on phones. Any img[data-zoom] gets a small enlarge button in its corner;
     the button or the image opens it full screen. On wide screens it fits the
     window; on narrow ones it shows at a readable width you can pan, and
     pinch-zoom still works. Escape, the close button or the backdrop close it. */
  const zoomImgs = [...document.querySelectorAll("img[data-zoom]")];
  if (zoomImgs.length) {
    const box = document.createElement("div");
    box.className = "zoom";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-label", "Enlarged image");
    box.inert = true;
    box.innerHTML = '<button type="button" class="zoom__close" aria-label="Close">&times;</button><div class="zoom__scroll"><img class="zoom__img" alt=""></div>';
    document.body.appendChild(box);
    const big = box.querySelector(".zoom__img"), scroller = box.querySelector(".zoom__scroll");
    const closeBtn = box.querySelector(".zoom__close");
    let back = null;
    const size = () => {
      const nat = big.naturalWidth || 1200;
      const vw = window.innerWidth;
      // Retina exports (3000px and up) are shown at half their pixels.
      const css = nat > 2400 ? nat / 2 : nat;
      big.style.width = `${vw >= 1000 ? Math.min(css, vw - 96) : Math.max(vw - 32, Math.min(css, 1400))}px`;
    };
    const open = (img) => {
      back = document.activeElement;
      big.src = img.currentSrc || img.src;
      big.alt = img.alt;
      if (big.complete) size(); else big.onload = size;
      box.inert = false;
      box.classList.add("is-open");
      document.body.style.overflow = "hidden";
      document.documentElement.classList.add("has-modal");
      scroller.scrollTo(0, 0);
      closeBtn.focus({ preventScroll: true });
    };
    const close = () => {
      if (!box.classList.contains("is-open")) return;
      box.classList.remove("is-open");
      box.inert = true;
      document.body.style.overflow = "";
      document.documentElement.classList.remove("has-modal");
      back?.focus({ preventScroll: true });
    };
    zoomImgs.forEach((img) => {
      const host = img.closest(".cs-frame, .cs-swipe, figure") || img.parentElement;
      host.classList.add("has-zoom");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "zoom-btn";
      btn.setAttribute("aria-label", `Enlarge image${img.alt ? `: ${img.alt.split(/[.:]/)[0]}` : ""}`);
      btn.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M9.5 2.5h4v4M13.5 2.5 9 7M6.5 13.5h-4v-4M2.5 13.5 7 9"/></svg>';
      btn.addEventListener("click", () => open(img));
      host.appendChild(btn);
      img.addEventListener("click", () => open(img));
    });
    closeBtn.addEventListener("click", close);
    box.addEventListener("click", (e) => { if (e.target === box || e.target === scroller) close(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    window.addEventListener("resize", () => { if (box.classList.contains("is-open")) size(); });
  }

  /* ---------- Case-study section rail (sub-navigation) ----------
     Wide screens: fixed vertical rail. Narrow: sticky chip bar.
     Active item is derived from scroll position, not click state, so it
     stays honest whether the user scrolls, jumps, or lands on a #hash. */
  const toc = document.querySelector(".cs-toc");
  if (toc) {
    const list = toc.querySelector(".cs-toc__list");
    const items = Array.from(toc.querySelectorAll(".cs-toc__link"))
      .map((link) => {
        const id = (link.getAttribute("href") || "").slice(1);
        return { link, target: id ? document.getElementById(id) : null };
      })
      .filter((it) => it.target);

    if (items.length) {
      const wide = window.matchMedia("(min-width: 1200px)");
      const root = document.documentElement;

      // Native smooth anchor scrolling — paired with scroll-margin-top in CSS.
      if (!prefersReduced) root.style.scrollBehavior = "smooth";

      /* Measure the sticky chrome so scroll-margin-top and the sticky
         offset track the real nav height instead of a guessed constant. */
      const measure = () => {
        const navH = document.querySelector(".nav")?.offsetHeight;
        if (navH) root.style.setProperty("--nav-h", `${Math.round(navH)}px`);
        if (!wide.matches) {
          root.style.setProperty("--toc-bar-h", `${Math.round(toc.offsetHeight)}px`);
        }
      };

      const centerChip = (link) => {
        if (!list || wide.matches) return;
        const left = link.offsetLeft - (list.clientWidth - link.offsetWidth) / 2;
        list.scrollTo({ left, behavior: prefersReduced ? "auto" : "smooth" });
      };

      let active = -1;
      const setActive = (idx) => {
        if (idx === active || idx < 0) return;
        active = idx;
        items.forEach((it, i) => {
          const on = i === idx;
          it.link.classList.toggle("is-active", on);
          if (on) it.link.setAttribute("aria-current", "true");
          else it.link.removeAttribute("aria-current");
        });
        centerChip(items[idx].link);
      };

      let jumpTo = -1, jumpTimer = 0;
      const update = () => {
        const y = window.scrollY;
        // The "reading line" sits about a third of the way down the viewport.
        const line = y + window.innerHeight * 0.32;
        let idx = 0;
        for (let i = 0; i < items.length; i++) {
          if (items[i].target.getBoundingClientRect().top + y <= line) idx = i;
        }
        // Bottom of the document always resolves to the final section.
        if (y + window.innerHeight >= root.scrollHeight - 4) idx = items.length - 1;
        setActive(jumpTo >= 0 ? jumpTo : idx);

        // The rail starts hidden (class set in the HTML, so it never flashes on
        // load) and fades in once the first section reaches the reading line.
        if (wide.matches) {
          const firstTop = items[0].target.getBoundingClientRect().top + y;
          toc.classList.toggle("is-hidden", firstTop > line);
        } else {
          toc.classList.remove("is-hidden");
        }
      };

      let ticking = false;
      const onScroll = () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          ticking = false;
          update();
        });
      };

      // Clicking sets the state immediately; the scroll pass confirms it.
      // The jump replaces the URL hash instead of adding a history entry, so
      // Back leaves the case study rather than stepping through sections.
      // While a clicked jump is scrolling, the highlight stays on the clicked
      // section instead of ticking through every section it passes.
      const release = () => { jumpTo = -1; update(); };
      window.addEventListener("scrollend", release);
      items.forEach((it, i) => {
        it.link.addEventListener("click", (e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
          e.preventDefault();
          jumpTo = i;
          clearTimeout(jumpTimer);
          jumpTimer = setTimeout(release, 1500);
          setActive(i);
          it.target.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "start" });
          history.replaceState(history.state, "", it.link.getAttribute("href"));
        });
      });

      const refresh = () => {
        measure();
        active = -1;
        update();
      };

      measure();
      update();
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", refresh, { passive: true });
      if (typeof wide.addEventListener === "function") {
        wide.addEventListener("change", refresh);
      }
      window.addEventListener("load", refresh);
    }
  }

  /* ---------- Year stamp ---------- */
  document.querySelectorAll("[data-year]").forEach((el) => {
    el.textContent = new Date().getFullYear();
  });

  /* ---------- Local time stamp (hero ticker) ---------- */
  const clockEl = document.querySelector("[data-clock]");
  if (clockEl) {
    const tz = clockEl.dataset.clock || undefined;
    const update = () => {
      const now = new Date();
      const fmt = new Intl.DateTimeFormat("en-US", {
        hour: "numeric", minute: "2-digit", hour12: false,
        timeZone: tz,
      });
      clockEl.textContent = fmt.format(now);
    };
    update();
    setInterval(update, 15000);
  }
})();
