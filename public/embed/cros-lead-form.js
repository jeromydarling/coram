/**
 * cros-lead-form.js — Vanilla JS drop-in for non-React CROS-family apps.
 *
 * Usage in any HTML:
 *   <div data-cros-lead-form
 *        data-source-app="hortus"
 *        data-lead-kind="demo"
 *        data-form-variant="hero"
 *        data-fields="name,email,organization,message"
 *        data-submit-label="Get a demo"></div>
 *   <script src="https://thecros.app/embed/cros-lead-form.js" async defer></script>
 *
 * Same payload contract as the React component — same edge function.
 */

(function () {
  'use strict';

  var INTAKE_URL =
    (typeof window !== 'undefined' && window.CROS_INTAKE_URL) ||
    'https://zmeawjhxbgvtcfcfcygf.supabase.co/functions/v1/public-leads-intake';

  var FIELD_LABELS = {
    name: 'Your name',
    email: 'Email',
    organization: 'Organization',
    phone: 'Phone (optional)',
    message: 'How can we help?',
    interest: 'What are you interested in?',
    archetype: 'What best describes you?',
  };

  var FIELD_TYPES = {
    name: 'text',
    email: 'email',
    organization: 'text',
    phone: 'tel',
    message: 'textarea',
    interest: 'text',
    archetype: 'text',
  };

  function readUtms() {
    var out = {};
    try {
      var p = new URLSearchParams(window.location.search);
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(function (k) {
        var v = p.get(k);
        if (v) out[k] = v;
      });
      if (Object.keys(out).length === 0) {
        var raw = sessionStorage.getItem('cros_utms');
        if (raw) out = JSON.parse(raw);
      } else {
        sessionStorage.setItem('cros_utms', JSON.stringify(out));
      }
    } catch (e) { /* noop */ }
    return out;
  }

  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }

  function buildForm(host) {
    var sourceApp = host.getAttribute('data-source-app');
    var leadKind = host.getAttribute('data-lead-kind') || 'demo';
    var formVariant = host.getAttribute('data-form-variant') || null;
    var fieldsAttr = host.getAttribute('data-fields') || 'name,email,message';
    var submitLabel = host.getAttribute('data-submit-label') || 'Get a demo';
    var fields = fieldsAttr.split(',').map(function (s) { return s.trim(); }).filter(Boolean);

    if (!sourceApp) {
      host.innerHTML = '<p style="color:#b00">CROS lead form: missing data-source-app.</p>';
      return;
    }

    var form = el('form', { class: 'cros-lead-form', novalidate: 'novalidate' });
    form.style.display = 'flex';
    form.style.flexDirection = 'column';
    form.style.gap = '0.75rem';

    var inputs = {};
    fields.forEach(function (f) {
      var type = FIELD_TYPES[f] || 'text';
      var required = (f === 'name' || f === 'email');
      var label = el('label', { class: 'cros-lead-label', for: 'cros-lead-' + f });
      label.textContent = FIELD_LABELS[f] || f;
      label.style.fontSize = '0.875rem';
      label.style.fontWeight = '500';

      var input;
      if (type === 'textarea') {
        input = el('textarea', { id: 'cros-lead-' + f, name: f, rows: '4' });
      } else {
        input = el('input', { id: 'cros-lead-' + f, name: f, type: type });
      }
      if (required) input.setAttribute('required', '');
      input.style.padding = '0.5rem 0.75rem';
      input.style.border = '1px solid #e5e7eb';
      input.style.borderRadius = '0.375rem';
      input.style.font = 'inherit';
      input.style.width = '100%';
      input.style.boxSizing = 'border-box';
      inputs[f] = input;

      form.appendChild(label);
      form.appendChild(input);
    });

    // Honeypot
    var hp = el('input', { type: 'text', name: 'cros_hp', tabindex: '-1', autocomplete: 'off' });
    var hpWrap = el('div', null, [hp]);
    hpWrap.setAttribute('aria-hidden', 'true');
    hpWrap.style.position = 'absolute';
    hpWrap.style.left = '-9999px';
    hpWrap.style.height = '0';
    hpWrap.style.width = '0';
    form.appendChild(hpWrap);

    var status = el('p', { class: 'cros-lead-status' });
    status.style.fontSize = '0.875rem';
    status.style.minHeight = '1.25rem';

    var submit = el('button', { type: 'submit', text: submitLabel });
    submit.style.padding = '0.5rem 1rem';
    submit.style.borderRadius = '0.375rem';
    submit.style.background = '#0f172a';
    submit.style.color = '#fff';
    submit.style.border = 'none';
    submit.style.cursor = 'pointer';
    submit.style.font = 'inherit';

    form.appendChild(submit);
    form.appendChild(status);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      submit.disabled = true;
      submit.textContent = 'Sending…';
      status.textContent = '';
      status.style.color = '';

      var payload = {
        source_app: sourceApp,
        lead_kind: leadKind,
        form_variant: formVariant,
        honeypot: hp.value || '',
        source_url: window.location.href,
        source_page: window.location.pathname,
        referrer: document.referrer || null,
      };
      Object.keys(inputs).forEach(function (k) {
        payload[k] = (inputs[k].value || '').trim() || null;
      });
      var utms = readUtms();
      Object.keys(utms).forEach(function (k) { payload[k] = utms[k]; });

      fetch(INTAKE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (!res.ok || !res.j.ok) throw new Error((res.j && res.j.error) || 'Submission failed');
          form.innerHTML = '';
          var msg = el('div');
          msg.style.padding = '1rem';
          msg.style.borderRadius = '0.5rem';
          msg.style.background = '#ecfdf5';
          msg.style.color = '#047857';
          msg.style.border = '1px solid #6ee7b7';
          msg.innerHTML = '<strong>Thank you — we\'ll be in touch shortly.</strong>' +
                          '<div style="font-size:0.875rem;opacity:0.85;margin-top:0.25rem">' +
                          'Your message reached the CROS console.</div>';
          host.appendChild(msg);
        })
        .catch(function (err) {
          submit.disabled = false;
          submit.textContent = submitLabel;
          status.textContent = err.message || 'Could not send. Please try again.';
          status.style.color = '#b91c1c';
        });
    });

    host.innerHTML = '';
    host.appendChild(form);
  }

  function init() {
    var hosts = document.querySelectorAll('[data-cros-lead-form]');
    hosts.forEach(buildForm);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
