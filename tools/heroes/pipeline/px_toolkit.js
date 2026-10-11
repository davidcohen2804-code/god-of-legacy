// PixVerse page toolkit: installed into the app.pixverse.ai tab via the browser javascript tool.
// Provides: __cap (XHR capture), __call(path, body), __upUrl(url, name, slot), __gen(opts), __status(id), __pull(url)
(function(){
  if (window.__pxInstalled) return 'already';
  window.__pxInstalled = true;
  window.__cap = [];
  const ox = XMLHttpRequest.prototype.open, os = XMLHttpRequest.prototype.send, oh = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.open = function(m, u){ this.__r = {m, u, h: {}}; return ox.apply(this, arguments); };
  XMLHttpRequest.prototype.setRequestHeader = function(k, v){ if (this.__r) this.__r.h[k] = v; return oh.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function(b){
    const r = this.__r;
    if (r && r.u.includes('app-api')) {
      r.b = typeof b === 'string' ? b.slice(0, 5000) : null;
      this.addEventListener('load', () => { r.resp = this.responseText.slice(0, 20000); });
      window.__cap.push(r);
    }
    return os.apply(this, arguments);
  };
  const tok = () => document.cookie.match(/_ai_token=([^;]+)/)[1];
  const H = () => ({ 'Accept': 'application/json, text/plain, */*', 'Accept-Language': 'en-US', 'Content-Type': 'application/json', 'Token': tok(), 'Workspace-Id': '0', 'X-Platform': 'Web', 'X-Device-ID': 'a82044c0-41de-4431-9029-ecb42b596076', 'Ai-Trace-Id': crypto.randomUUID() });
  window.__call = (u, b) => new Promise(res => {
    const x = new XMLHttpRequest(); x.open('POST', 'https://app-api.pixverse.ai/creative_platform' + u);
    for (const [k, v] of Object.entries(H())) x.setRequestHeader(k, v);
    x.timeout = 30000; x.onload = () => res(x.responseText); x.onerror = () => res('ERR ' + x.status); x.ontimeout = () => res('TIMEOUT');
    x.send(JSON.stringify(b));
  });
  // Upload an image reachable by URL through the page's own uploader (slot 0 = first frame input, 1 = last frame).
  window.__upUrl = async function(url, name, slot){
    const r = await fetch(url); if (!r.ok) return 'fetch ' + r.status;
    const blob = await r.blob(); const f = new File([blob], name, { type: blob.type || 'image/jpeg' });
    window.__cap.length = 0;
    const dt = new DataTransfer(); dt.items.add(f);
    const inp = document.querySelectorAll('input[type=file]')[slot || 0]; inp.files = dt.files;
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 500));
      const c = window.__cap.find(r => r.u.includes('batch_upload_media') && r.resp);
      if (c) { const x = JSON.parse(c.resp).Resp.result[0]; return { path: x.path, url: x.url, w: x.width, h: x.height }; }
    }
    return 'timeout';
  };
  // Transition (first+last frame) generation. opts: {first:{path,url}, last:{path,url}, prompt, quality:'360p'|'720p'|'1080p', seconds:5|8, seed}
  window.__gen = async function(o){
    const first = o.first, last = o.last || o.first;
    const body = { create_mode: 'transition', model: 'v6', prompts: [o.prompt], durations: [o.seconds || 5], duration: o.seconds || 5, quality: o.quality || '360p',
      customer_img_paths: [first.path, last.path], customer_img_urls: [first.url, last.url],
      customer_first_frame: first.path, customer_first_frame_url: first.url, customer_last_frame: last.path, customer_last_frame_url: last.url,
      seed: o.seed || Math.floor(Math.random() * 2147483647), create_count: 1, audio: 0, multi_shot: 0, off_peak: 0, preview_mode: 0, platform: 'web',
      negative_prompt: o.negative || '', camera_movement: '', motion_mode: '', lora_weight: 0, auto_character_prompt: 0, use_api_gen_image: false };
    const r = JSON.parse(await window.__call('/video/frames', body));
    return r.Resp ? { id: r.Resp.video_id, cost: r.Resp.cost_credits } : r;
  };
  // Image-to-video (single image). opts: {img:{path,url}, prompt, quality, seconds, seed}
  window.__genI2v = async function(o){
    const body = { create_mode: 'image_text', model: 'v6', prompt: o.prompt, duration: o.seconds || 5, quality: o.quality || '360p',
      customer_img_path: o.img.path, customer_img_url: o.img.url, img_id: 0,
      seed: o.seed || Math.floor(Math.random() * 2147483647), create_count: 1, audio: 0, multi_shot: 0, off_peak: 0, preview_mode: 0, platform: 'web',
      negative_prompt: o.negative || '', camera_movement: '', motion_mode: '', lora_weight: 0, auto_character_prompt: 0, use_api_gen_image: false };
    const r = JSON.parse(await window.__call('/video/i2v', body));
    return r.Resp ? { id: r.Resp.video_id, cost: r.Resp.cost_credits } : r;
  };
  window.__status = async function(id){
    const r = JSON.parse(await window.__call('/video/list/detail', { video_id: id })); const d = r.Resp || {};
    return { status: d.video_status, url: d.url, err: r.ErrMsg };
  };
  // Wait up to ~40s for a job; returns status/url.
  window.__wait = async function(id){
    for (let i = 0; i < 8; i++) { const s = await window.__status(id); if (s.status === 1 && s.url) return s; await new Promise(r => setTimeout(r, 5000)); }
    return await window.__status(id);
  };
  // Fetch a video into memory as base64 (window.__vid) and report the size.
  window.__pull = async function(url){
    const r = await fetch(url); const buf = new Uint8Array(await r.arrayBuffer()); let s = '';
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    window.__vid = btoa(s); return { bytes: buf.length, b64: window.__vid.length };
  };
  window.__credits = async () => JSON.parse(await window.__call('/user/credits', {})).Resp.credit_package;
  return 'installed';
})();
