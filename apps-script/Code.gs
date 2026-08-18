/**
 * BRAND RISE — Client Request Portal
 * Google Apps Script backend (Web App API)
 * ---------------------------------------------------------------
 * 1) Open your Google Sheet  ->  Extensions  ->  Apps Script
 * 2) Paste this file, then set SHEET_ID below (or leave '' if the
 *    script is bound to the sheet itself).
 * 3) Run  initSheets()  once  -> it builds every tab + demo data.
 * 4) Deploy -> New deployment -> Web app
 *       Execute as:      Me
 *       Who has access:  Anyone
 *    Copy the /exec URL into config.js in the website.
 * ---------------------------------------------------------------
 */

const SHEET_ID = ''; // '' = bound spreadsheet, otherwise paste the ID from the sheet URL
const TOKEN_TTL_HOURS = 12;
const TZ = 'Africa/Cairo';

const TABS = {
  users: 'Users',
  companies: 'Companies',
  channels: 'SalesChannels',
  branches: 'Branches',
  urgency: 'Urgency',
  requests: 'Requests',
  log: 'ActivityLog'
};

/* ============================ ROUTER ============================ */

function doPost(e) {
  var body = {};
  try { body = JSON.parse(e.postData.contents); } catch (err) { body = {}; }
  return json_(handle_(body));
}

// GET is used as a JSONP fallback (?action=...&payload={...}&callback=fn)
function doGet(e) {
  var p = e.parameter || {};
  var body = {};
  try { body = p.payload ? JSON.parse(p.payload) : {}; } catch (err) { body = {}; }
  body.action = p.action || body.action;
  var out = handle_(body);
  if (p.callback) {
    return ContentService
      .createTextOutput(p.callback + '(' + JSON.stringify(out) + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return json_(out);
}

function handle_(body) {
  try {
    switch (String(body.action || '')) {
      case 'ping':          return ok_({ time: now_() });
      case 'login':         return apiLogin_(body);
      case 'bootstrap':     return apiBootstrap_(body);
      case 'submit':        return apiSubmit_(body);
      case 'myRequests':    return apiMyRequests_(body);
      case 'allRequests':   return apiAllRequests_(body);
      case 'updateRequest': return apiUpdateRequest_(body);
      default:              return err_('Unknown action');
    }
  } catch (ex) {
    return err_(ex && ex.message ? ex.message : String(ex));
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
function ok_(data)  { var o = { ok: true };  for (var k in data) o[k] = data[k]; return o; }
function err_(msg)  { return { ok: false, error: msg }; }

/* ============================ API ============================ */

function apiLogin_(body) {
  var username = String(body.username || '').trim().toLowerCase();
  var password = String(body.password || '');
  if (!username || !password) return err_('اكتب اسم المستخدم وكلمة المرور');

  var users = readTab_(TABS.users);
  var user = null;
  for (var i = 0; i < users.length; i++) {
    if (String(users[i].username || '').trim().toLowerCase() === username) { user = users[i]; break; }
  }
  if (!user) return err_('بيانات الدخول غير صحيحة');
  if (String(user.active || 'yes').toLowerCase() === 'no') return err_('الحساب موقوف. كلّم فريق Brand Rise');
  if (!checkPassword_(password, String(user.password || ''))) return err_('بيانات الدخول غير صحيحة');

  var role = String(user.role || 'client').trim().toLowerCase();
  var allowed = parseList_(user.companies);
  var token = makeToken_(username, role, allowed);

  logActivity_(username, 'login', '');
  return ok_({
    token: token,
    user: {
      username: username,
      name: user.full_name || username,
      email: user.email || '',
      role: role
    }
  });
}

function apiBootstrap_(body) {
  var s = auth_(body.token);
  if (!s.ok) return s;

  var all = readTab_(TABS.companies).filter(activeRow_);
  var companies = all.filter(function (c) {
    return s.role === 'admin' || allows_(s.companies, c.code);
  }).map(function (c) {
    return {
      code: String(c.code).trim(),
      name: c.name_en || c.code,
      name_ar: c.name_ar || '',
      logo: c.logo_url || '',
      color: c.color || '#D9A62E'
    };
  });

  var channels = readTab_(TABS.channels).filter(activeRow_).map(function (r) {
    return { company: String(r.company_code || 'ALL').trim(), value: String(r.channel || '').trim() };
  }).filter(function (r) { return r.value; });

  var branches = readTab_(TABS.branches).filter(activeRow_).map(function (r) {
    return { company: String(r.company_code || 'ALL').trim(), value: String(r.branch || '').trim() };
  }).filter(function (r) { return r.value; });

  var urgency = readTab_(TABS.urgency).filter(activeRow_).map(function (r) {
    return {
      value: String(r.level || '').trim(),
      sla: Number(r.sla_days || 0),
      color: r.color || '#8B909A'
    };
  }).filter(function (r) { return r.value; });

  return ok_({ companies: companies, channels: channels, branches: branches, urgency: urgency });
}

function apiSubmit_(body) {
  var s = auth_(body.token);
  if (!s.ok) return s;

  var p = body.payload || {};
  var required = ['company', 'sales_channel', 'request', 'branch', 'urgency'];
  for (var i = 0; i < required.length; i++) {
    if (!String(p[required[i]] || '').trim()) return err_('ناقص: ' + required[i]);
  }
  if (s.role !== 'admin' && !allows_(s.companies, p.company)) {
    return err_('غير مسموح لك بالطلب لهذه الشركة');
  }

  var companies = readTab_(TABS.companies);
  var cname = p.company;
  for (var j = 0; j < companies.length; j++) {
    if (String(companies[j].code).trim() === String(p.company).trim()) {
      cname = companies[j].name_en || p.company;
      break;
    }
  }

  var sh = sheet_(TABS.requests);
  var id = nextId_(sh);
  sh.appendRow([
    id,
    new Date(),
    s.username,
    p.requester_name || s.username,
    p.company,
    cname,
    p.sales_channel,
    p.request,
    p.branch,
    p.urgency,
    p.due_date || '',
    p.note || '',
    'New',
    '',
    new Date()
  ]);

  logActivity_(s.username, 'submit', id);
  return ok_({ id: id });
}

function apiMyRequests_(body) {
  var s = auth_(body.token);
  if (!s.ok) return s;
  var rows = readTab_(TABS.requests).filter(function (r) {
    return String(r.username || '').toLowerCase() === s.username;
  });
  return ok_({ rows: rows.map(cleanRequest_).reverse() });
}

function apiAllRequests_(body) {
  var s = auth_(body.token);
  if (!s.ok) return s;
  if (s.role !== 'admin') return err_('لوحة التحكم للأدمن فقط');
  var rows = readTab_(TABS.requests).map(cleanRequest_).reverse();
  return ok_({ rows: rows });
}

function apiUpdateRequest_(body) {
  var s = auth_(body.token);
  if (!s.ok) return s;
  if (s.role !== 'admin') return err_('التعديل للأدمن فقط');

  var id = String(body.id || '').trim();
  var sh = sheet_(TABS.requests);
  var values = sh.getDataRange().getValues();
  var head = values[0].map(normKey_);
  var cId = head.indexOf('request_id');
  var cStatus = head.indexOf('status');
  var cAssignee = head.indexOf('assignee');
  var cUpdated = head.indexOf('updated_at');

  for (var i = 1; i < values.length; i++) {
    if (String(values[i][cId]).trim() === id) {
      if (body.status)   sh.getRange(i + 1, cStatus + 1).setValue(body.status);
      if (body.assignee !== undefined) sh.getRange(i + 1, cAssignee + 1).setValue(body.assignee);
      sh.getRange(i + 1, cUpdated + 1).setValue(new Date());
      logActivity_(s.username, 'update:' + (body.status || ''), id);
      return ok_({ id: id });
    }
  }
  return err_('الطلب غير موجود');
}

/* ============================ AUTH ============================ */

function secret_() {
  var props = PropertiesService.getScriptProperties();
  var v = props.getProperty('TOKEN_SECRET');
  if (!v) {
    v = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty('TOKEN_SECRET', v);
  }
  return v;
}

function makeToken_(username, role, companies) {
  var payload = {
    u: username,
    r: role,
    c: companies,
    exp: Date.now() + TOKEN_TTL_HOURS * 3600 * 1000
  };
  var raw = Utilities.base64EncodeWebSafe(JSON.stringify(payload));
  var sig = Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(raw, secret_())
  );
  return raw + '.' + sig;
}

function auth_(token) {
  token = String(token || '');
  var parts = token.split('.');
  if (parts.length !== 2) return err_('انتهت الجلسة، سجّل دخول تاني');
  var expected = Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(parts[0], secret_())
  );
  if (expected !== parts[1]) return err_('جلسة غير صالحة');
  var payload;
  try {
    payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString());
  } catch (e) { return err_('جلسة غير صالحة'); }
  if (!payload.exp || Date.now() > payload.exp) return err_('انتهت الجلسة، سجّل دخول تاني');
  return { ok: true, username: payload.u, role: payload.r, companies: payload.c || [] };
}

/** Passwords: plain text, or  sha256:<hex>  — use hashPassword() to generate. */
function checkPassword_(input, stored) {
  stored = String(stored);
  if (stored.indexOf('sha256:') === 0) return sha256_(input) === stored.substring(7);
  return input === stored;
}

function sha256_(txt) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, txt, Utilities.Charset.UTF_8);
  return bytes.map(function (b) {
    var v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

/** Helper: run manually to convert a password into a hash you can paste in the sheet. */
function hashPassword() {
  var pw = 'change-me';
  Logger.log('sha256:' + sha256_(pw));
}

/* ============================ SHEET HELPERS ============================ */

function ss_() { return SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet(); }

function sheet_(name) {
  var sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('التاب "' + name + '" غير موجود. شغّل initSheets()');
  return sh;
}

function normKey_(k) { return String(k).trim().toLowerCase().replace(/\s+/g, '_'); }

function readTab_(name) {
  var values = sheet_(name).getDataRange().getValues();
  if (values.length < 2) return [];
  var head = values[0].map(normKey_);
  var out = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (row.join('').trim() === '') continue;
    var obj = {};
    for (var c = 0; c < head.length; c++) if (head[c]) obj[head[c]] = row[c];
    out.push(obj);
  }
  return out;
}

function activeRow_(r) { return String(r.active === undefined ? 'yes' : r.active).trim().toLowerCase() !== 'no'; }

function parseList_(v) {
  return String(v || '').split(/[,;|]/).map(function (x) { return x.trim(); }).filter(Boolean);
}

function allows_(list, code) {
  if (!list || !list.length) return false;
  for (var i = 0; i < list.length; i++) {
    if (list[i].toUpperCase() === 'ALL') return true;
    if (list[i].toUpperCase() === String(code).trim().toUpperCase()) return true;
  }
  return false;
}

function cleanRequest_(r) {
  return {
    id: String(r.request_id || ''),
    created: fmt_(r.timestamp),
    username: r.username || '',
    requester: r.requester_name || '',
    company: r.company_code || '',
    company_name: r.company_name || '',
    channel: r.sales_channel || '',
    request: r.request || '',
    branch: r.branch || '',
    urgency: r.urgency || '',
    due: fmtDate_(r.due_date),
    note: r.note || '',
    status: r.status || 'New',
    assignee: r.assignee || '',
    updated: fmt_(r.updated_at)
  };
}

function fmt_(d) {
  if (!d) return '';
  if (Object.prototype.toString.call(d) === '[object Date]') return Utilities.formatDate(d, TZ, 'yyyy-MM-dd HH:mm');
  return String(d);
}
function fmtDate_(d) {
  if (!d) return '';
  if (Object.prototype.toString.call(d) === '[object Date]') return Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
  return String(d);
}
function now_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss'); }

function nextId_(sh) {
  var last = sh.getLastRow();
  var n = Math.max(0, last - 1) + 1;
  return 'BR-' + Utilities.formatDate(new Date(), TZ, 'yyMM') + '-' + ('000' + n).slice(-4);
}

function logActivity_(user, action, ref) {
  try {
    sheet_(TABS.log).appendRow([new Date(), user, action, ref]);
  } catch (e) { /* log tab is optional */ }
}

/* ============================ ONE-TIME SETUP ============================ */

function initSheets() {
  var ss = ss_();

  build_(ss, TABS.users,
    ['username', 'password', 'full_name', 'email', 'role', 'companies', 'active'],
    [
      ['admin',   'admin123', 'Brand Rise Ops', 'ops@brandrise.co',    'admin',  'ALL',      'yes'],
      ['carehub', 'care123',  'CareHub Team',   'team@carehub.com',    'client', 'CH',       'yes'],
      ['eep',     'eep123',   'EEP Team',       'team@eep.com',        'client', 'EEP',      'yes'],
      ['vcrest',  'vc123',    'ValueCrest Team','team@valuecrest.com', 'client', 'VC,CH',    'yes']
    ]);

  build_(ss, TABS.companies,
    ['code', 'name_en', 'name_ar', 'logo_url', 'color', 'active'],
    [
      ['CH',  'CareHub',    'كير هب',      'assets/logos/carehub.png',    '#E39B54', 'yes'],
      ['EEP', 'Enterprise Excellence Partners', 'إنتربرايز إكسيلنس', 'assets/logos/eep.png', '#D9A62E', 'yes'],
      ['VC',  'ValueCrest', 'فاليو كريست', 'assets/logos/valuecrest.png', '#C9A227', 'yes']
    ]);

  build_(ss, TABS.channels,
    ['company_code', 'channel', 'active'],
    [
      ['ALL', 'Facebook',  'yes'],
      ['ALL', 'Instagram', 'yes'],
      ['ALL', 'TikTok',    'yes'],
      ['ALL', 'WhatsApp',  'yes'],
      ['ALL', 'Call Center', 'yes'],
      ['ALL', 'Website',   'yes'],
      ['CH',  'Referral Doctors', 'yes'],
      ['VC',  'Direct Sales', 'yes']
    ]);

  build_(ss, TABS.branches,
    ['company_code', 'branch', 'active'],
    [
      ['ALL', 'Head Office', 'yes'],
      ['CH',  'Nasr City',   'yes'],
      ['CH',  'Maadi',       'yes'],
      ['CH',  'Alexandria',  'yes'],
      ['EEP', 'New Cairo',   'yes'],
      ['EEP', 'Sheikh Zayed','yes'],
      ['VC',  'Downtown',    'yes']
    ]);

  build_(ss, TABS.urgency,
    ['level', 'sla_days', 'color', 'active'],
    [
      ['Low',      7, '#6E7683', 'yes'],
      ['Normal',   4, '#4C8BF5', 'yes'],
      ['High',     2, '#E39B54', 'yes'],
      ['Critical', 1, '#E05B4B', 'yes']
    ]);

  build_(ss, TABS.requests,
    ['request_id', 'timestamp', 'username', 'requester_name', 'company_code', 'company_name',
     'sales_channel', 'request', 'branch', 'urgency', 'due_date', 'note', 'status', 'assignee', 'updated_at'],
    []);

  build_(ss, TABS.log, ['timestamp', 'user', 'action', 'ref'], []);

  SpreadsheetApp.getUi && SpreadsheetApp.getActive().toast('تم إنشاء كل التابات ✅');
}

function build_(ss, name, headers, rows) {
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    if (rows.length) sh.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
  sh.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold').setBackground('#111111').setFontColor('#E8C05A');
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, headers.length);
}
