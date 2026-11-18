// spaceEngine.ts — Optimized 2-pass WebGL deep space engine (flicker-free & band-free)
// Pass 1 (BG_FRAG): renders nebula, Milky Way & galaxies ONCE per viewport resize using
// perceptual gamma-0.4 + spatial dither encoding into an FBO texture (zero 8-bit banding).
// Pass 2 (FG_FRAG): samples cached sky texture (with shader-side soft blur on dim), draws crisp
// CSS-px parallax stars + meteors at steady canvas dimensions (zero WebGL buffer resizes/flicker).

const VERT =
  'attribute vec2 a;varying vec2 vUv;void main(){vUv=a*.5+.5;gl_Position=vec4(a,0.,1.);}';

const BG_FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;
uniform vec3 uGal;

float h21(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1.,0.)),f.x),mix(h21(i+vec2(0.,1.)),h21(i+vec2(1.,1.)),f.x),f.y);}
float fbm3(vec2 p){float a=.5,s=0.;for(int i=0;i<3;i++){s+=a*n2(p);p=p*2.03+vec2(17.1,9.7);a*=.5;}return s;}
float fbm4(vec2 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*n2(p);p=p*2.03+vec2(17.1,9.7);a*=.5;}return s;}

vec3 galaxy(vec2 gp,float sz,float ca,float sa){
  vec2 q=vec2(ca*gp.x+sa*gp.y,-sa*gp.x+ca*gp.y)/sz; q.y/=.45;
  float r=length(q), th=atan(q.y,q.x);
  float arm=pow(.5+.5*cos(2.*th-log(r+.06)*5.),2.);
  float g=(exp(-r*r*14.)*1.3+exp(-r*2.4)*(.2+.7*arm)*smoothstep(1.5,.6,r))*(.7+.6*fbm4(q*4.));
  return g*.45*mix(vec3(1.,.85,.6),vec3(.5,.65,1.),smoothstep(0.,.9,r));
}

void main(){
  float Up=min(uRes.x,uRes.y);
  vec2 p=(gl_FragCoord.xy-.5*uRes)/Up;
  vec3 col=vec3(.0003,.0008,.0026);

  vec2 bp=vec2(.62*p.x+.78*p.y,-.78*p.x+.62*p.y);
  float band=exp(-bp.y*bp.y/.05);
  float along=fbm4(vec2(bp.x*2.2,bp.y*5.)+3.);
  float dust=smoothstep(.42,.72,fbm3(bp*vec2(3.,10.)+vec2(5.,1.)));
  float mw=band*(.3+.9*along)*(1.-.85*dust*band);
  col+=mw*.028*mix(vec3(.45,.58,1.),vec3(.85,.7,.6),band*along);

  vec2 pn=p*1.25;
  vec2 w1=vec2(fbm3(pn+.4),fbm3(pn+vec2(5.2,1.3)));
  float f=fbm4(pn+2.2*w1);
  float mask=smoothstep(.36,.7,fbm3(pn*.55+9.));
  vec3 nc=mix(vec3(.02,.10,.30),vec3(.04,.46,.62),smoothstep(.3,.65,f));
  nc=mix(nc,vec3(1.,.62,.25),smoothstep(.62,.92,f)*.75);
  nc+=vec3(.5,.2,.05)*w1.x*w1.x*w1.x*.6;
  float lanes=1.-.75*smoothstep(.5,.78,fbm3(pn*2.2+vec2(3.,8.)));
  col+=nc*f*f*mask*lanes*.85;

  col+=galaxy(p-uGal.xy,uGal.z,.88,.48)+.7*galaxy(p+vec2(uGal.x*.8,uGal.y*.5),uGal.z*.45,.6,-.8);

  // Perceptual gamma-0.40 + static spatial dither so 8-bit FBO has zero gradient banding
  vec3 enc=pow(clamp(col*.42,0.,1.),vec3(.40));
  enc+=(h21(gl_FragCoord.xy)-.5)/255.;
  gl_FragColor=vec4(clamp(enc,0.,1.),band);
}`;

const FG_FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vUv;
uniform sampler2D uBg;
uniform vec2 uBgTexel;
uniform vec2 uRes;
uniform float uT;
uniform float uScale;
uniform float uDim;
uniform vec2 uCam;
uniform vec4 uM0;
uniform vec4 uM1;
uniform vec2 uMa;

float h21(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
vec2 h22(vec2 p){vec3 q=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));q+=dot(q,q.yzx+33.33);return fract((q.xx+q.yz)*q.zy);}

vec3 decodeBg(vec2 uv){
  return pow(max(texture2D(uBg,uv).rgb,0.),vec3(2.5))/.42;
}

vec3 starLayer(vec2 cp,float cell,float thr,float sig,float gain,float seed){
  vec2 g=cp/cell, id=floor(g);
  float r=h21(id+seed);
  if(r<thr) return vec3(0.);
  vec2 o=(h22(id+seed*3.1)-.5)*.5;
  vec2 dv=(fract(g)-.5-o)*cell;
  float d2=dot(dv,dv), d=sqrt(d2);
  float b=h21(id*1.7+seed+9.);
  float mag=b*b*b;
  float s=max(sig*(.75+.5*mag)*(1.+.7*uDim),.45/uScale);
  float fade=1.-smoothstep(cell*.13,cell*.24,d);
  float core=exp(-d2/(2.*s*s));
  float halo=exp(-d2/(18.*s*s))*.09*mag;
  vec3 c=mix(mix(vec3(.6,.75,1.),vec3(1.,.8,.6),h21(id+seed+4.)),vec3(1.),.2);
  float tw=1.-.26*(.5+.5*sin(uT*(.8+2.6*b)+r*60.));
  return c*(core*(.1+1.5*mag)+halo)*gain*fade*tw;
}

float meteor(vec2 p,vec4 m,float a){
  if(a<=0.) return 0.;
  vec2 tail=m.xy-m.zw*.32, pa=p-tail, ba=m.xy-tail;
  float t=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);
  float d=length(pa-ba*t);
  return exp(-d*d/(.0000016*(.3+t)))*t*t*a;
}

void main(){
  float Up=min(uRes.x,uRes.y), Uc=Up/uScale;
  vec2 p=(gl_FragCoord.xy-.5*uRes)/Up;
  vec2 cssp=gl_FragCoord.xy/uScale;
  vec2 bgUv=clamp(vUv-uCam*.04,0.004,0.996);

  vec3 col=decodeBg(bgUv);
  if(uDim>0.01){
    vec2 sp=uBgTexel*(2.+4.*uDim);
    vec3 blur=(
      col*2.+
      decodeBg(clamp(bgUv+vec2(sp.x,sp.y),0.004,0.996))+
      decodeBg(clamp(bgUv+vec2(-sp.x,sp.y),0.004,0.996))+
      decodeBg(clamp(bgUv+vec2(sp.x,-sp.y),0.004,0.996))+
      decodeBg(clamp(bgUv+vec2(-sp.x,-sp.y),0.004,0.996))
    )/6.;
    col=mix(col,blur,uDim);
  }

  float band=texture2D(uBg,bgUv).a;
  float bm=.5+2.*band;
  float starGain=mix(1.,.65,uDim);
  col+=starLayer(cssp-uCam*Uc*.10,14.,.72,.5,.5*bm*starGain,1.);
  col+=starLayer(cssp-uCam*Uc*.18,26.,.70,.6,.9*starGain,2.);
  col+=starLayer(cssp-uCam*Uc*.30,50.,.62,.8,1.2*starGain,3.);
  col+=starLayer(cssp-uCam*Uc*.42,110.,.55,1.0,1.5*starGain,4.);

  col+=(meteor(p,uM0,uMa.x)+meteor(p,uM1,uMa.y))*vec3(.9,.95,1.)*(1.3*starGain);

  col=1.-exp(-col*1.4);
  col=pow(max(col,0.),vec3(.4545));
  col*=1.-.5*smoothstep(.45,1.3,length(p*vec2(1.,.55)));
  col*=mix(1.,.66,uDim);
  col+=(h21(gl_FragCoord.xy)-.5)/190.;
  gl_FragColor=vec4(clamp(col,0.,1.),1.);
}`;

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

interface MeteorState {
  x?: number;
  y?: number;
  dx?: number;
  dy?: number;
  life: number;
  max: number;
}

export interface SpaceSceneOptions {
  quality?: number;
  fps?: number;
}

function compileProgram(
  gl: WebGLRenderingContext,
  vertSrc: string,
  fragSrc: string
): WebGLProgram | null {
  const compile = (type: number, src: string): WebGLShader | null => {
    const s = gl.createShader(type);
    if (!s) return null;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  };
  const prog = gl.createProgram();
  const vs = compile(gl.VERTEX_SHADER, vertSrc);
  const fs = compile(gl.FRAGMENT_SHADER, fragSrc);
  if (!prog || !vs || !fs) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(prog));
    return null;
  }
  return prog;
}

export function createSpaceScene(
  canvas: HTMLCanvasElement,
  options: SpaceSceneOptions = {}
): { destroy: () => void; setDimmed: (dimmed: boolean) => void } {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gl = canvas.getContext('webgl', {
    antialias: false,
    alpha: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: true,
    powerPreference: 'low-power',
  });
  if (!gl) {
    canvas.style.background = '#020611';
    return { destroy() {}, setDimmed() {} };
  }

  const bgProg = compileProgram(gl, VERT, BG_FRAG);
  const fgProg = compileProgram(gl, VERT, FG_FRAG);
  if (!bgProg || !fgProg) {
    canvas.style.background = '#020611';
    return { destroy() {}, setDimmed() {} };
  }

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

  const bgLoc = gl.getAttribLocation(bgProg, 'a');
  const fgLoc = gl.getAttribLocation(fgProg, 'a');

  const UBgRes = gl.getUniformLocation(bgProg, 'uRes');
  const UBgGal = gl.getUniformLocation(bgProg, 'uGal');

  const UFg: Record<string, WebGLUniformLocation | null> = {};
  ['uBg', 'uBgTexel', 'uRes', 'uT', 'uScale', 'uDim', 'uCam', 'uM0', 'uM1', 'uMa'].forEach(
    (n) => {
      UFg[n] = gl.getUniformLocation(fgProg, n);
    }
  );

  const bgTex = gl.createTexture();
  const bgFbo = gl.createFramebuffer();
  let bgW = 1;
  let bgH = 1;

  gl.bindTexture(gl.TEXTURE_2D, bgTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindFramebuffer(gl.FRAMEBUFFER, bgFbo);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    bgTex,
    0
  );
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  // Fixed steady render scale (never mutated mid-stream so canvas buffer never resets/flickers)
  const scale = Math.min(window.devicePixelRatio || 1, 1.5) * (options.quality ?? 0.8);
  const baseFps = options.fps ?? 30;
  let minDt = 1 / baseFps - 0.002;
  let w = 1;
  let h = 1;
  let raf = 0;
  let last = 0;
  let time = reduce ? 40 : 0;
  let dimFactor = 0;
  let targetDim = 0;
  const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
  const meteors: [MeteorState, MeteorState] = [
    { life: 1, max: 1 },
    { life: 1, max: 1 },
  ];
  let nextMeteor = rand(4, 8);

  function bakeBackground() {
    if (!gl || !bgProg || !bgTex || !bgFbo) return;
    bgW = clamp(Math.round(w * 0.65), 480, 960);
    bgH = clamp(Math.round(h * 0.65), 360, 720);

    gl.bindTexture(gl.TEXTURE_2D, bgTex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      bgW,
      bgH,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, bgFbo);
    gl.viewport(0, 0, bgW, bgH);
    gl.useProgram(bgProg);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(bgLoc);
    gl.vertexAttribPointer(bgLoc, 2, gl.FLOAT, false, 0, 0);

    const Un = Math.min(w, h);
    const portrait = h > w;
    const wx = w / (2 * Un);
    const hy = h / (2 * Un);
    gl.uniform2f(UBgRes, bgW, bgH);
    gl.uniform3f(
      UBgGal,
      portrait ? -0.2 : -wx * 0.6,
      portrait ? hy * 0.55 : 0.24,
      portrait ? 0.12 : 0.1
    );
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  function draw() {
    if (!gl || !fgProg) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(fgProg);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(fgLoc);
    gl.vertexAttribPointer(fgLoc, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, bgTex);
    gl.uniform1i(UFg.uBg, 0);
    gl.uniform2f(UFg.uBgTexel, 1 / Math.max(1, bgW), 1 / Math.max(1, bgH));
    gl.uniform2f(UFg.uRes, canvas.width, canvas.height);
    gl.uniform1f(UFg.uT, time);
    gl.uniform1f(UFg.uScale, canvas.width / Math.max(1, w));
    gl.uniform1f(UFg.uDim, dimFactor);
    gl.uniform2f(
      UFg.uCam,
      ptr.x * 0.05 + Math.sin(time * 0.03) * 0.02,
      ptr.y * 0.05 + Math.cos(time * 0.025) * 0.015
    );
    const [a, b] = meteors;
    const al = (m: MeteorState) =>
      m.life < m.max ? Math.sin((m.life / m.max) * Math.PI) : 0;
    gl.uniform4f(UFg.uM0, a.x || 0, a.y || 0, a.dx || 0, a.dy || 0);
    gl.uniform4f(UFg.uM1, b.x || 0, b.y || 0, b.dx || 0, b.dy || 0);
    gl.uniform2f(UFg.uMa, reduce ? 0 : al(a), reduce ? 0 : al(b));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function resize() {
    if (!gl) return;
    const r = canvas.getBoundingClientRect();
    const nw = Math.max(1, r.width);
    const nh = Math.max(1, r.height);
    const bw = Math.max(1, Math.round(nw * scale));
    const bh = Math.max(1, Math.round(nh * scale));
    if (bw === canvas.width && bh === canvas.height && w > 1) return;
    w = nw;
    h = nh;
    canvas.width = bw;
    canvas.height = bh;
    bakeBackground();
    draw();
  }

  function spawn(m: MeteorState) {
    const a = Math.atan2(-0.62, -0.8) + rand(-0.25, 0.25);
    const Un = Math.min(w, h);
    const wx = w / (2 * Un);
    const hy = h / (2 * Un);
    m.x = rand(-wx * 0.2, wx);
    m.y = hy * rand(0.2, 1);
    m.dx = Math.cos(a);
    m.dy = Math.sin(a);
    m.life = 0;
    m.max = rand(0.8, 1.2);
  }

  function update(dt: number) {
    const k = Math.min(1, dt * 3);
    ptr.x += (ptr.tx - ptr.x) * k;
    ptr.y += (ptr.ty - ptr.y) * k;
    dimFactor += (targetDim - dimFactor) * Math.min(1, dt * 5);

    nextMeteor -= dt;
    if (nextMeteor <= 0) {
      const free = meteors.find((m) => m.life >= m.max);
      if (free) spawn(free);
      nextMeteor = rand(6, 12);
    }
    for (const m of meteors) {
      if (m.life < m.max) {
        m.life += dt;
        m.x = (m.x ?? 0) + (m.dx ?? 0) * 1.1 * dt;
        m.y = (m.y ?? 0) + (m.dy ?? 0) * 1.1 * dt;
      }
    }
  }

  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    const dt = (now - last) / 1000;
    if (dt < minDt) return;
    last = now;
    const step = Math.min(0.08, dt || 0.033);
    time += step;
    update(step);
    draw();
  }

  const start = () => {
    if (!reduce && !raf) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  };
  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };

  const onMove = (e: PointerEvent) => {
    ptr.tx = e.clientX / w - 0.5;
    ptr.ty = -(e.clientY / h - 0.5);
  };
  const onTilt = (e: DeviceOrientationEvent) => {
    if (e.gamma == null) return;
    ptr.tx = clamp(e.gamma / 40, -1, 1) * 0.5;
    ptr.ty = clamp(((e.beta ?? 45) - 45) / 40, -1, 1) * 0.5;
  };
  const onVis = () => (document.hidden ? stop() : start());

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('deviceorientation', onTilt, { passive: true });
  document.addEventListener('visibilitychange', onVis);
  resize();
  if (!reduce) start();

  return {
    setDimmed(dimmed: boolean) {
      targetDim = dimmed ? 1 : 0;
      minDt = 1 / (dimmed ? 12 : baseFps) - 0.002;
      if (reduce) {
        dimFactor = targetDim;
        draw();
      }
    },
    destroy() {
      stop();
      ro.disconnect();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('deviceorientation', onTilt);
      document.removeEventListener('visibilitychange', onVis);
      if (gl) {
        gl.deleteFramebuffer(bgFbo);
        gl.deleteTexture(bgTex);
        gl.deleteBuffer(buf);
        gl.deleteProgram(bgProg);
        gl.deleteProgram(fgProg);
      }
    },
  };
}
