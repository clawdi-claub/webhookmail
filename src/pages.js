var BASE_URL = process.env.BASE_URL || 'https://webhookmail.onrender.com';

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ── SVG Icons (Lucide-style, 24x24 viewBox) ── */
var icons = {
  link: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  mail: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>',
  barChart: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/></svg>',
  shield: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>',
  zap: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>',
  code: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
  arrowRight: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>',
  check: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  copy: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>',
  arrowLeft: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>',
  webhook: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17c.01-.7.2-1.4.57-2"/><path d="m6 17 3.13-5.78c.53-.97.1-2.18-.5-3.1a4 4 0 1 1 6.89-4.06"/><path d="m12 6 3.13 5.73C15.66 12.7 16.9 13 18 13a4 4 0 0 1 0 8H12"/></svg>',
};

/* ── Shared CSS variables & resets ── */
var sharedCSS = [
  '@import url("https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap");',
  '*{margin:0;padding:0;box-sizing:border-box}',
  ':root{',
  '  --bg:#0F172A;--bg-elevated:#1E293B;--surface:#1E293B;--surface-hover:#334155;',
  '  --border:#334155;--border-hover:#475569;',
  '  --text:#F8FAFC;--text-secondary:#CBD5E1;--muted:#94A3B8;--dim:#64748B;',
  '  --accent:#22C55E;--accent-hover:#16A34A;--accent-glow:rgba(34,197,94,0.15);',
  '  --indigo:#818CF8;--indigo-hover:#6366F1;',
  '  --radius:12px;--radius-lg:16px;--radius-sm:8px;',
  '}',
  'body{font-family:"Plus Jakarta Sans",system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--text);-webkit-font-smoothing:antialiased;line-height:1.6}',
  'a{color:var(--indigo);text-decoration:none;transition:color 0.2s}',
  'a:hover{color:var(--text)}',
  '@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:0.01ms!important;transition-duration:0.01ms!important}}',
  '',
  '/* Focus */  ',
  ':focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:4px}',
  '',
  '/* Scrollbar */  ',
  '::-webkit-scrollbar{width:6px;height:6px}',
  '::-webkit-scrollbar-track{background:transparent}',
  '::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}',
  '::-webkit-scrollbar-thumb:hover{background:var(--border-hover)}',
].join('\n');

export function landingPage() {
  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>WebhookMail - Forward Webhooks to Email Instantly | Free Webhook to Email</title>
<meta name="description" content="Forward any webhook to your email inbox instantly. No code required. Free tier with 50 webhooks/month. Works with Stripe, GitHub, Shopify, and any webhook source.">
<meta name="keywords" content="webhook to email, webhook forwarder, webhook notifications, webhook monitor, stripe webhook email, github webhook email">
<meta property="og:title" content="WebhookMail - Forward Webhooks to Email Instantly">
<meta property="og:description" content="Forward any webhook to your email. Instant setup, no code required. Free tier included.">
<meta property="og:type" content="website">
<meta property="og:url" content="${BASE_URL}">
<meta name="twitter:card" content="summary">
<link rel="canonical" href="${BASE_URL}">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="manifest" href="/manifest.json">
<style>
${sharedCSS}

/* ── Nav ── */
.nav{position:fixed;top:0;left:0;right:0;z-index:50;padding:0 20px}
.nav-inner{max-width:1080px;margin:16px auto 0;background:rgba(15,23,42,0.85);backdrop-filter:blur(12px);border:1px solid var(--border);border-radius:var(--radius);padding:12px 24px;display:flex;align-items:center;justify-content:space-between}
.nav-brand{font-weight:800;font-size:17px;display:flex;align-items:center;gap:8px;color:var(--text)}
.nav-brand svg{color:var(--accent)}
.nav-links{display:flex;gap:24px;align-items:center}
.nav-links a{color:var(--muted);font-size:14px;font-weight:500;transition:color 0.2s}
.nav-links a:hover{color:var(--text)}
.nav-cta{background:var(--accent);color:var(--bg);padding:8px 18px;border-radius:var(--radius-sm);font-weight:700;font-size:13px;cursor:pointer;border:none;transition:background 0.2s,transform 0.1s}
.nav-cta:hover{background:var(--accent-hover);color:var(--bg);transform:translateY(-1px)}

/* ── Hero ── */
.hero{text-align:center;padding:140px 20px 64px;position:relative;overflow:hidden}
.hero::before{content:"";position:absolute;top:-200px;left:50%;transform:translateX(-50%);width:600px;height:600px;background:radial-gradient(circle,rgba(34,197,94,0.06) 0%,transparent 70%);pointer-events:none}
.badge{display:inline-flex;align-items:center;gap:6px;padding:6px 16px;background:var(--accent-glow);border:1px solid rgba(34,197,94,0.2);border-radius:20px;font-size:13px;font-weight:600;color:var(--accent);margin-bottom:28px}
.badge svg{width:14px;height:14px}
.hero h1{font-size:clamp(2.4rem,5vw,3.6rem);font-weight:800;line-height:1.1;margin-bottom:18px;letter-spacing:-0.03em;color:var(--text)}
.hero h1 .highlight{color:var(--accent)}
.hero .sub{font-size:clamp(1rem,2vw,1.15rem);color:var(--muted);max-width:480px;margin:0 auto 0;line-height:1.7}

/* ── Form ── */
.form-section{max-width:460px;margin:48px auto 0;padding:0 20px}
.form-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:28px;position:relative}
.form-card::before{content:"";position:absolute;inset:-1px;border-radius:var(--radius-lg);background:linear-gradient(135deg,rgba(34,197,94,0.1),transparent 60%);z-index:-1;pointer-events:none}
.form-card input{width:100%;padding:13px 16px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg);color:var(--text);font-size:15px;font-family:inherit;margin-bottom:12px;transition:border-color 0.2s,box-shadow 0.2s}
.form-card input:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-glow)}
.form-card input::placeholder{color:var(--dim)}
.cta-btn{width:100%;padding:14px;background:var(--accent);color:var(--bg);border:none;border-radius:var(--radius-sm);font-size:15px;font-weight:700;font-family:inherit;cursor:pointer;transition:background 0.2s,transform 0.1s;display:flex;align-items:center;justify-content:center;gap:8px}
.cta-btn:hover{background:var(--accent-hover);transform:translateY(-1px)}
.cta-btn:active{transform:translateY(0)}
.cta-btn:disabled{opacity:0.6;cursor:not-allowed;transform:none}
.result{display:none;margin-top:20px;padding:20px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);animation:fadeIn 0.3s ease}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.result-label{font-size:11px;color:var(--dim);text-transform:uppercase;letter-spacing:0.8px;font-weight:700;margin-bottom:6px}
.result-url{display:flex;align-items:center;gap:8px;margin-bottom:16px}
.result-url code{flex:1;color:var(--accent);word-break:break-all;font-size:13px;font-family:"SF Mono",SFMono-Regular,Consolas,monospace}
.copy-btn{background:var(--surface);border:1px solid var(--border);color:var(--text);padding:6px 12px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;transition:background 0.2s;display:flex;align-items:center;gap:4px;white-space:nowrap}
.copy-btn:hover{background:var(--surface-hover)}
.copy-btn.copied{background:var(--accent);border-color:var(--accent);color:var(--bg)}
.form-note{font-size:12px;color:var(--dim);text-align:center;margin-top:14px;font-weight:500}

/* ── Integrations ── */
.integrations{text-align:center;padding:64px 20px 48px}
.integrations p{color:var(--dim);font-size:12px;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin-bottom:20px}
.logos{display:flex;gap:32px;justify-content:center;flex-wrap:wrap;align-items:center}
.logos span{font-size:14px;font-weight:600;color:var(--dim);opacity:0.6;transition:opacity 0.2s}
.logos span:hover{opacity:1}

/* ── How it works ── */
.how{max-width:640px;margin:0 auto;padding:80px 20px}
.section-title{text-align:center;font-size:clamp(1.6rem,3vw,2rem);font-weight:800;margin-bottom:48px;letter-spacing:-0.02em}
.step{display:flex;gap:20px;margin-bottom:36px;align-items:flex-start}
.step-num{background:var(--accent);color:var(--bg);width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;flex-shrink:0}
.step-content h4{font-size:16px;margin-bottom:4px;font-weight:700;color:var(--text)}
.step-content p{color:var(--muted);font-size:14px;line-height:1.6}

/* ── Features ── */
.features{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;max-width:880px;margin:0 auto 80px;padding:0 20px}
@media(max-width:768px){.features{grid-template-columns:1fr}}
@media(min-width:769px) and (max-width:1024px){.features{grid-template-columns:repeat(2,1fr)}}
.feat{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:24px;transition:border-color 0.2s,transform 0.2s;cursor:default}
.feat:hover{border-color:var(--border-hover);transform:translateY(-2px)}
.feat-icon{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;margin-bottom:14px;color:var(--accent);background:var(--accent-glow)}
.feat h3{font-size:15px;font-weight:700;margin-bottom:6px;color:var(--text)}
.feat p{color:var(--muted);font-size:13px;line-height:1.6}

/* ── Pricing ── */
.pricing{text-align:center;padding:80px 20px}
.pricing .sub{color:var(--muted);margin-bottom:48px;font-size:15px}
.plans{display:flex;gap:24px;justify-content:center;flex-wrap:wrap}
.plan{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:32px;width:320px;text-align:left;transition:border-color 0.2s,transform 0.2s}
.plan:hover{transform:translateY(-2px)}
.plan.pro{border-color:var(--accent);position:relative}
.plan.pro::after{content:"POPULAR";position:absolute;top:-11px;right:20px;background:var(--accent);color:var(--bg);font-size:11px;font-weight:800;padding:4px 12px;border-radius:6px;letter-spacing:0.5px}
.plan h3{font-size:1.15rem;margin-bottom:4px;font-weight:700}
.plan .price{font-size:2.8rem;font-weight:800;color:var(--accent);margin-bottom:2px;letter-spacing:-0.02em}
.plan .period{color:var(--dim);font-size:13px;margin-bottom:24px;font-weight:500}
.plan ul{list-style:none;margin-bottom:28px}
.plan li{padding:7px 0;color:var(--text-secondary);font-size:14px;display:flex;align-items:center;gap:10px}
.plan li svg{color:var(--accent);flex-shrink:0}
.plan-btn{display:block;width:100%;padding:13px;border-radius:var(--radius-sm);text-align:center;font-weight:700;font-size:14px;cursor:pointer;text-decoration:none;transition:all 0.2s;border:none;font-family:inherit}
.plan-btn.free{background:var(--bg);border:1px solid var(--border);color:var(--text)}
.plan-btn.free:hover{border-color:var(--border-hover);background:var(--surface-hover)}
.plan-btn.pro-btn{background:var(--accent);color:var(--bg)}
.plan-btn.pro-btn:hover{background:var(--accent-hover);transform:translateY(-1px)}

/* ── Footer ── */
footer{text-align:center;padding:48px 20px;border-top:1px solid var(--border);color:var(--dim);font-size:13px;font-weight:500}
footer a{color:var(--muted);text-decoration:none}

/* ── Mobile ── */
@media(max-width:640px){
  .nav-links a:not(.nav-cta){display:none}
  .hero{padding:120px 20px 48px}
  .plans{flex-direction:column;align-items:center}
  .plan{width:100%;max-width:360px}
  .logos{gap:20px}
  .step{gap:14px}
}
</style></head><body>

<nav class="nav">
<div class="nav-inner">
  <a href="/" class="nav-brand">${icons.webhook} WebhookMail</a>
  <div class="nav-links">
    <a href="#how">How it Works</a>
    <a href="#pricing">Pricing</a>
    <button class="nav-cta" onclick="document.getElementById('e').focus()">Get Started</button>
  </div>
</div>
</nav>

<div class="hero">
<div class="badge">${icons.zap} No code. No server. No signup.</div>
<h1>Forward <span class="highlight">webhooks</span><br>to your email</h1>
<p class="sub">Get instant email notifications for every webhook. Works with any service. Set up in 10 seconds.</p>
</div>

<div class="form-section">
<div class="form-card" id="f">
<input type="email" id="e" placeholder="your@email.com" required autocomplete="email" aria-label="Email address">
<input type="text" id="n" placeholder="Endpoint name (optional)" autocomplete="off" aria-label="Endpoint name">
<button class="cta-btn" id="btn" onclick="go()">Create Free Endpoint ${icons.arrowRight}</button>
<div class="result" id="r">
  <div class="result-label">Webhook URL</div>
  <div class="result-url"><code id="wu"></code><button class="copy-btn" id="cb" onclick="copyUrl()" aria-label="Copy webhook URL">${icons.copy} Copy</button></div>
  <div class="result-label">Dashboard</div>
  <div class="result-url"><code id="du"></code></div>
</div>
<p class="form-note">Free: 50 webhooks/month. No credit card required.</p>
</div>
</div>

<div class="integrations">
<p>Works with any webhook source</p>
<div class="logos"><span>Stripe</span><span>GitHub</span><span>Shopify</span><span>Slack</span><span>Twilio</span><span>Zapier</span><span>Linear</span></div>
</div>

<div class="how" id="how">
<h2 class="section-title">How It Works</h2>
<div class="step"><div class="step-num">1</div><div class="step-content"><h4>Create an endpoint</h4><p>Enter your email and get a unique webhook URL. Takes 10 seconds.</p></div></div>
<div class="step"><div class="step-num">2</div><div class="step-content"><h4>Point your service</h4><p>Use the URL as a webhook destination in Stripe, GitHub, Slack, or any service.</p></div></div>
<div class="step"><div class="step-num">3</div><div class="step-content"><h4>Get email notifications</h4><p>Every webhook hit sends a formatted email with the full payload, headers, and metadata.</p></div></div>
</div>

<div class="features">
<div class="feat"><div class="feat-icon">${icons.link}</div><h3>Universal Compatibility</h3><p>Works with any HTTP webhook. POST, PUT, GET — all methods supported.</p></div>
<div class="feat"><div class="feat-icon">${icons.mail}</div><h3>Formatted Emails</h3><p>Clean, readable emails with syntax-highlighted JSON payloads and request metadata.</p></div>
<div class="feat"><div class="feat-icon">${icons.barChart}</div><h3>Live Dashboard</h3><p>View webhook history, inspect payloads, and track monthly usage in real time.</p></div>
<div class="feat"><div class="feat-icon">${icons.shield}</div><h3>No Signup Required</h3><p>Just enter your email. No accounts, no passwords, no OAuth. Start in seconds.</p></div>
<div class="feat"><div class="feat-icon">${icons.zap}</div><h3>Instant Delivery</h3><p>Webhooks are processed and forwarded to your email in under 2 seconds.</p></div>
<div class="feat"><div class="feat-icon">${icons.code}</div><h3>Developer Friendly</h3><p>Full REST API. Create endpoints and query logs programmatically.</p></div>
</div>

<div class="pricing" id="pricing">
<h2 class="section-title">Simple Pricing</h2>
<p class="sub">Start free. Upgrade when you need more.</p>
<div class="plans">
<div class="plan">
<h3>Free</h3><div class="price">$0</div><div class="period">forever</div>
<ul>
  <li>${icons.check} 50 webhooks/month</li>
  <li>${icons.check} 1 endpoint</li>
  <li>${icons.check} Email forwarding</li>
  <li>${icons.check} 7-day log history</li>
  <li>${icons.check} Dashboard access</li>
</ul>
<a href="#" class="plan-btn free" onclick="document.getElementById('e').focus();return false">Get Started</a>
</div>
<div class="plan pro">
<h3>Pro</h3><div class="price">$3</div><div class="period">per month</div>
<ul>
  <li>${icons.check} Unlimited webhooks</li>
  <li>${icons.check} Unlimited endpoints</li>
  <li>${icons.check} Email forwarding</li>
  <li>${icons.check} 30-day log history</li>
  <li>${icons.check} Priority delivery</li>
  <li>${icons.check} Webhook replay</li>
</ul>
<button class="plan-btn pro-btn" disabled>Coming Soon</button>
</div>
</div>
</div>

<footer>
<p>WebhookMail &copy; 2026</p>
</footer>

<script>
async function go(){
var btn=document.getElementById("btn"),e=document.getElementById("e").value,n=document.getElementById("n").value;
if(!e){document.getElementById("e").focus();return}
btn.disabled=true;btn.innerHTML="Creating...";
try{
var r=await fetch("/api/endpoints",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:e,name:n})});
var d=await r.json();
if(d.error){alert(d.error);btn.disabled=false;btn.innerHTML='Create Free Endpoint ${icons.arrowRight}';return}
document.getElementById("wu").textContent=d.webhookUrl;
document.getElementById("du").innerHTML='<a href="'+d.dashboardUrl+'" style="color:var(--accent)">'+d.dashboardUrl+'</a>';
document.getElementById("r").style.display="block";
btn.innerHTML="${icons.check} Created!";btn.style.background="var(--accent)";
}catch(err){alert("Error: "+err.message);btn.disabled=false;btn.innerHTML='Create Free Endpoint ${icons.arrowRight}'}}
function copyUrl(){
var t=document.getElementById("wu").textContent,b=document.getElementById("cb");
navigator.clipboard.writeText(t);b.innerHTML='${icons.copy} Copied!';b.classList.add("copied");
setTimeout(function(){b.innerHTML='${icons.copy} Copy';b.classList.remove("copied")},2000)}
</script></body></html>`;
}

export function dashboardPage(endpoint, logs, monthly) {
  var rows = logs.map(function(l) {
    var body = l.body || '';
    try { body = JSON.stringify(JSON.parse(body), null, 2); } catch (e) {}
    return `<tr>
<td class="td"><span class="time">${esc(l.created_at)}</span></td>
<td class="td"><span class="method">${esc(l.method)}</span></td>
<td class="td"><span class="ip">${esc(l.source_ip)}</span></td>
<td class="td"><details><summary class="body-preview">${esc(body).slice(0, 80)}</summary><pre class="body-full">${esc(body)}</pre></details></td>
</tr>`;
  }).join('');

  var emptyRow = '<tr><td colspan="4" class="empty">No webhooks received yet. Send a request to the webhook URL above to get started.</td></tr>';

  var tierBadge = endpoint.tier === 'pro'
    ? '<span class="tier-badge pro">PRO</span>'
    : '<span class="tier-badge free">FREE</span>';

  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(endpoint.name || 'Dashboard')} - WebhookMail</title>
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<style>
${sharedCSS}

/* ── Dashboard Layout ── */
.wrap{max-width:1000px;margin:0 auto;padding:24px 20px}
.header{display:flex;align-items:center;gap:14px;margin-bottom:28px;flex-wrap:wrap}
.header h1{font-size:1.4rem;font-weight:800;letter-spacing:-0.01em}
.back{color:var(--muted);text-decoration:none;font-size:14px;font-weight:500;display:flex;align-items:center;gap:4px;transition:color 0.2s}
.back:hover{color:var(--text)}
.tier-badge{padding:3px 10px;border-radius:6px;font-size:11px;font-weight:800;letter-spacing:0.5px;text-transform:uppercase}
.tier-badge.pro{background:var(--accent);color:var(--bg)}
.tier-badge.free{background:var(--surface);border:1px solid var(--border);color:var(--muted)}

/* ── URL Bar ── */
.url-bar{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px 18px;margin-bottom:24px;font-family:"SF Mono",SFMono-Regular,Consolas,monospace;font-size:14px;color:var(--accent);word-break:break-all;display:flex;align-items:center;gap:12px}
.url-bar span{flex:1}
.url-bar .copy-btn{background:var(--bg);border:1px solid var(--border);color:var(--text);padding:6px 14px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;font-family:"Plus Jakarta Sans",system-ui,sans-serif;white-space:nowrap;display:flex;align-items:center;gap:4px;transition:background 0.2s}
.url-bar .copy-btn:hover{background:var(--surface-hover)}

/* ── Stats ── */
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin-bottom:32px}
.stat{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:18px}
.stat .label{color:var(--dim);font-size:11px;text-transform:uppercase;letter-spacing:0.8px;font-weight:700;margin-bottom:6px}
.stat .val{font-size:1.6rem;font-weight:800;color:var(--accent)}
.stat .val.sm{font-size:14px;color:var(--text-secondary);font-weight:600}

/* ── Table ── */
.table-section h2{font-size:1.1rem;margin-bottom:16px;font-weight:700}
.table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--border);border-radius:var(--radius)}
table{width:100%;border-collapse:collapse;min-width:560px}
th{text-align:left;padding:12px 14px;color:var(--dim);font-size:11px;text-transform:uppercase;letter-spacing:0.8px;font-weight:700;border-bottom:1px solid var(--border);background:var(--surface)}
.td{padding:12px 14px;border-bottom:1px solid var(--border);font-size:13px;vertical-align:top}
.time{color:var(--dim);font-size:12px}
.method{background:var(--accent);color:var(--bg);padding:2px 8px;border-radius:5px;font-size:11px;font-weight:700}
.ip{color:var(--dim);font-family:"SF Mono",Consolas,monospace;font-size:12px}
.body-preview{color:var(--muted);font-size:12px;cursor:pointer;font-family:"SF Mono",Consolas,monospace;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.body-full{margin-top:10px;font-size:12px;max-height:240px;overflow:auto;color:var(--text-secondary);white-space:pre-wrap;background:var(--bg);padding:12px;border-radius:var(--radius-sm);border:1px solid var(--border)}
.empty{padding:48px;text-align:center;color:var(--dim);font-size:14px}

/* ── Footer ── */
footer{text-align:center;margin-top:48px;padding:24px 0;border-top:1px solid var(--border);color:var(--dim);font-size:13px;font-weight:500}
footer a{color:var(--muted);text-decoration:none}

/* ── Mobile table cards ── */
@media(max-width:640px){
  .stats{grid-template-columns:repeat(2,1fr)}
  .url-bar{flex-direction:column;align-items:stretch;gap:10px}
  .url-bar .copy-btn{justify-content:center}
}
</style></head><body>
<div class="wrap">
<div class="header">
  <a href="/" class="back">${icons.arrowLeft} WebhookMail</a>
  <h1>${esc(endpoint.name || 'Webhook Dashboard')}</h1>
  ${tierBadge}
</div>
<div class="url-bar">
  <span>POST ${BASE_URL}/hook/${esc(endpoint.id)}</span>
  <button class="copy-btn" onclick="navigator.clipboard.writeText('${BASE_URL}/hook/${esc(endpoint.id)}');this.innerHTML='${icons.copy} Copied!';setTimeout(()=>this.innerHTML='${icons.copy} Copy',2000)" aria-label="Copy webhook URL">${icons.copy} Copy</button>
</div>
<div class="stats">
  <div class="stat"><div class="label">This Month</div><div class="val">${monthly}${endpoint.tier === 'free' ? '<span style="color:var(--dim);font-size:14px;font-weight:500"> / 50</span>' : ''}</div></div>
  <div class="stat"><div class="label">All Time</div><div class="val">${endpoint.webhook_count}</div></div>
  <div class="stat"><div class="label">Plan</div><div class="val sm">${esc(endpoint.tier).toUpperCase()}</div></div>
  <div class="stat"><div class="label">Email</div><div class="val sm">${esc(endpoint.email)}</div></div>
</div>
<div class="table-section">
  <h2>Recent Webhooks</h2>
  <div class="table-wrap">
  <table><thead><tr><th>Time</th><th>Method</th><th>Source</th><th>Body</th></tr></thead>
  <tbody>${rows || emptyRow}</tbody></table>
  </div>
</div>
<footer><a href="/">WebhookMail</a> &copy; 2026</footer>
</div></body></html>`;
}
