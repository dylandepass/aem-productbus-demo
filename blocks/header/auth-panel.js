/**
 * Auth panel slide-out drawer.
 * Two-step passwordless OTP flow: email → code → logged in.
 */

let commerceApi = null;

async function getCommerce() {
  if (!commerceApi) {
    const mod = await import('../../scripts/commerce/api.js');
    commerceApi = mod.commerce;
  }
  return commerceApi;
}

let otpState = null;

function buildEmailStep() {
  const step = document.createElement('div');
  step.className = 'auth-step auth-step-email';
  step.innerHTML = `
    <h3>Sign in</h3>
    <p class="auth-step-desc">Enter your email to receive a one-time code.</p>
    <form class="auth-form">
      <input type="email" class="auth-input" name="email"
             placeholder="Email address" autocomplete="email" required>
      <button type="submit" class="auth-submit">Continue</button>
      <p class="auth-error"></p>
    </form>
  `;
  return step;
}

function wireCodeBoxes(container) {
  const boxes = container.querySelectorAll('.auth-code-box');

  boxes.forEach((box, i) => {
    box.addEventListener('input', () => {
      box.value = box.value.replace(/[^0-9]/g, '').slice(0, 1);
      if (box.value && i < boxes.length - 1) boxes[i + 1].focus();
    });

    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !box.value && i > 0) {
        boxes[i - 1].focus();
        boxes[i - 1].value = '';
      }
    });

    box.addEventListener('paste', (e) => {
      e.preventDefault();
      const paste = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
      paste.split('').forEach((ch, j) => {
        if (boxes[j]) boxes[j].value = ch;
      });
      const next = Math.min(paste.length, boxes.length - 1);
      boxes[next].focus();
    });
  });
}

function getCodeValue(container) {
  return Array.from(container.querySelectorAll('.auth-code-box'))
    .map((b) => b.value)
    .join('');
}

function buildCodeStep(email) {
  const step = document.createElement('div');
  step.className = 'auth-step auth-step-code';

  const boxesHtml = Array.from({ length: 6 }, (_, i) => `<input type="text" class="auth-code-box" inputmode="numeric" maxlength="1" aria-label="Digit ${i + 1}" ${i === 0 ? 'autocomplete="one-time-code"' : ''}>`).join('');

  step.innerHTML = `
    <h3>Check your email</h3>
    <p class="auth-step-desc">We sent a 6-digit code to <strong>${email}</strong></p>
    <form class="auth-form">
      <div class="auth-code-boxes">${boxesHtml}</div>
      <button type="submit" class="auth-submit">Verify</button>
      <p class="auth-error"></p>
    </form>
    <button type="button" class="auth-back">Use a different email</button>
  `;

  wireCodeBoxes(step);
  return step;
}

function buildSuccessStep(email) {
  const step = document.createElement('div');
  step.className = 'auth-step auth-step-success';
  step.innerHTML = `
    <div class="auth-success-icon">&#10003;</div>
    <h3>Welcome</h3>
    <p class="auth-step-desc">${email}</p>
  `;
  return step;
}

export default function createAuthPanel() {
  const overlay = document.createElement('div');
  overlay.className = 'auth-overlay';

  const drawer = document.createElement('div');
  drawer.className = 'auth-drawer';
  drawer.innerHTML = `
    <div class="auth-header">
      <h2>Account</h2>
      <button class="auth-close" aria-label="Close">&times;</button>
    </div>
    <div class="auth-content"></div>
  `;

  const content = drawer.querySelector('.auth-content');

  function close() {
    drawer.classList.remove('auth-open');
    overlay.classList.remove('auth-overlay-visible');
    document.body.style.overflow = '';
  }

  function open() {
    drawer.classList.add('auth-open');
    overlay.classList.add('auth-overlay-visible');
    document.body.style.overflow = 'hidden';
  }

  function showStep(stepEl) {
    content.innerHTML = '';
    content.append(stepEl);
    const firstInput = stepEl.querySelector('input');
    if (firstInput) setTimeout(() => firstInput.focus(), 100);
  }

  function showEmailStep() {
    const step = buildEmailStep();
    step.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = step.querySelector('[name="email"]').value.trim();
      const btn = step.querySelector('.auth-submit');
      const errEl = step.querySelector('.auth-error');
      errEl.textContent = '';
      btn.disabled = true;
      btn.textContent = 'Sending code\u2026';

      try {
        const commerce = await getCommerce();
        otpState = await commerce.login(email);
        showCodeStep(email);
      } catch (err) {
        errEl.textContent = err.message || 'Failed to send code';
        btn.disabled = false;
        btn.textContent = 'Continue';
      }
    });
    showStep(step);
  }

  function showCodeStep(email) {
    const step = buildCodeStep(email);
    step.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = getCodeValue(step);
      const btn = step.querySelector('.auth-submit');
      const errEl = step.querySelector('.auth-error');
      errEl.textContent = '';
      btn.disabled = true;
      btn.textContent = 'Verifying\u2026';

      try {
        const commerce = await getCommerce();
        await commerce.verifyCode(email, code, otpState.hash, otpState.exp);
        otpState = null;
        showStep(buildSuccessStep(email));
        setTimeout(close, 1500);
      } catch (err) {
        errEl.textContent = err.message || 'Invalid code';
        btn.disabled = false;
        btn.textContent = 'Verify';
      }
    });

    step.querySelector('.auth-back').addEventListener('click', showEmailStep);
    showStep(step);
  }

  overlay.addEventListener('click', close);
  drawer.querySelector('.auth-close').addEventListener('click', close);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer.classList.contains('auth-open')) close();
  });

  document.body.append(overlay, drawer);
  showEmailStep();

  return { open, close, showEmailStep };
}
